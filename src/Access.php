<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Who may see or change whose records (rule agreed after initial testing, 28 Oct 2026).
 *
 *  - View:  the employee, anyone above them in the reporting line (line manager, their manager,
 *           ... up to the CEO), and the CEO. Admin rights do NOT give access to anyone's records;
 *           admin only means Manage Team, the Staff Handbook and job description approval.
 *  - Edit:  the employee or their direct line manager.
 *  - Expense claims are also visible to the finance team, who authorise and pay them.
 */
final class Access
{
    /** Form types the finance team can also see (they authorise and pay them). */
    public const FINANCE_TYPES = ['expense'];

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
     * Who may see a routed form: the usual chain-of-command rule (see canView), plus the
     * finance team for expense claims.
     */
    public static function canViewSubmission(array $me, string $type, string $employee): bool
    {
        if (in_array($type, self::FINANCE_TYPES, true) && self::isFinance($me)) {
            return true;
        }
        return self::canView($me, $employee);
    }

    /**
     * SQL condition limiting a submissions query of one type to what this person may see.
     * @return array{0:string,1:array}
     */
    public static function submissionWhere(array $me, string $type, string $column): array
    {
        if (in_array($type, self::FINANCE_TYPES, true) && self::isFinance($me)) {
            return ['1=1', []];
        }
        return self::viewableWhere($me, $column);
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
        return $employee === $me['email'] || self::isCeo($me) || self::isAboveInLine($me, $employee);
    }

    /**
     * Emails whose records this person may view.
     * @return string[]
     */
    public static function viewableEmails(array $me): array
    {
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
        return [$column . ' IN (' . Db::placeholders($emails) . ')', $emails];
    }
}
