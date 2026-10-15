<?php
declare(strict_types=1);

/*
 * The app. Signed-in staff only.
 */

require dirname(__DIR__) . '/src/bootstrap.php';

use SdiHr\Access;
use SdiHr\Auth;
use SdiHr\Http;

Http::noCache();
$me = Auth::requirePage();

$boot = [
    'email' => $me['email'],
    'name' => $me['full_name'] !== '' ? $me['full_name'] : $me['email'],
    'isAdmin' => Access::isAdmin($me),
];

require dirname(__DIR__) . '/src/templates/app.php';
