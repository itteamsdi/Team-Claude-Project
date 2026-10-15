<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\HtmlSanitizer;
use SdiHr\Input;

/**
 * Job descriptions, one per person.
 *  - View: anyone who can view the employee.
 *  - Propose a change: the direct line manager (goes to pending, awaiting admin approval).
 *  - Publish, approve, reject: admin only. Only an admin can ever change the live text.
 */
final class JobDescriptionsApi
{
    public static function get(array $me, Input $in): array
    {
        $emp = $in->email('employee_email');
        if (!Access::canView($me, $emp)) {
            throw new ApiError('You do not have access to that job description.', 403);
        }
        $r = Db::one('SELECT employee_email, content, pending_content, pending_by, pending_at, updated_at FROM job_descriptions WHERE employee_email = ?', [$emp]);
        if ($r === null) {
            return ['item' => null];
        }
        // Unapproved drafts are shown only to the line manager who can propose them and to admins.
        $seesDraft = Access::isLineManagerOf($me, $emp) || Access::isAdmin($me);
        return ['item' => [
            'employee_email' => $r['employee_email'],
            'content' => HtmlSanitizer::clean((string) $r['content'], false),
            'pending_content' => $r['pending_content'] === null ? null
                : ($seesDraft ? HtmlSanitizer::clean($r['pending_content'], false) : '(awaiting approval)'),
            'pending_by' => $seesDraft ? $r['pending_by'] : null,
            'pending_at' => ReviewsApi::ts($r['pending_at']),
        ]];
    }

    public static function pending(array $me, Input $in): array
    {
        self::requireAdmin($me);
        return ['items' => Db::all('SELECT employee_email, pending_by FROM job_descriptions WHERE pending_content IS NOT NULL ORDER BY pending_at')];
    }

    public static function submit(array $me, Input $in): array
    {
        $emp = $in->email('employee_email');
        if (!Access::isLineManagerOf($me, $emp) && !Access::isAdmin($me)) {
            throw new ApiError("Only this person's line manager can propose changes to their job description.", 403);
        }
        $html = $in->html('content');
        $now = Db::now();
        Db::run(
            "INSERT INTO job_descriptions (employee_email, content, pending_content, pending_by, pending_at, updated_at)
             VALUES (?, '', ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE pending_content = VALUES(pending_content), pending_by = VALUES(pending_by),
                                     pending_at = VALUES(pending_at), updated_at = VALUES(updated_at)",
            [$emp, $html, $me['email'], $now, $now]
        );
        return ['submitted' => true];
    }

    public static function publish(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $emp = $in->email('employee_email');
        self::requireInOrg($emp);
        $html = $in->html('content');
        $now = Db::now();
        Db::run(
            'INSERT INTO job_descriptions (employee_email, content, pending_content, pending_by, pending_at, updated_at)
             VALUES (?, ?, NULL, NULL, NULL, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content), pending_content = NULL, pending_by = NULL,
                                     pending_at = NULL, updated_at = VALUES(updated_at)',
            [$emp, $html, $now]
        );
        return ['published' => true];
    }

    public static function approve(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $emp = $in->email('employee_email');
        $n = Db::run(
            'UPDATE job_descriptions SET content = pending_content, pending_content = NULL, pending_by = NULL,
                    pending_at = NULL, updated_at = ? WHERE employee_email = ? AND pending_content IS NOT NULL',
            [Db::now(), $emp]
        )->rowCount();
        return ['approved' => $n > 0];
    }

    public static function reject(array $me, Input $in): array
    {
        self::requireAdmin($me);
        $emp = $in->email('employee_email');
        Db::run(
            'UPDATE job_descriptions SET pending_content = NULL, pending_by = NULL, pending_at = NULL, updated_at = ? WHERE employee_email = ?',
            [Db::now(), $emp]
        );
        return ['rejected' => true];
    }

    private static function requireAdmin(array $me): void
    {
        if (!Access::isAdmin($me)) {
            throw new ApiError('Only an admin can do this.', 403);
        }
    }

    private static function requireInOrg(string $email): void
    {
        if (!isset(Access::org()[$email])) {
            throw new ApiError('That person is not in the team.', 404);
        }
    }
}
