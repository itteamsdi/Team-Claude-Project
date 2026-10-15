<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\Input;

/**
 * Routed forms: self-certification, expense claim, flexible working request, DSE assessment.
 *  - Submit: for yourself only.
 *  - View: anyone who can view the employee (self, line manager, skip-level, admin).
 *  - Decide / complete the manager's section: the direct line manager or an admin.
 */
final class SubmissionsApi
{
    public const TYPES = ['self_cert', 'expense', 'flex_work', 'dse'];
    private const MILEAGE_RATE = 0.35; // pounds per mile, as stated on the form

    public static function list(array $me, Input $in): array
    {
        $type = $in->oneOf('type', self::TYPES);
        [$where, $params] = Access::viewableWhere($me, 'employee_email');
        $rows = Db::all(
            "SELECT * FROM submissions WHERE type = ? AND $where ORDER BY submitted_at DESC",
            array_merge([$type], $params)
        );
        return ['items' => array_map([self::class, 'out'], $rows)];
    }

    public static function get(array $me, Input $in): array
    {
        return ['item' => self::out(self::load($me, $in->id('id')))];
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

    /** Self-cert and expenses: authorise or reject, with an optional note. */
    public static function decide(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        self::requireManager($me, $s);
        if (!in_array($s['type'], ['self_cert', 'expense'], true)) {
            throw new ApiError('Open this form to record the decision.');
        }
        if ($s['status'] !== 'submitted') {
            throw new ApiError('This form has already been ' . $s['status'] . '.', 409);
        }
        $status = $in->oneOf('status', ['authorised', 'rejected']);
        $note = $in->str('note', 2000, false);
        self::saveDecision($me, $s['id'], $status, ['note' => $note, 'by' => $me['email']]);
        return ['status' => $status];
    }

    /** Flexible working and DSE: the line manager's section of the form. */
    public static function saveManagerSection(array $me, Input $in): array
    {
        $s = self::load($me, $in->id('id'));
        self::requireManager($me, $s);
        $md = $in->object('manager_data', 100_000);
        if ($s['type'] === 'flex_work') {
            $outcome = $md['outcome'] ?? '';
            if (!in_array($outcome, ['approved', 'trial', 'declined'], true)) {
                throw new ApiError('Select an outcome (Approved / Trial / Declined).');
            }
            $status = $outcome;
        } elseif ($s['type'] === 'dse') {
            $status = 'reviewed';
        } else {
            throw new ApiError('This form uses Authorise / Reject instead.');
        }
        $md = self::stringsOnly($md);
        $md['by'] = $me['email'];
        self::saveDecision($me, $s['id'], $status, $md);
        return ['status' => $status];
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

    private static function requireManager(array $me, array $s): void
    {
        if ($s['employee_email'] === $me['email']) {
            throw new ApiError('You cannot authorise or decide your own form. Your line manager does this.', 403);
        }
        if (!Access::isLineManagerOf($me, $s['employee_email']) && !Access::isAdmin($me)) {
            throw new ApiError("Only the employee's line manager can make this decision.", 403);
        }
    }

    private static function load(array $me, string $id): array
    {
        $s = Db::one('SELECT * FROM submissions WHERE id = ?', [$id]);
        if ($s === null || !Access::canView($me, $s['employee_email'])) {
            throw new ApiError('That form was not found, or you do not have access to it.', 404);
        }
        return $s;
    }

    /** Check the fields each form needs, and recalculate money on the server. */
    private static function validate(string $type, array $d): array
    {
        $d = self::stringsOnly($d);
        $signed = trim((string) ($d['signed'] ?? ''));
        if ($signed === '') {
            throw new ApiError('Sign the declaration to submit.');
        }
        $d['signDate'] = gmdate('Y-m-d');
        switch ($type) {
            case 'self_cert':
                if (trim((string) ($d['first'] ?? '')) === '') {
                    throw new ApiError('Enter the first day of absence and sign the declaration.');
                }
                break;
            case 'expense':
                $items = is_array($d['items'] ?? null) ? array_values($d['items']) : [];
                if (count($items) > 200) {
                    throw new ApiError('Too many expense items in one claim.');
                }
                $sum = 0.0;
                foreach ($items as $i => $it) {
                    if (!is_array($it)) {
                        throw new ApiError('An expense item is not in the expected format.');
                    }
                    $amt = $it['amount'] ?? '';
                    if ($amt !== '' && !is_numeric($amt)) {
                        throw new ApiError('Each amount must be a number.');
                    }
                    $amt = $amt === '' ? 0.0 : (float) $amt;
                    if ($amt < 0 || $amt > 100000) {
                        throw new ApiError('Each amount must be between £0 and £100,000.');
                    }
                    $sum += $amt;
                    $items[$i] = [
                        'date' => (string) ($it['date'] ?? ''), 'cat' => (string) ($it['cat'] ?? ''),
                        'desc' => (string) ($it['desc'] ?? ''), 'cc' => (string) ($it['cc'] ?? ''),
                        'amount' => (string) ($it['amount'] ?? ''),
                    ];
                }
                $miles = $d['miles'] ?? 0;
                if ($miles !== '' && !is_numeric($miles)) {
                    throw new ApiError('Mileage must be a number.');
                }
                $miles = (float) ($miles === '' ? 0 : $miles);
                if ($miles < 0 || $miles > 100000) {
                    throw new ApiError('Mileage must be between 0 and 100,000 miles.');
                }
                $d['items'] = $items;
                $d['miles'] = $miles;
                $d['mileageAmt'] = round($miles * self::MILEAGE_RATE, 2);
                $d['total'] = round($sum + $miles * self::MILEAGE_RATE, 2);
                break;
            case 'flex_work':
            case 'dse':
                break;
        }
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

    private static function out(array $s): array
    {
        $data = json_decode((string) $s['data'], true);
        $md = json_decode((string) $s['manager_data'], true);
        return [
            'id' => $s['id'],
            'type' => $s['type'],
            'employee_email' => $s['employee_email'],
            'data' => is_array($data) ? $data : new \stdClass(),
            'manager_data' => is_array($md) && $md !== [] ? $md : new \stdClass(),
            'status' => $s['status'],
            'submitted_at' => ReviewsApi::ts($s['submitted_at']),
            'decided_by' => $s['decided_by'],
            'decided_at' => ReviewsApi::ts($s['decided_at']),
        ];
    }
}
