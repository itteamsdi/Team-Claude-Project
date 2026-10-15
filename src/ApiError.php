<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * An error whose message is safe to show to the person using the app
 * (for example "This review is signed off and locked.").
 */
final class ApiError extends \RuntimeException
{
    public function __construct(string $message, private int $status = 400)
    {
        parent::__construct($message);
    }

    public function status(): int
    {
        return $this->status;
    }
}
