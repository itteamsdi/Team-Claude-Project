<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\HtmlSanitizer;
use SdiHr\Input;

/**
 * Company-wide documents: the Staff Handbook and the job description master template.
 * Everyone signed in can read them; only admins can change them.
 * Until an admin saves a version, the default text in src/content/ is shown.
 */
final class DocsApi
{
    private const DEFAULTS = [
        'handbook' => 'handbook_default.html',
        'jd_template' => 'jd_template_default.html',
    ];

    public static function get(array $me, Input $in): array
    {
        $key = $in->oneOf('key', array_keys(self::DEFAULTS));
        return ['content' => self::content($key)];
    }

    public static function save(array $me, Input $in): array
    {
        if (!Access::isAdmin($me)) {
            throw new ApiError('Only an admin can change this document.', 403);
        }
        $key = $in->oneOf('key', array_keys(self::DEFAULTS));
        $html = $in->html('content');
        $now = Db::now();
        Db::run(
            'INSERT INTO shared_docs (doc_key, content, updated_by, updated_at) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE content = VALUES(content), updated_by = VALUES(updated_by), updated_at = VALUES(updated_at)',
            [$key, $html, $me['email'], $now]
        );
        return ['content' => $html];
    }

    public static function content(string $key): string
    {
        $row = Db::one('SELECT content FROM shared_docs WHERE doc_key = ?', [$key]);
        if ($row !== null && $row['content'] !== null && $row['content'] !== '') {
            return HtmlSanitizer::clean($row['content'], false);
        }
        $file = dirname(__DIR__) . '/content/' . self::DEFAULTS[$key];
        return is_file($file) ? HtmlSanitizer::clean((string) file_get_contents($file), false) : '';
    }
}
