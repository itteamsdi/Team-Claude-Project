<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Small helpers for output escaping, CSRF tokens, redirects and JSON.
 */
final class Http
{
    public static function sendSecurityHeaders(): void
    {
        if (headers_sent()) {
            return;
        }
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('Referrer-Policy: same-origin');
        header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
        // The existing screens use inline handlers and styles, so 'unsafe-inline' is still needed.
        // Everything else is limited to this site.
        header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; "
            . "style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; "
            . "font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'");
        if (Config::env() === 'production' || Config::env() === 'staging') {
            header('Strict-Transport-Security: max-age=31536000');
        }
    }

    /** Escape for HTML output. */
    public static function e(?string $s): string
    {
        return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    public static function csrfToken(): string
    {
        if (empty($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) {
            $_SESSION['csrf'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf'];
    }

    public static function csrfValid(?string $token): bool
    {
        $known = $_SESSION['csrf'] ?? '';
        return is_string($token) && is_string($known) && $known !== '' && hash_equals($known, $token);
    }

    /** For HTML form handlers: stop unless the POSTed token matches. */
    public static function requireFormCsrf(): void
    {
        if (!self::csrfValid($_POST['csrf'] ?? null)) {
            http_response_code(400);
            echo '<!doctype html><meta charset="utf-8"><title>SDI HR</title>'
                . '<p style="font-family:Arial,sans-serif;padding:24px">Your session expired. '
                . '<a href="index.php">Go back and try again</a>.</p>';
            exit;
        }
    }

    public static function redirect(string $path): never
    {
        header('Location: ' . $path, true, 303);
        exit;
    }

    public static function json(int $status, array $body): never
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store');
        echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        exit;
    }

    public static function noCache(): void
    {
        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');
    }

    public static function clientIp(): string
    {
        return substr((string) ($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
    }
}
