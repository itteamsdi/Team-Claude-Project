<?php
declare(strict_types=1);

/*
 * Loaded first by every entry point in public/.
 * Sets safe error handling, security headers and the session, and loads the classes in src/.
 */

// Never show errors on screen; log them instead (baseline section 5).
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

set_exception_handler(static function (Throwable $e): void {
    error_log('[sdi-hr] Uncaught ' . get_class($e) . ': ' . $e->getMessage() . ' in ' . $e->getFile() . ':' . $e->getLine());
    if (!headers_sent()) {
        http_response_code(500);
    }
    $isApi = isset($_SERVER['SCRIPT_NAME']) && str_ends_with((string) $_SERVER['SCRIPT_NAME'], '/api.php');
    if ($isApi) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['ok' => false, 'error' => 'Something went wrong on the server. Please try again.']);
    } else {
        echo '<!doctype html><meta charset="utf-8"><title>SDI HR</title>'
            . '<p style="font-family:Arial,sans-serif;padding:24px">Something went wrong on the server. Please try again in a moment.</p>';
    }
});

spl_autoload_register(static function (string $class): void {
    $prefix = 'SdiHr\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $rel = str_replace('\\', '/', substr($class, strlen($prefix)));
    $file = __DIR__ . '/' . $rel . '.php';
    if (is_file($file)) {
        require $file;
    }
});

\SdiHr\Http::sendSecurityHeaders();
\SdiHr\Auth::startSession();
