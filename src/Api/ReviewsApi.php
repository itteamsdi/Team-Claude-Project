<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\Input;

/**
 * 1-2-1 reviews, including the two-party sign-off and lock.
 *
 * Rules (ported from the Supabase policies and the review_signoff_lock migration):
 *  - View: anyone who can view the employee (self, line manager, skip-level, admin).
 *  - Create: the employee's line manager, the employee themself, or an admin.
 *  - Edit content: the employee or their direct line manager, only while nobody has signed.
 *  - Sign: the employee signs as employee; the review's manager signs as manager
 *    (an admin signs as manager when no manager is recorded). Both signed = Complete + locked.
 *  - Withdraw: your own signature, before the review is Complete.
 *  - Reopen: admin only; clears both signatures.
 *  - Delete: the person who created it, or an admin, unless it is Complete.
 */
final class ReviewsApi
{
    private const COLS = 'id, owner_user_id, employee_name, employee_email, manager_name, manager_email, review_date, status, state,
        employee_signed_at, employee_signed_by, manager_signed_at, manager_signed_by, completed_at, reopened_at, reopened_by,
        created_at, updated_at';

    public static function list(array $me, Input $in): array
    {
        [$where, $params] = Access::viewableWhere($me, 'employee_email');
        $rows = Db::all('SELECT ' . self::COLS . " FROM reviews WHERE $where ORDER BY updated_at DESC", $params);
        return ['items' => array_map(static fn ($r) => self::out($me, $r), $rows)];
    }

    public static function get(array $me, Input $in): array
    {
        return ['item' => self::out($me, self::load($me, $in->id('id')))];
    }

    public static function create(array $me, Input $in): array
    {
        $emp = $in->email('employee_email');
        $org = Access::org();
        if (!isset($org[$emp])) {
            throw new ApiError('Choose a team member from the list.');
        }
        if (!Access::canEdit($me, $emp) && !Access::isAdmin($me)) {
            throw new ApiError('You can only start reviews for your direct reports.', 403);
        }
        $state = $in->object('state', 4_000_000);
        $mgrEmail = Access::managerOf($emp);
        $id = Db::uuid();
        $now = Db::now();
        Db::run(
            "INSERT INTO reviews (id, owner_user_id, employee_name, employee_email, manager_name, manager_email, status, state, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'Open', ?, ?, ?)",
            [
                $id, $me['id'], $org[$emp]['full_name'] ?: $emp, $emp,
                $mgrEmail !== null ? (($org[$mgrEmail]['full_name'] ?? '') ?: $mgrEmail) : null,
                $mgrEmail, json_encode($state, JSON_UNESCAPED_UNICODE), $now, $now,
            ]
        );
        return ['item' => self::out($me, self::load($me, $id))];
    }

