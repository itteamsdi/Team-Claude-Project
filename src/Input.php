<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Server-side validation of the JSON sent to api.php.
 */
final class Input
{
    public function __construct(private array $data)
    {
    }

    public function has(string $k): bool
    {
        return array_key_exists($k, $this->data);
    }

    public function str(string $k, int $max = 500, bool $required = true): string
    {
        $v = $this->data[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) {
                throw new ApiError("Missing $k.");
            }
            return '';
        }
        if (!is_string($v) && !is_int($v) && !is_float($v)) {
            throw new ApiError("$k must be text.");
        }
        $v = trim((string) $v);
        if (!mb_check_encoding($v, 'UTF-8')) {
            throw new ApiError("$k contains invalid characters.");
        }
        if (mb_strlen($v, 'UTF-8') > $max) {
            throw new ApiError("$k is too long (maximum $max characters).");
        }
        return $v;
    }

    /** True/false sent as a JSON boolean, 1/0 or "true"/"false". Missing means false. */
    public function bool(string $k): bool
    {
        $v = $this->data[$k] ?? false;
        return $v === true || $v === 1 || $v === '1' || $v === 'true';
    }

    public function email(string $k, bool $required = true): ?string
    {
        $v = Auth::normaliseEmail($this->str($k, 255, $required));
        if ($v === '') {
            return null;
        }
        // Plain addresses only, so an email can never carry quotes or markup into a page.
        if (filter_var($v, FILTER_VALIDATE_EMAIL) === false
            || !preg_match('/^[a-z0-9._%+-]+@[a-z0-9-]+(\\.[a-z0-9-]+)+$/', $v)) {
            throw new ApiError('Enter a valid email address (letters, numbers, dots and hyphens only).');
        }
        return $v;
    }

    public function id(string $k): string
    {
        $v = $this->str($k, 36);
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/', $v)) {
            throw new ApiError('That record was not found.', 404);
        }
        return $v;
    }

    public function oneOf(string $k, array $allowed): string
    {
        $v = $this->str($k, 50);
        if (!in_array($v, $allowed, true)) {
            throw new ApiError("Unexpected value for $k.");
        }
        return $v;
    }

    /** A date as YYYY-MM-DD, or null. */
    public function date(string $k): ?string
    {
        $v = $this->str($k, 10, false);
        if ($v === '') {
            return null;
        }
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $v);
        if ($d === false || $d->format('Y-m-d') !== $v) {
            throw new ApiError("$k must be a date.");
        }
        return $v;
    }

    /** A JSON object (associative array), limited in size and depth. */
    public function object(string $k, int $maxBytes = 1_000_000): array
    {
        $v = $this->data[$k] ?? null;
        if (!is_array($v) || (array_is_list($v) && $v !== [])) {
            throw new ApiError("$k must be an object.");
        }
        $json = json_encode($v, JSON_UNESCAPED_UNICODE);
        if ($json === false || strlen($json) > $maxBytes) {
            throw new ApiError('That is too much data to save in one go.', 413);
        }
        self::checkDepth($v, 0);
        return $v;
    }

    private static function checkDepth(array $v, int $depth): void
    {
        if ($depth > 12) {
            throw new ApiError('That data is nested too deeply.');
        }
        foreach ($v as $item) {
            if (is_array($item)) {
                self::checkDepth($item, $depth + 1);
            } elseif (is_string($item) && !mb_check_encoding($item, 'UTF-8')) {
                throw new ApiError('The data contains invalid characters.');
            }
        }
    }

    public function html(string $k): string
    {
        $v = $this->data[$k] ?? '';
        if (!is_string($v)) {
            throw new ApiError("$k must be text.");
        }
        return HtmlSanitizer::clean($v);
    }
}
