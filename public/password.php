<?php
declare(strict_types=1);

/*
 * Change password. Shown automatically after signing in with a one-time password,
 * and available from the app at any time.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Auth;
use SdiHr\Http;

Http::noCache();
$me = Auth::requirePage(true);

$error = null;
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    Http::requireFormCsrf();
    $s = static fn (string $k): string => is_string($_POST[$k] ?? null) ? mb_substr($_POST[$k], 0, 201) : '';
    $error = Auth::changePassword($me, $s('current'), $s('new'), $s('confirm'));
    if ($error === null) {
        Http::redirect('index.php');
    }
}

$forced = $me['must_change_password'];
$title = 'Change password';
require dirname(__DIR__) . '/src/templates/password.php';
