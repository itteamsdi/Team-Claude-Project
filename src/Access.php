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
 *
 * Routed forms have their own view rule (see canViewSubmission): expense claims and
 * flexible working requests are also visible to everyone above the employee in the
 * reporting line, the finance team and the CEO, so there is a full audit trail.
 */
final class Access
{
    /** Form types whose history is open to the whole reporting line, finance and the CEO. */
    public const AUDIT_TYPES = ['expense', 'flex_work'];

    /** @var array<string,array{email:string,full_name:?string,manager_email:?string,role:string,is_finance:int,is_ceo:int}>|null */
    private static ?array $org = null;

    /** The whole org chart, keyed by email. Loaded once per request. */
    public static function org(): array
    {
        if (self::$org === null) {
            self::$org = [];
            foreach (Db::all('SELECT email, full_name, manager_email, role, is_finance, is_ceo FROM org_members') as $r) {
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

    public static function isFinance(array $me): bool
    {
        return (int) (self::org()[$me['email']]['is_finance'] ?? 0) === 1;
    }

    public static function isCeo(array $me): bool
    {
        return (int) (self::org()[$me['email']]['is_ceo'] ?? 0) === 1;
    }

    /** True if $me is anywhere above $employee in the reporting line (line manager, their manager, ...). */
    public static function isAboveInLine(array $me, string $employee): bool
    {
        $seen = [];
        $cur = self::managerOf($employee);
        while ($cur !== null && !isset($seen[$cur])) {
            if ($cur === $me['email']) {
                return true;
            }
            $seen[$cur] = true;
            $cur = self::managerOf($cur);
        }
        return false;
    }

    /**
     * Who may see a routed form.
     *  - Expense claims and flexible working requests: the employee, anyone above them in the
     *    reporting line, the finance team, the CEO and admins.
     *  - Self-certification and DSE: the usual rule (employee, line manager, one level above, admin).
     */
    public static function canViewSubmission(array $me, string $type, string $employee): bool
    {
        if (in_array($type, self::AUDIT_TYPES, true)) {
            return $employee === $me['email'] || self::isAdmin($me) || self::isCeo($me)
                || self::isFinance($me) || self::isAboveInLine($me, $employee);
        }
        return self::canView($me, $employee);
    }

    /**
     * SQL condition limiting a submissions query of one type to what this person may see.
     * @return array{0:string,1:array}
     */
    public static function submissionWhere(array $me, string $type, string $column): array
    {
        if (!in_array($type, self::AUDIT_TYPES, true)) {
            return self::viewableWhere($me, $column);
        }
        if (self::isAdmin($me) || self::isCeo($me) || self::isFinance($me)) {
            return ['1=1', []];
        }
        $emails = [$me['email']];
        foreach (self::org() as $email => $_) {
            if ($email !== $me['email'] && self::isAboveInLine($me, $email)) {
                $emails[] = $email;
            }
        }
        return [$column . ' IN (' . Db::placeholders($emails) . ')', $emails];
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
