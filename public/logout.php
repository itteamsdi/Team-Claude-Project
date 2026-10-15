<?php
declare(strict_types=1);

/*
 * Sign out. POST only, with the CSRF token, so another site cannot sign people out.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Auth;
use SdiHr\Http;

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    Http::redirect('index.php');
}
Http::requireFormCsrf();
Auth::logout();
Http::redirect('login.php');
