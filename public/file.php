<?php
declare(strict_types=1);

/*
 * Download or view an attached file. GET file.php?id=<file id>.
 * Signed in, and only people who may see the form it belongs to.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Api\SubmissionsApi;
use SdiHr\ApiError;
use SdiHr\Auth;
use SdiHr\Files;
use SdiHr\Http;

$fail = static function (int $code, string $msg): never {
    http_response_code($code);
    header('Content-Type: text/html; charset=utf-8');
    echo '<!doctype html><meta charset="utf-8"><title>SDI HR</title><p style="font-family:Arial,sans-serif;padding:24px">'
        . Http::e($msg) . '</p>';
    exit;
};

$me = Auth::user();
if ($me === null || $me['must_change_password']) {
    Http::redirect('login.php');
}
$id = (string) ($_GET['id'] ?? '');
if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $id)) {
    $fail(404, 'That file was not found.');
}
try {
    $row = Files::find($id);
    if ($row === null) {
        $fail(404, 'That file was not found.');
    }
    SubmissionsApi::loadForFiles($me, $row['submission_id']); // throws unless this person may see the form
    $path = Files::path($row);
    if (!is_file($path)) {
        error_log('[sdi-hr] attached file missing on disk: ' . $row['stored_name']);
        $fail(404, 'That file is no longer available.');
    }
} catch (ApiError $e) {
    $fail($e->status() === 503 ? 503 : 404, $e->status() === 503 ? $e->getMessage() : 'That file was not found, or you do not have access to it.');
}

$name = (string) $row['original_name'];
$ascii = preg_replace('/[^A-Za-z0-9._() -]/', '_', $name);
Http::noCache();
header('Content-Type: ' . $row['mime_type']);
header('Content-Length: ' . (string) filesize($path));
header("Content-Disposition: inline; filename=\"$ascii\"; filename*=UTF-8''" . rawurlencode($name));
if ($row['mime_type'] !== 'application/pdf') {
    // Images open in a locked-down page. (A sandbox would stop the browser's PDF viewer, so PDFs keep the site's normal policy.)
    header("Content-Security-Policy: sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'");
}
readfile($path);
