<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\Files;
use SdiHr\Input;

/**
 * Routed forms: self-certification, expense claim, flexible working request, DSE assessment.
 *  - Submit: for yourself only.
 *  - View: see Access::canViewSubmission (expenses and flexible working are open to the whole
 *    reporting line, the finance team and the CEO; the others to line manager and one level above).
 *  - Self-cert: the line manager authorises or rejects.
 *  - Expenses: the line manager approves or rejects, then anyone in the finance team authorises
 *    payment (or rejects) and finally marks the claim as paid.
 *  - Flexible working and DSE: the line manager completes their section of the form.
 * Every decision is final and is added to the form's audit trail (manager_data.trail).
 */
final class SubmissionsApi
{
    public const TYPES = ['self_cert', 'expense', 'flex_work', 'dse'];
    public const MILEAGE_RATE = 0.35; // pounds per mile, as stated on the form
    public const EXPENSE_CATEGORIES = ['Travel (public or non-private)', 'Mileage', 'Accommodation', 'Subsistence', 'Equipment', 'Other'];
    public const FLEX_CHANGES = ['Reduced hours', 'Compressed hours', 'Different start / finish times', 'Different working days',
        'Change of location', 'Job share', 'Other'];
    private const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
        'October', 'November', 'December'];

    public static function list(array $me, Input $in): array
    {
        $type = $in->oneOf('type', self::TYPES);
        [$where, $params] = Access::submissionWhere($me, $type, 'employee_email');
        $rows = Db::all(
            "SELECT * FROM submissions WHERE type = ? AND $where ORDER BY submitted_at DESC",
            array_merge([$type], $params)
        );
        $files = self::fileCounts(array_column($rows, 'id'));
        return [
            'items' => array_map(static fn ($r) => self::out($r, null, $files[$r['id']] ?? 0), $rows),
            'is_finance' => Access::isFinance($me),
        ];
    }

    public static function get(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        return ['item' => self::out($s, Files::forSubmission($s['id']))];
    }

    public static function create(array $me, Input $in): array
    {
        $type = $in->oneOf('type', self::TYPES);
        $data = self::validate($type, $in->object('data', 500_000));
        $id = Db::uuid();
        $now = Db::now();
        Db::run(
            "INSERT INTO submissions (id, type, employee_email, owner_user_id, data, manager_data, status, submitted_at, updated_at)
             VALUES (?, ?, ?, ?, ?, '{}', 'submitted', ?, ?)",
            [$id, $type, $me['email'], $me['id'], json_encode($data, JSON_UNESCAPED_UNICODE), $now, $now]
        );
        return ['id' => $id];
    }

    /** Self-certification: the line manager authorises or rejects, with an optional note. */
    public static function decide(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        if ($s['type'] !== 'self_cert') {
            throw new ApiError('Open this form to record the decision.');
        }
        self::requireLineManager($me, $s);
        if ($s['status'] !== 'submitted') {
            throw new ApiError('This form has already been ' . $s['status'] . '.', 409);
        }
        $status = $in->oneOf('status', ['authorised', 'rejected']);
        $note = $in->str('note', 2000, false);
        if ($status === 'rejected' && $note === '') {
            throw new ApiError('Please give the reason for rejecting.');
        }
        $md = self::managerData($s);
        $md['note'] = $note;
        $md['by'] = $me['email'];
        self::saveDecision($me, $s['id'], $status, self::addTrail($md, $me, $status, $note));
        return ['status' => $status];
    }

    /**
     * Expense claims, step by step:
     *   submitted          -> approve / reject              (line manager)
     *   approved           -> authorise_payment / reject    (finance team)
     *   payment_authorised -> mark_paid                     (finance team)
     */
    public static function expenseAction(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        if ($s['type'] !== 'expense') {
            throw new ApiError('That is not an expense claim.');
        }
        $action = $in->oneOf('step', ['approve', 'reject', 'authorise_payment', 'mark_paid']);
        $note = $in->str('note', 2000, false);
        $status = $s['status'] === 'authorised' ? 'approved' : $s['status']; // claims decided before Oct 2026
        $md = self::managerData($s);

        if ($s['employee_email'] === $me['email']) {
            throw new ApiError('You cannot approve or pay your own claim.', 403);
        }
        if ($action === 'reject' && $note === '') {
            throw new ApiError('Please add a comment explaining why the claim is rejected.');
        }
        if ($status === 'submitted' && in_array($action, ['approve', 'reject'], true)) {
            self::requireLineManager($me, $s);
            $new = $action === 'approve' ? 'approved' : 'rejected';
            $md['lm'] = ['decision' => $new, 'by' => $me['email'], 'at' => Db::now(), 'note' => $note];
        } elseif ($status === 'approved' && in_array($action, ['authorise_payment', 'reject'], true)) {
            self::requireFinance($me);
            $new = $action === 'authorise_payment' ? 'payment_authorised' : 'rejected';
            $md['finance'] = ['decision' => $new, 'by' => $me['email'], 'at' => Db::now(), 'note' => $note];
        } elseif ($status === 'payment_authorised' && $action === 'mark_paid') {
            self::requireFinance($me);
            $paidOn = $in->date('paid_on') ?? gmdate('Y-m-d');
            $new = 'paid';
            $md['paid'] = ['by' => $me['email'], 'at' => Db::now(), 'on' => $paidOn, 'note' => $note];
        } else {
            throw new ApiError('This claim is now "' . self::statusLabel('expense', $s['status']) . '", so that step is not available. Reload to see the latest.', 409);
        }
        if ($note !== '') {
            $md['note'] = $note;
        }
        self::saveDecision($me, $s['id'], $new, self::addTrail($md, $me, $new, $note));
        return ['status' => $new];
    }

    /** Flexible working and DSE: the line manager's section of the form. Final once saved. */
    public static function saveManagerSection(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        self::requireLineManager($me, $s);
        if ($s['status'] !== 'submitted') {
            throw new ApiError('A decision has already been recorded for this form.', 409);
        }
        $md = self::stringsOnly($in->object('manager_data', 100_000));
        if ($s['type'] === 'flex_work') {
            $outcome = $md['outcome'] ?? '';
            $missing = [];
            if (!in_array($outcome, ['approved', 'trial', 'declined'], true)) {
                $missing[] = 'Outcome';
            }
            if (self::blank($md['meetingDate'] ?? '')) {
                $missing[] = 'Meeting held on';
            }
            if ($outcome === 'declined' && empty($md['declineReasons'])) {
                $missing[] = 'Business reason(s) for declining';
            }
            if ($outcome === 'trial' && self::blank($md['trialReview'] ?? '')) {
                $missing[] = 'Trial period / review date';
            }
            if (self::blank($md['mgrSign'] ?? '')) {
                $missing[] = 'Line manager signature';
            }
            if (self::blank($md['mgrDate'] ?? '')) {
                $missing[] = 'Date signed';
            }
            self::failIfMissing($missing);
            self::checkDates($md, ['meetingDate' => 'Meeting held on', 'agreedDate' => 'Agreed effective date', 'mgrDate' => 'Date signed']);
            $status = $outcome;
        } elseif ($s['type'] === 'dse') {
            $missing = [];
            if (self::blank($md['actions'] ?? '')) {
                $missing[] = 'Actions agreed';
            }
            if (self::blank($md['reviewer'] ?? '')) {
                $missing[] = 'Reviewed by (name & signature)';
            }
            self::failIfMissing($missing);
            self::checkDates($md, ['reviewDate' => 'Review date']);
            $status = 'reviewed';
        } else {
            throw new ApiError('This form uses Authorise / Reject instead.');
        }
        $md['by'] = $me['email'];
        self::saveDecision($me, $s['id'], $status, self::addTrail($md, $me, $status, (string) ($md['notes'] ?? '')));
        return ['status' => $status];
    }

    /** Used by upload.php and file.php. */
    public static function loadForFiles(array $me, string $id): array
    {
        return self::load($me, $id);
    }

    public static function statusLabel(string $type, string $status): string
    {
        if ($type === 'expense') {
            return [
                'submitted' => 'Awaiting line manager', 'approved' => 'Approved – awaiting finance',
                'authorised' => 'Approved – awaiting finance', 'payment_authorised' => 'Payment authorised',
                'paid' => 'Paid', 'rejected' => 'Rejected',
            ][$status] ?? $status;
        }
        return $status;
    }

    /* ---------------------------------------------------------------- helpers */

    private static function saveDecision(array $me, string $id, string $status, array $managerData): void
    {
        $now = Db::now();
        Db::run(
            'UPDATE submissions SET status = ?, manager_data = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?',
            [$status, json_encode($managerData, JSON_UNESCAPED_UNICODE), $me['email'], $now, $now, $id]
        );
    }

    private static function managerData(array $s): array
    {
        $md = json_decode((string) $s['manager_data'], true);
        return is_array($md) ? $md : [];
    }

    private static function addTrail(array $md, array $me, string $status, string $note): array
    {
        $trail = is_array($md['trail'] ?? null) ? $md['trail'] : [];
        $trail[] = ['status' => $status, 'by' => $me['email'], 'at' => gmdate('Y-m-d\TH:i:s\Z'), 'note' => mb_substr($note, 0, 2000, 'UTF-8')];
        $md['trail'] = $trail;
        return $md;
    }

    private static function requireLineManager(array $me, array $s): void
    {
        if ($s['employee_email'] === $me['email']) {
            throw new ApiError('You cannot authorise or decide your own form. Your line manager does this.', 403);
        }
        if (!Access::isLineManagerOf($me, $s['employee_email']) && !Access::isAdmin($me)) {
            throw new ApiError("Only the employee's line manager can make this decision.", 403);
        }
    }

    private static function requireFinance(array $me): void
    {
        if (!Access::isFinance($me)) {
            throw new ApiError('Only the finance team can authorise payment of expense claims.', 403);
        }
    }

    private static function load(array $me, string $id): array
    {
        $s = Db::one('SELECT * FROM submissions WHERE id = ?', [$id]);
        if ($s === null || !Access::canViewSubmission($me, $s['type'], $s['employee_email'])) {
            throw new ApiError('That form was not found, or you do not have access to it.', 404);
        }
        return $s;
    }

    private static function blank(mixed $v): bool
    {
        return !is_string($v) && !is_numeric($v) ? empty($v) : trim((string) $v) === '';
    }

    /** @param string[] $missing */
    private static function failIfMissing(array $missing): void
    {
        if ($missing !== []) {
            throw new ApiError('Please complete: ' . implode(', ', $missing) . '.');
        }
    }

    private static function isDate(mixed $v): bool
    {
        if (!is_string($v)) {
            return false;
        }
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $v);
        return $d !== false && $d->format('Y-m-d') === $v;
    }

    /** Any of these fields that are filled in must be real dates. */
    private static function checkDates(array $d, array $fields): void
    {
        foreach ($fields as $k => $label) {
            if (!self::blank($d[$k] ?? '') && !self::isDate($d[$k])) {
                throw new ApiError("$label must be a date.");
            }
        }
    }

    /** "October 2026" style claim period, from two years back to next month. */
    private static function validPeriod(string $p): bool
    {
        if (!preg_match('/^(' . implode('|', self::MONTHS) . ') (\d{4})$/', $p, $m)) {
            return false;
        }
        $idx = (int) $m[2] * 12 + array_search($m[1], self::MONTHS, true);
        $now = (int) gmdate('Y') * 12 + (int) gmdate('n') - 1;
        return $idx >= $now - 24 && $idx <= $now + 1;
    }

    /** Check the fields each form needs, and recalculate money on the server. */
    private static function validate(string $type, array $d): array
    {
        $d = self::stringsOnly($d);
        $missing = [];
        $req = static function (string $k, string $label) use (&$d, &$missing): void {
            if (self::blank($d[$k] ?? '')) {
                $missing[] = $label;
            }
        };

        switch ($type) {
            case 'self_cert':
                $req('first', 'First day of absence');
                $req('last', 'Last day of absence');
                $req('ret', 'Date returned');
                $req('reason', 'Reason for absence');
                $req('signed', 'Declaration (type your full name)');
                self::failIfMissing($missing);
                self::checkDates($d, ['first' => 'First day of absence', 'last' => 'Last day of absence', 'ret' => 'Date returned']);
                if ($d['last'] < $d['first']) {
                    throw new ApiError('The last day of absence cannot be before the first day.');
                }
                if ($d['ret'] < $d['last']) {
                    throw new ApiError('The date you returned cannot be before the last day of absence.');
                }
                break;

            case 'expense':
                $req('name', 'Full name');
                if (!is_string($d['period'] ?? null) || !self::validPeriod($d['period'])) {
                    $missing[] = 'Claim period / month';
                }
                $items = is_array($d['items'] ?? null) ? array_values($d['items']) : [];
                if ($items === []) {
                    $missing[] = 'At least one expense item';
                }
                if (($d['declAgree'] ?? false) !== true) {
                    $missing[] = 'Declaration tick box';
                }
                $req('signed', 'Declaration (type your full name)');
                self::failIfMissing($missing);
                if (count($items) > 200) {
                    throw new ApiError('Too many expense items in one claim.');
                }
                $centres = CostCentresApi::names();
                $sum = 0.0;
                foreach ($items as $i => $it) {
                    $n = $i + 1;
                    if (!is_array($it)) {
                        throw new ApiError("Item $n is not in the expected format.");
                    }
                    $cat = (string) ($it['cat'] ?? '');
                    $rowMissing = [];
                    if (!self::isDate($it['date'] ?? null)) {
                        $rowMissing[] = 'date';
                    }
                    if (!in_array($cat, self::EXPENSE_CATEGORIES, true)) {
                        $rowMissing[] = 'category';
                    }
                    if (self::blank($it['desc'] ?? '')) {
                        $rowMissing[] = $cat === 'Mileage' ? 'what the mileage was for' : 'what it was for';
                    }
                    if (!in_array((string) ($it['cc'] ?? ''), $centres, true)) {
                        $rowMissing[] = 'cost centre';
                    }
                    if (!in_array($it['receipt'] ?? '', ['Yes', 'No'], true)) {
                        $rowMissing[] = 'receipt attached Y/N';
                    }
                    $miles = '';
                    if ($cat === 'Mileage') {
                        $miles = $it['miles'] ?? '';
                        if (!is_numeric($miles) || (float) $miles <= 0 || (float) $miles > 10000) {
                            $rowMissing[] = 'miles (more than 0)';
                            $amt = 0.0;
                        } else {
                            $amt = round((float) $miles * self::MILEAGE_RATE, 2);
                        }
                    } else {
                        $raw = $it['amount'] ?? '';
                        if (!is_numeric($raw) || (float) $raw <= 0 || (float) $raw > 100000) {
                            $rowMissing[] = 'amount (between £0.01 and £100,000)';
                            $amt = 0.0;
                        } else {
                            $amt = round((float) $raw, 2);
                        }
                    }
                    if ($rowMissing !== []) {
                        throw new ApiError("Item $n: please complete the " . implode(', ', $rowMissing) . '.');
                    }
                    $sum += $amt;
                    $items[$i] = [
                        'date' => (string) $it['date'], 'cat' => $cat, 'desc' => trim((string) $it['desc']),
                        'cc' => (string) $it['cc'], 'miles' => $cat === 'Mileage' ? (float) $miles : null,
                        'amount' => number_format($amt, 2, '.', ''), 'receipt' => (string) $it['receipt'],
                    ];
                }
                $d['items'] = $items;
                $d['total'] = round($sum, 2);
                $d['mileageRate'] = self::MILEAGE_RATE;
                unset($d['miles'], $d['mileageAmt']);
                break;

            case 'flex_work':
                $req('name', 'Full name');
                $req('jobTitle', 'Job title');
                $req('dept', 'Department');
                $req('reqDate', 'Date of this request');
                $req('currentPattern', 'Current working pattern');
                $types = is_array($d['changeTypes'] ?? null) ? array_values($d['changeTypes']) : [];
                if ($types === []) {
                    $missing[] = 'Type of change';
                }
                $req('newPattern', 'New working pattern');
                $req('effectiveDate', 'Date you would like the change to take effect');
                if (!in_array($d['duration'] ?? '', ['Permanent', 'Temporary'], true)) {
                    $missing[] = 'Permanent or temporary';
                } elseif ($d['duration'] === 'Temporary') {
                    $req('endDate', 'End date of the temporary change');
                }
                if (($d['statutory'] ?? false) !== true) {
                    $missing[] = 'Statutory request confirmation';
                }
                if (!in_array($d['prevRequest'] ?? '', ['Yes', 'No'], true)) {
                    $missing[] = 'Previous request in the last 12 months';
                } elseif ($d['prevRequest'] === 'Yes') {
                    $req('prevDate', 'Date of the previous request');
                }
                $req('signed', 'Declaration (type your full name)');
                self::failIfMissing($missing);
                foreach ($types as $t) {
                    if (!in_array($t, self::FLEX_CHANGES, true)) {
                        throw new ApiError('Choose the type of change from the list.');
                    }
                }
                self::checkDates($d, ['reqDate' => 'Date of this request', 'effectiveDate' => 'Effective date',
                    'endDate' => 'End date', 'prevDate' => 'Date of the previous request']);
                if ($d['duration'] === 'Temporary' && $d['endDate'] <= $d['effectiveDate']) {
                    throw new ApiError('The end date of a temporary change must be after the date it takes effect.');
                }
                if ($d['duration'] === 'Permanent') {
                    $d['endDate'] = '';
                }
                if ($d['prevRequest'] === 'No') {
                    $d['prevDate'] = '';
                }
                break;

            case 'dse':
                $req('name', 'Full name');
                $req('dept', 'Department');
                $req('where', 'Where you work');
                $req('date', 'Date of assessment');
                $answers = is_array($d['answers'] ?? null) ? array_values($d['answers']) : [];
                $unanswered = 0;
                foreach ($answers as $a) {
                    if (!is_array($a) || !in_array($a['ans'] ?? '', ['Yes', 'No'], true)) {
                        $unanswered++;
                    }
                }
                if ($answers === [] || $unanswered > 0) {
                    $missing[] = $unanswered > 0 ? "Yes/No answers ($unanswered not answered)" : 'Yes/No answers';
                }
                $req('issues', 'Issues & support');
                if (!in_array($d['needSupport'] ?? '', ['Yes', 'No'], true)) {
                    $missing[] = 'Need equipment or support';
                }
                if (!in_array($d['eyeTest'] ?? '', ['Yes', 'No'], true)) {
                    $missing[] = 'Eyesight test';
                }
                $req('signed', 'Declaration (type your full name)');
                self::failIfMissing($missing);
                self::checkDates($d, ['date' => 'Date of assessment']);
                break;
        }
        $d['signDate'] = gmdate('Y-m-d');
        return $d;
    }

    /** Keep only plain values (text, numbers, true/false) and lists/objects of them; cap text length. */
    private static function stringsOnly(array $a, int $depth = 0): array
    {
        $out = [];
        foreach ($a as $k => $v) {
            if (!is_int($k) && (!is_string($k) || strlen($k) > 64)) {
                continue;
            }
            if (is_array($v)) {
                if ($depth < 4) {
                    $out[$k] = self::stringsOnly($v, $depth + 1);
                }
            } elseif (is_string($v)) {
                $out[$k] = mb_substr($v, 0, 10000, 'UTF-8');
            } elseif (is_int($v) || is_float($v) || is_bool($v) || $v === null) {
                $out[$k] = $v;
            }
        }
        return $out;
    }

    /** @param string[] $ids @return array<string,int> */
    private static function fileCounts(array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        $out = [];
        foreach (Db::all('SELECT submission_id, COUNT(*) AS n FROM submission_files WHERE submission_id IN ('
            . Db::placeholders($ids) . ') GROUP BY submission_id', $ids) as $r) {
            $out[$r['submission_id']] = (int) $r['n'];
        }
        return $out;
    }

    private static function out(array $s, ?array $files = null, ?int $fileCount = null): array
    {
        $data = json_decode((string) $s['data'], true);
        $md = json_decode((string) $s['manager_data'], true);
        $o = [
            'id' => $s['id'],
            'type' => $s['type'],
            'employee_email' => $s['employee_email'],
            'data' => is_array($data) ? $data : new \stdClass(),
            'manager_data' => is_array($md) && $md !== [] ? $md : new \stdClass(),
            'status' => $s['status'],
            'status_label' => self::statusLabel($s['type'], $s['status']),
            'submitted_at' => ReviewsApi::ts($s['submitted_at']),
            'decided_by' => $s['decided_by'],
            'decided_at' => ReviewsApi::ts($s['decided_at']),
        ];
        if ($files !== null) {
            $o['files'] = $files;
            $o['file_count'] = count($files);
        } elseif ($fileCount !== null) {
            $o['file_count'] = $fileCount;
        }
        return $o;
    }
}
