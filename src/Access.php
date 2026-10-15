<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Who may see or change whose records. These replace the Supabase row-level-security
 * functions (is_admin, can_view_employee, can_edit_employee, is_line_manager_of).
 *
 *  - View:  the employee, their direct line manager, ONE level above that, or an admin.
 *  - Edit:  the employee or their direct line manager.
 *  - Admin: everything that is admin-only (team, handbook, JD approval).
 */
final class Access
{
    /** @var array<string,array{email:string,full_name:?string,manager_email:?string,role:string}>|null */
    private static ?array $org = null;

    /** The whole org chart, keyed by email. Loaded once per request. */
    public static function org(): array
    {
        if (self::$org === null) {
            self::$org = [];
            foreach (Db::all('SELECT email, full_name, manager_email, role FROM org_members') as $r) {
                self::$org[$r['email']] = $r;
            }
        }
        return self::$org;
    }

    public static function forgetOrg(): void
    {
        self::$org = null;
    }

    public static function managerOf(string $email): ?string
    {
        $m = self::org()[$email]['manager_email'] ?? null;
        return ($m === null || $m === '') ? null : $m;
    }

    public static function isAdmin(array $me): bool
    {
        return (self::org()[$me['email']]['role'] ?? '') === 'admin';
    }

    public static function isLineManagerOf(array $me, string $employee): bool
    {
        return self::managerOf($employee) === $me['email'];
    }

    public static function canEdit(array $me, string $employee): bool
    {
        return $employee === $me['email'] || self::isLineManagerOf($me, $employee);
    }

    public static function canView(array $me, string $employee): bool
    {
        if ($employee === $me['email'] || self::isAdmin($me)) {
            return true;
        }
        $mgr = self::managerOf($employee);
        if ($mgr === null) {
            return false;
        }
        return $mgr === $me['email'] || self::managerOf($mgr) === $me['email'];
    }

    /**
     * Emails whose records this person may view, or null meaning "everyone" (admin).
     * @return string[]|null
     */
    public static function viewableEmails(array $me): ?array
    {
        if (self::isAdmin($me)) {
            return null;
        }
        $out = [$me['email']];
        foreach (self::org() as $email => $_) {
            if ($email !== $me['email'] && self::canView($me, $email)) {
                $out[] = $email;
            }
        }
        return $out;
    }

    /**
     * SQL condition (and its parameters) limiting a query to viewable employees.
     * @return array{0:string,1:array}
     */
    public static function viewableWhere(array $me, string $column): array
    {
        $emails = self::viewableEmails($me);
        if ($emails === null) {
            return ['1=1', []];
        }
        return [$column . ' IN (' . Db::placeholders($emails) . ')', $emails];
    }
}
