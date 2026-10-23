<?php
declare(strict_types=1);

/*
 * JSON endpoint used by the app's JavaScript.
 * Every call: POST, signed in, password set, valid CSRF token. Permissions are then
 * checked inside each action (see src/Access.php).
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Api\CostCentresApi;
use SdiHr\Api\DocsApi;
use SdiHr\Api\JobDescriptionsApi;
use SdiHr\Api\OrgApi;
use SdiHr\Api\ReviewsApi;
use SdiHr\Api\SubmissionsApi;
use SdiHr\ApiError;
use SdiHr\Auth;
use SdiHr\Http;
use SdiHr\Input;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    Http::json(405, ['ok' => false, 'error' => 'Use POST.']);
}

$me = Auth::user();
if ($me === null) {
    Http::json(401, ['ok' => false, 'error' => 'Your session has ended. Sign in again.', 'signed_out' => true]);
}
if ($me['must_change_password']) {
    Http::json(403, ['ok' => false, 'error' => 'Choose a new password before continuing.', 'signed_out' => true]);
}
if (!Http::csrfValid($_SERVER['HTTP_X_CSRF_TOKEN'] ?? null)) {
    Http::json(403, ['ok' => false, 'error' => 'Your session expired. Reload the page and try again.']);
}
if (!str_starts_with(strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? '')), 'application/json')) {
    Http::json(415, ['ok' => false, 'error' => 'Send JSON.']);
}

$raw = file_get_contents('php://input', false, null, 0, 6_000_001);
if ($raw === false || strlen($raw) > 6_000_000) {
    Http::json(413, ['ok' => false, 'error' => 'That is too much data to send in one go.']);
}
$body = json_decode($raw, true, 64);
if (!is_array($body) || !isset($body['action']) || !is_string($body['action'])) {
    Http::json(400, ['ok' => false, 'error' => 'Bad request.']);
}

$routes = [
    'org.list' => [OrgApi::class, 'list'],
    'org.save' => [OrgApi::class, 'save'],
    'org.remove' => [OrgApi::class, 'remove'],
    'org.resetPassword' => [OrgApi::class, 'resetPassword'],

    'reviews.list' => [ReviewsApi::class, 'list'],
    'reviews.get' => [ReviewsApi::class, 'get'],
    'reviews.create' => [ReviewsApi::class, 'create'],
    'reviews.save' => [ReviewsApi::class, 'save'],
    'reviews.delete' => [ReviewsApi::class, 'delete'],
    'reviews.sign' => [ReviewsApi::class, 'sign'],
    'reviews.unsign' => [ReviewsApi::class, 'unsign'],
    'reviews.reopen' => [ReviewsApi::class, 'reopen'],

    'docs.get' => [DocsApi::class, 'get'],
    'docs.save' => [DocsApi::class, 'save'],

    'jd.get' => [JobDescriptionsApi::class, 'get'],
    'jd.pending' => [JobDescriptionsApi::class, 'pending'],
    'jd.submit' => [JobDescriptionsApi::class, 'submit'],
    'jd.publish' => [JobDescriptionsApi::class, 'publish'],
    'jd.approve' => [JobDescriptionsApi::class, 'approve'],
    'jd.reject' => [JobDescriptionsApi::class, 'reject'],

    'submissions.list' => [SubmissionsApi::class, 'list'],
    'submissions.get' => [SubmissionsApi::class, 'get'],
    'submissions.create' => [SubmissionsApi::class, 'create'],
    'submissions.decide' => [SubmissionsApi::class, 'decide'],
    'submissions.saveManagerSection' => [SubmissionsApi::class, 'saveManagerSection'],
    'submissions.expenseAction' => [SubmissionsApi::class, 'expenseAction'],

    'costCentres.list' => [CostCentresApi::class, 'list'],
    'costCentres.save' => [CostCentresApi::class, 'save'],
    'costCentres.remove' => [CostCentresApi::class, 'remove'],
];

$route = $routes[$body['action']] ?? null;
if ($route === null) {
    Http::json(404, ['ok' => false, 'error' => 'Unknown action.']);
}

try {
    $result = call_user_func($route, $me, new Input($body));
    Http::json(200, ['ok' => true, 'data' => $result]);
} catch (ApiError $e) {
    Http::json($e->status(), ['ok' => false, 'error' => $e->getMessage()]);
} catch (Throwable $e) {
    error_log('[sdi-hr] api ' . $body['action'] . ' failed: ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    Http::json(500, ['ok' => false, 'error' => 'Something went wrong on the server. Please try again.']);
}