    public static function save(array $me, Input $in): array
    {
        $id = $in->id('id');
        $state = $in->object('state', 4_000_000);
        $name = $in->str('employee_name', 200, false);
        $date = $in->date('review_date');
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $r = self::lockRow($me, $id);
            if ($r['status'] === 'Complete') {
                throw new ApiError('This review is signed off and locked.', 409);
            }
            if (!Access::canEdit($me, $r['employee_email'])) {
                throw new ApiError('Only the employee and their direct line manager can change this review.', 403);
            }
            if ($r['employee_signed_at'] !== null || $r['manager_signed_at'] !== null) {
                throw new ApiError('Sign-off is in progress. Withdraw the signature before editing this review.', 409);
            }
            $now = Db::now();
            [$mgrEmail, $mgrName] = self::currentManager($r['employee_email']);
            Db::run(
                'UPDATE reviews SET state = ?, employee_name = ?, review_date = ?, manager_email = ?, manager_name = ?, updated_at = ? WHERE id = ?',
                [json_encode($state, JSON_UNESCAPED_UNICODE), $name !== '' ? $name : $r['employee_name'], $date, $mgrEmail, $mgrName, $now, $id]
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return ['updated_at' => self::ts($now)];
    }

    public static function delete(array $me, Input $in): array
    {
        $id = $in->id('id');
        $r = self::load($me, $id);
        if ((int) $r['owner_user_id'] !== $me['id'] && !Access::isAdmin($me)) {
            throw new ApiError('You can only delete a review you created.', 403);
        }
        if ($r['status'] === 'Complete') {
            throw new ApiError('This review is signed off and locked, so it cannot be deleted.', 409);
        }
        Db::run('DELETE FROM reviews WHERE id = ?', [$id]);
        return ['deleted' => true];
    }

    public static function sign(array $me, Input $in): array
    {
        $id = $in->id('id');
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $r = self::lockRow($me, $id);
            if ($r['status'] === 'Complete') {
                throw new ApiError('This review is already signed off.', 409);
            }
            $now = Db::now();
            $role = self::signerRole($me, $r);
            [$mgrEmail, $mgrName] = self::currentManager($r['employee_email']);
            Db::run('UPDATE reviews SET manager_email = ?, manager_name = ? WHERE id = ?', [$mgrEmail, $mgrName, $id]);
            if ($role === 'employee') {
                if ($r['employee_signed_at'] === null) {
                    Db::run('UPDATE reviews SET employee_signed_at = ?, employee_signed_by = ?, updated_at = ? WHERE id = ?', [$now, $me['email'], $now, $id]);
                }
            } elseif ($role === 'manager') {
                if ($r['manager_signed_at'] === null) {
                    Db::run('UPDATE reviews SET manager_signed_at = ?, manager_signed_by = ?, updated_at = ? WHERE id = ?', [$now, $me['email'], $now, $id]);
                }
            } else {
                throw new ApiError('Only the employee or their line manager can sign off this review.', 403);
            }
            Db::run(
                "UPDATE reviews SET status = 'Complete', completed_at = ?, updated_at = ?
                  WHERE id = ? AND employee_signed_at IS NOT NULL AND manager_signed_at IS NOT NULL",
                [$now, $now, $id]
            );
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return ['item' => self::out($me, self::load($me, $id))];
    }

    public static function unsign(array $me, Input $in): array
    {
        $id = $in->id('id');
        $pdo = Db::pdo();
        $pdo->beginTransaction();
        try {
            $r = self::lockRow($me, $id);
            if ($r['status'] === 'Complete') {
                throw new ApiError('This review is signed off and locked. Ask an admin to reopen it.', 409);
            }
            $now = Db::now();
            if ($r['employee_signed_by'] === $me['email']) {
                Db::run('UPDATE reviews SET employee_signed_at = NULL, employee_signed_by = NULL, updated_at = ? WHERE id = ?', [$now, $id]);
            } elseif ($r['manager_signed_by'] === $me['email']) {
                Db::run('UPDATE reviews SET manager_signed_at = NULL, manager_signed_by = NULL, updated_at = ? WHERE id = ?', [$now, $id]);
            } else {
                throw new ApiError('You have not signed this review.');
            }
            $pdo->commit();
        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
        return ['item' => self::out($me, self::load($me, $id))];
    }

    public static function reopen(array $me, Input $in): array
    {
        if (!Access::isAdmin($me)) {
            throw new ApiError('Only an admin can reopen a signed-off review.', 403);
        }
        $id = $in->id('id');
        self::load($me, $id);
        $now = Db::now();
        Db::run(
            "UPDATE reviews SET status = 'Open', completed_at = NULL,
                    employee_signed_at = NULL, employee_signed_by = NULL,
                    manager_signed_at = NULL, manager_signed_by = NULL,
                    reopened_at = ?, reopened_by = ?, updated_at = ?
              WHERE id = ?",
            [$now, $me['email'], $now, $id]
        );
        return ['item' => self::out($me, self::load($me, $id))];
    }

    /* ---------------------------------------------------------------- helpers */

    /** The employee signs as employee; their CURRENT line manager (from the org chart) signs as manager. */
    private static function signerRole(array $me, array $r): ?string
    {
        if ($r['employee_email'] === $me['email']) {
            return 'employee';
        }
        $mgr = (string) (Access::managerOf($r['employee_email']) ?? '');
        if ($mgr !== '' ? $mgr === $me['email'] : Access::isAdmin($me)) {
            return 'manager';
        }
        return null;
    }

    /** @return array{0:?string,1:?string} the employee's current line manager email and name */
    private static function currentManager(string $employee): array
    {
        $m = Access::managerOf($employee);
        if ($m === null) {
            return [null, null];
        }
        return [$m, (Access::org()[$m]['full_name'] ?? '') ?: $m];
    }

    private static function load(array $me, string $id): array
    {
        $r = Db::one('SELECT ' . self::COLS . ' FROM reviews WHERE id = ?', [$id]);
        if ($r === null || !Access::canView($me, $r['employee_email'])) {
            throw new ApiError('That review was not found, or you do not have access to it.', 404);
        }
        return $r;
    }

    private static function lockRow(array $me, string $id): array
    {
        $r = Db::one('SELECT ' . self::COLS . ' FROM reviews WHERE id = ? FOR UPDATE', [$id]);
        if ($r === null || !Access::canView($me, $r['employee_email'])) {
            throw new ApiError('That review was not found, or you do not have access to it.', 404);
        }
        return $r;
    }

    public static function ts(?string $dbTime): ?string
    {
        if ($dbTime === null || $dbTime === '') {
            return null;
        }
        $d = new \DateTimeImmutable($dbTime, new \DateTimeZone('UTC'));
        return $d->format('Y-m-d\TH:i:s.u\Z');
    }

    private static function out(array $me, array $r): array
    {
        $state = json_decode((string) $r['state'], true);
        if ($r['status'] !== 'Complete') {
            // Open reviews follow the org chart, so a change of line manager applies straight away.
            [$r['manager_email'], $r['manager_name']] = self::currentManager($r['employee_email']);
        }
        return [
            'id' => $r['id'],
            'employee_name' => $r['employee_name'],
            'employee_email' => $r['employee_email'],
            'manager_name' => $r['manager_name'],
            'manager_email' => $r['manager_email'],
            'review_date' => $r['review_date'],
            'status' => $r['status'],
            'state' => is_array($state) ? $state : new \stdClass(),
            'employee_signed_at' => self::ts($r['employee_signed_at']),
            'employee_signed_by' => $r['employee_signed_by'],
            'manager_signed_at' => self::ts($r['manager_signed_at']),
            'manager_signed_by' => $r['manager_signed_by'],
            'completed_at' => self::ts($r['completed_at']),
            'reopened_at' => self::ts($r['reopened_at']),
            'reopened_by' => $r['reopened_by'],
            'created_at' => self::ts($r['created_at']),
            'updated_at' => self::ts($r['updated_at']),
            'can_delete' => ((int) $r['owner_user_id'] === $me['id'] || Access::isAdmin($me)) && $r['status'] !== 'Complete',
        ];
    }
}
