<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Files attached to routed forms (receipts on expense claims).
 * Stored in STORAGE_DIR/uploads under a new random name, never in public/ or the repository.
 * Only PDF, JPEG and PNG files are accepted (no SVG), checked by their content, up to 10 MB each.
 */
final class Files
{
    public const MAX_BYTES = 10 * 1024 * 1024;
    public const MAX_PER_SUBMISSION = 50;
    private const TYPES = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];

    public static function dir(): string
    {
        $base = Config::get('STORAGE_DIR');
        if ($base === null) {
            throw new ApiError('File uploads are not set up on this server yet. Please tell IT (STORAGE_DIR is not set).', 503);
        }
        $dir = rtrim($base, '/\\') . '/uploads';
        if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
            error_log('[sdi-hr] could not create upload folder ' . $dir);
            throw new ApiError('Files cannot be saved on the server at the moment. Please tell IT.', 503);
        }
        return $dir;
    }

    /** Save one uploaded file ($_FILES entry) against a submission. Returns the stored row (public fields). */
    public static function store(array $me, array $submission, array $upload, ?int $itemIndex): array
    {
        $err = (int) ($upload['error'] ?? UPLOAD_ERR_NO_FILE);
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
            throw new ApiError('That file is too large. The limit is 10 MB.');
        }
        if ($err !== UPLOAD_ERR_OK || !is_uploaded_file((string) ($upload['tmp_name'] ?? ''))) {
            throw new ApiError('The file did not upload. Please try again.');
        }
        $size = (int) $upload['size'];
        if ($size <= 0 || $size > self::MAX_BYTES) {
            throw new ApiError('That file is too large. The limit is 10 MB.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file((string) $upload['tmp_name']) ?: '';
        if (!isset(self::TYPES[$mime])) {
            throw new ApiError('Only PDF, JPG and PNG files can be attached.');
        }
        $count = Db::one('SELECT COUNT(*) AS n FROM submission_files WHERE submission_id = ?', [$submission['id']]);
        if ((int) $count['n'] >= self::MAX_PER_SUBMISSION) {
            throw new ApiError('This form already has the maximum number of attachments.');
        }

        $stored = bin2hex(random_bytes(16)) . '.' . self::TYPES[$mime];
        $path = self::dir() . '/' . $stored;
        if (!move_uploaded_file((string) $upload['tmp_name'], $path)) {
            error_log('[sdi-hr] move_uploaded_file failed for ' . $path);
            throw new ApiError('The file could not be saved. Please try again.');
        }
        @chmod($path, 0600);

        $name = self::cleanName((string) ($upload['name'] ?? 'file'), self::TYPES[$mime]);
        $id = Db::uuid();
        Db::run(
            'INSERT INTO submission_files (id, submission_id, item_index, original_name, stored_name, mime_type, size_bytes, uploaded_by, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [$id, $submission['id'], $itemIndex, $name, $stored, $mime, $size, $me['email'], Db::now()]
        );
        return self::out(Db::one('SELECT * FROM submission_files WHERE id = ?', [$id]));
    }

    /** @return array<int,array> */
    public static function forSubmission(string $submissionId): array
    {
        return array_map([self::class, 'out'],
            Db::all('SELECT * FROM submission_files WHERE submission_id = ? ORDER BY item_index, created_at', [$submissionId]));
    }

    public static function find(string $id): ?array
    {
        return Db::one('SELECT * FROM submission_files WHERE id = ?', [$id]);
    }

    public static function path(array $row): string
    {
        // stored_name is always our own random hex name, but check anyway before touching the disk.
        if (!preg_match('/^[0-9a-f]{32}\.(pdf|jpg|png)$/', (string) $row['stored_name'])) {
            throw new \RuntimeException('Unexpected stored file name');
        }
        return self::dir() . '/' . $row['stored_name'];
    }

    private static function out(array $r): array
    {
        return [
            'id' => $r['id'],
            'item_index' => $r['item_index'] === null ? null : (int) $r['item_index'],
            'name' => $r['original_name'],
            'mime' => $r['mime_type'],
            'size' => (int) $r['size_bytes'],
            'uploaded_by' => $r['uploaded_by'],
        ];
    }

    /** A safe display name: no folders, no control characters, sensible length, correct extension. */
    private static function cleanName(string $name, string $ext): string
    {
        $name = basename(str_replace('\\', '/', $name));
        $name = preg_replace('/[^\p{L}\p{N} ._()\-]/u', '_', $name) ?? 'file';
        $name = trim($name, ' ._');
        $base = preg_replace('/\.[^.]*$/', '', $name) ?: 'file';
        return mb_substr($base, 0, 120, 'UTF-8') . '.' . $ext;
    }
}
