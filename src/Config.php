<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Every setting comes from an environment variable (baseline section 3).
 * See README.md for the full list.
 */
final class Config
{
    public static function get(string $name, ?string $default = null): ?string
    {
        $v = getenv($name);
        if ($v === false || $v === '') {
            return $default;
        }
        return $v;
    }

    public static function require(string $name): string
    {
        $v = self::get($name);
        if ($v === null) {
            throw new \RuntimeException("Missing required environment variable $name");
        }
        return $v;
    }

    public static function env(): string
    {
        $env = self::get('APP_ENV', 'production');
        return in_array($env, ['staging', 'production'], true) ? $env : 'production';
    }

    public static function appUrl(): string
    {
        return rtrim((string) self::get('APP_URL', ''), '/');
    }
}
