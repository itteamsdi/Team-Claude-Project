<?php
declare(strict_types=1);

/*
 * Attach a file (a receipt) to a routed form. Called by the app's JavaScript.
 * POST multipart/form-data with: submission_id, item (optional line number, 0 = first), file.
 * Signed in, password set, valid CSRF token, and only the person who submitted the form,
 * while it is still waiting for their line manager.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Api\SubmissionsApi;
use SdiHr\ApiError;
use SdiHr\Auth;
use SdiHr\Files;
use SdiHr\Http;
use SdiHr\Input;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    Http::json(405, ['ok' => false, 'error' => 'Use POST.']);
}
$me = Auth::user();
if ($me === null || $me['must_change_password']) {
    Http::json(401, ['ok' => false, 'error' => 'Your session has ended. Sign in again.', 'signed_out' => true]);
}
if (!Http::csrfValid($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    Http::json(403, ['ok' => false, 'error' => 'Your session expired. Reload the page and try again.']);
}
if (empty($_FILES) && (int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 0) {
    // PHP drops the whole request when it is bigger than post_max_size.
    Http::json(413, ['ok' => false, 'error' => 'That file is too large. The limit is 10 MB.']);
}

try {
    $in = new Input($_POST);
    $s = SubmissionsApi::loadForFiles($me, $in->id('submission_id'));
    if ($s['employee_email'] !== $me['email']) {
        throw new ApiError('Only the person who made the claim can attach receipts.', 403);
    }
    if ($s['status'] !== 'submitted') {
        throw new ApiError('Receipts can only be added while the claim is waiting for the line manager.', 409);
    }
    $item = null;
    $raw = $_POST['item'] ?? '';
    if ($raw !== '' && $raw !== null) {
        $data = json_decode((string) $s['data'], true);
        $n = is_array($data['items'] ?? null) ? count($data['items']) : 0;
        if (!is_string($raw) || !ctype_digit($raw) || (int) $raw >= $n) {
            throw new ApiError('That expense line was not found.');
        }
        $item = (int) $raw;
    }
    if (!isset($_FILES['file']) || !is_array($_FILES['file']) || is_array($_FILES['file']['name'] ?? null)) {
        throw new ApiError('Choose a file to attach.');
    }
    $file = Files::store($me, $s, $_FILES['file'], $item);
    Http::json(200, ['ok' => true, 'data' => ['file' => $file]]);
} catch (ApiError $e) {
    Http::json($e->status(), ['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('[sdi-hr] upload failed: ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    Http::json(500, ['ok' => false, 'error' => 'Something went wrong on the server. Please try again.']);
}
