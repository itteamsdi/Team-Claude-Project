<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Auth;
use SdiHr\Db;
use SdiHr\Input;

/**
 * The org chart (who reports to whom) and sign-in accounts.
 * Everyone signed in can read the chart; only admins can change it.
 */
final class OrgApi
{
    public static function list(array $me, Input $in): array
    {
        $rows = Db::all(
            'SELECT o.email, o.full_name, o.job_title, o.department, o.manager_email, o.role, o.is_finance, o.is_ceo,
                    (u.id IS NOT NULL) AS has_account
               FROM org_members o LEFT JOIN users u ON u.email = o.email ORDER BY o.full_name, o.email'
        );
        $admin = Access::isAdmin($me);
        return ['members' => array_map(static function ($r) use ($admin) {
            $m = [
                'email' => $r['email'],
                'full_name' => $r['full_name'],
                'job_title' => $r['job_title'],
                'department' => $r['department'],
                'manager_email' => $r['manager_email'],
                'role' => $r['role'],
                'is_finance' => (int) $r['is_finance'] === 1,
                'is_ceo' => (int) $r['is_ceo'] === 1,
            ];
            if ($admin) {
                $m['has_account'] = (bool) $r['has_account'];
            }
            return $m;
        }, $rows)];
    }

    /** Add or update a person. Creates their sign-in account with a one-time password if they have none. */
    public static function save(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $email = $in->email('email');
        $name = $in->str('full_name', 200, false);
        $mgr = $in->email('manager_email', false);
        $role = $in->oneOf('role', ['member', 'admin']);
        $jobTitle = $in->str('job_title', 200, false);
        $department = $in->str('department', 200, false);
        $isFinance = $in->bool('is_finance') ? 1 : 0;
        $isCeo = $in->bool('is_ceo') ? 1 : 0;

        $org = Access::org();
        if ($mgr !== null) {
            if ($mgr === $email) {
                throw new ApiError('A person cannot report to themselves.');
            }
            if (!isset($org[$mgr])) {
                throw new ApiError('Choose a line manager who is already in the team.');
            }
            // Stop loops such as A reports to B and B reports to A.
            $seen = [$email => true];
            $cur = $mgr;
            while ($cur !== null) {
                if (isset($seen[$cur])) {
                    throw new ApiError('That would create a reporting loop. Check who this person and their manager report to.');
                }
                $seen[$cur] = true;
                $cur = Access::managerOf($cur);
            }
        }
        if ($email === $me['email'] && $role !== 'admin') {
            throw new ApiError('You cannot remove your own admin rights. Ask another admin to do it.');
        }

        $now = Db::now();
        Db::run(
            'INSERT INTO org_members (email, full_name, job_title, department, manager_email, role, is_finance, is_ceo, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE full_name = VALUES(full_name), job_title = VALUES(job_title),
                                     department = VALUES(department), manager_email = VALUES(manager_email),
                                     role = VALUES(role), is_finance = VALUES(is_finance), is_ceo = VALUES(is_ceo),
                                     updated_at = VALUES(updated_at)',
            [$email, $name !== '' ? $name : $email, $jobTitle !== '' ? $jobTitle : null,
             $department !== '' ? $department : null, $mgr, $role, $isFinance, $isCeo, $now, $now]
        );
        Access::forgetOrg();

        $hasAccount = Db::one('SELECT id FROM users WHERE email = ?', [$email]) !== null;
        $temp = $hasAccount ? null : Auth::issueTemporaryPassword($email);
        return [
            'note' => $hasAccount ? 'updated' : 'created',
            'temporary_password' => $temp,
            'members' => self::list($me, $in)['members'],
        ];
    }

    public static function resetPassword(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $email = $in->email('email');
        if (!isset(Access::org()[$email])) {
            throw new ApiError('That person is not in the team.', 404);
        }
        if ($email === $me['email']) {
            throw new ApiError('Change your own password from the sign-in menu instead.');
        }
        return ['temporary_password' => Auth::issueTemporaryPassword($email)];
    }

    /** Remove from the org chart. They can no longer sign in; their past records are kept. */
    public static function remove(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $email = $in->email('email');
        if ($email === $me['email']) {
            throw new ApiError('You cannot remove yourself. Ask another admin to do it.');
        }
        $reports = Db::one('SELECT COUNT(*) AS n FROM org_members WHERE manager_email = ?', [$email]);
        if ((int) $reports['n'] > 0) {
            throw new ApiError('This person still has people reporting to them. Change who those people report to first.');
        }
        Db::run('DELETE FROM org_members WHERE email = ?', [$email]);
        // End any open sessions straight away.
        Db::run('UPDATE users SET session_epoch = session_epoch + 1 WHERE email = ?', [$email]);
        Access::forgetOrg();
        return ['members' => self::list($me, $in)['members']];
    }

    private static function requireAdmin(array $me): void
    {
        if (!Access::isAdmin($me)) {
            throw new ApiError('Admins only.', 403);
        }
    }
}
