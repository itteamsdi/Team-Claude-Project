<?php
declare(strict_types=1);

/*
 * Sign-in page. The only page that works without being signed in.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Auth;
use SdiHr\Http;

Http::noCache();

$u = Auth::user();
if ($u !== null) {
    Http::redirect($u['must_change_password'] ? 'password.php' : 'index.php');
}

$error = null;
$email = '';
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    Http::requireFormCsrf();
    $email = is_string($_POST['email'] ?? null) ? mb_substr($_POST['email'], 0, 255) : '';
    $password = is_string($_POST['password'] ?? null) ? mb_substr($_POST['password'], 0, 200) : '';
    $error = Auth::attemptLogin($email, $password);
    if ($error === null) {
        $u = Auth::user();
        Http::redirect(($u !== null && $u['must_change_password']) ? 'password.php' : 'index.php');
    }
}

$title = 'Sign in';
require dirname(__DIR__) . '/src/templates/login.php';
