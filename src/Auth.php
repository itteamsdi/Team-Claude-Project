<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Sign-in, sessions and passwords.
 *
 * A person can sign in only if they have an account in `users` AND are still in the
 * org chart (`org_members`). Removing someone from the team therefore stops their access.
 */
final class Auth
{
    public const MIN_PASSWORD_LENGTH = 10;
    private const MAX_FAILED_ATTEMPTS = 5;     // per email + IP address ...
    private const MAX_FAILED_PER_IP = 30;      // ... and per IP address across all emails ...
    private const LOCKOUT_MINUTES = 15;        // ... within this many minutes
    private const IDLE_TIMEOUT_SECONDS = 8 * 3600;

    private static ?array $current = null;
    private static bool $loaded = false;

    public static function startSession(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            return;
        }
        ini_set('session.use_strict_mode', '1');
        ini_set('session.use_only_cookies', '1');
        ini_set('session.gc_maxlifetime', (string) self::IDLE_TIMEOUT_SECONDS);
        // With STORAGE_DIR set, keep this app's sessions in their own folder, so the
        // server-wide session clean-up (and other sites on a shared php-fpm) leave them alone.
        $storage = Config::get('STORAGE_DIR');
        if ($storage !== null) {
            $dir = rtrim($storage, '/') . '/sessions';
            if (!is_dir($dir)) {
                @mkdir($dir, 0700, true);
            }
            if (is_dir($dir) && is_writable($dir)) {
                session_save_path($dir);
                ini_set('session.gc_probability', '1');
                ini_set('session.gc_divisor', '100');
            } else {
                error_log('[sdi-hr] STORAGE_DIR/sessions is not writable; using the default session folder.');
            }
        }
        session_name('sdihr_session');
        session_set_cookie_params([
            'lifetime' => 0,
            'path' => '/',
            'secure' => true,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
        session_start();
    }

    /**
     * The signed-in person, or null. Re-checked against the database on every request,
     * so a removed person or a reset password ends existing sessions straight away.
     *
     * @return array{id:int,email:string,full_name:string,role:string,must_change_password:bool}|null
     */
    public static function user(): ?array
    {
        if (self::$loaded) {
            return self::$current;
        }
        self::$loaded = true;
        $uid = $_SESSION['uid'] ?? null;
        if (!is_int($uid)) {
            return null;
        }
        $last = $_SESSION['last_seen'] ?? 0;
        if (!is_int($last) || time() - $last > self::IDLE_TIMEOUT_SECONDS) {
            self::logout();
            return null;
        }
        $row = Db::one(
            'SELECT u.id, u.email, u.must_change_password, u.session_epoch, o.full_name, o.role
               FROM users u JOIN org_members o ON o.email = u.email
              WHERE u.id = ?',
            [$uid]
        );
        if ($row === null || (int) $row['session_epoch'] !== ($_SESSION['epoch'] ?? -1)) {
            self::logout();
            return null;
        }
        $_SESSION['last_seen'] = time();
        self::$current = [
            'id' => (int) $row['id'],
            'email' => (string) $row['email'],
            'full_name' => (string) ($row['full_name'] ?? ''),
            'role' => (string) $row['role'],
            'must_change_password' => (bool) $row['must_change_password'],
        ];
        return self::$current;
    }

    /** For pages: send the visitor to the sign-in page unless signed in (and password set). */
    public static function requirePage(bool $allowPasswordChange = false): array
    {
        $u = self::user();
        if ($u === null) {
            Http::redirect('login.php');
        }
        if ($u['must_change_password'] && !$allowPasswordChange) {
            Http::redirect('password.php');
        }
        return $u;
    }

    public static function normaliseEmail(string $email): string
    {
        return mb_strtolower(trim($email), 'UTF-8');
    }

    /** Returns null on success, or a message to show. */
    public static function attemptLogin(string $email, string $password): ?string
    {
        $email = self::normaliseEmail($email);
        $generic = 'That email and password do not match an account. Check them and try again.';
        if ($email === '' || $password === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            return 'Enter your work email and password.';
        }
        if (self::isLockedOut($email)) {
            return 'Too many attempts. Wait ' . self::LOCKOUT_MINUTES . ' minutes and try again, or ask an admin to reset your password.';
        }

        self::bootstrapFirstAdmin($email, $password);

        $row = Db::one(
            'SELECT u.id, u.password_hash, u.session_epoch, u.must_change_password FROM users u
               JOIN org_members o ON o.email = u.email WHERE u.email = ?',
            [$email]
        );
        // Always run password_verify, so a missing account takes as long as a wrong password.
        $hash = $row['password_hash'] ?? '$2y$10$F58fMd.PeRIeb6B7cMs0VeuaJ9TDQxasfaITMrgHKwF77wUZX.lkS';
        $ok = password_verify($password, $hash) && $row !== null;
        // One-time passwords are often copied with a stray space; they never contain spaces.
        if (!$ok && $row !== null && (int) $row['must_change_password'] === 1 && trim($password) !== $password) {
            $ok = password_verify(trim($password), $hash);
        }
        self::recordAttempt($email, $ok);
        if (!$ok) {
            return $generic;
        }
        if (password_needs_rehash($row['password_hash'], PASSWORD_DEFAULT)) {
            Db::run('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($password, PASSWORD_DEFAULT), $row['id']]);
        }
        session_regenerate_id(true);
        $_SESSION = [];
        $_SESSION['uid'] = (int) $row['id'];
        $_SESSION['epoch'] = (int) $row['session_epoch'];
        $_SESSION['last_seen'] = time();
        Http::csrfToken();
        Db::run('UPDATE users SET last_login_at = ? WHERE id = ?', [Db::now(), $row['id']]);
        self::$loaded = false;
        return null;
    }

    public static function logout(): void
    {
        $_SESSION = [];
        if (session_status() === PHP_SESSION_ACTIVE) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', [
                'expires' => time() - 3600, 'path' => $p['path'], 'secure' => true,
                'httponly' => true, 'samesite' => 'Lax',
            ]);
            session_destroy();
        }
        self::$current = null;
        self::$loaded = true;
    }

    /** Returns null on success, or a message to show. */
    public static function changePassword(array $user, string $current, string $new, string $confirm): ?string
    {
        $row = Db::one('SELECT password_hash FROM users WHERE id = ?', [$user['id']]);
        if ($row !== null && $user['must_change_password'] && !password_verify($current, $row['password_hash'])) {
            $current = trim($current); // one-time passwords never contain spaces
        }
        if ($row === null || !password_verify($current, $row['password_hash'])) {
            return 'Your current password is not right. Check it and try again.';
        }
        $problem = self::passwordProblem($new, $user['email']);
        if ($problem !== null) {
            return $problem;
        }
        if ($new !== $confirm) {
            return 'The two new passwords do not match.';
        }
        if (password_verify($new, $row['password_hash'])) {
            return 'Choose a new password that is different from the current one.';
        }
        Db::run(
            'UPDATE users SET password_hash = ?, must_change_password = 0, session_epoch = session_epoch + 1, updated_at = ? WHERE id = ?',
            [password_hash($new, PASSWORD_DEFAULT), Db::now(), $user['id']]
        );
        // Keep this browser signed in; other sessions for this person end.
        $epoch = (int) Db::one('SELECT session_epoch FROM users WHERE id = ?', [$user['id']])['session_epoch'];
        session_regenerate_id(true);
        $_SESSION['epoch'] = $epoch;
        self::$loaded = false;
        return null;
    }

    public static function passwordProblem(string $pw, string $email): ?string
    {
        if (mb_strlen($pw, 'UTF-8') < self::MIN_PASSWORD_LENGTH) {
            return 'Use at least ' . self::MIN_PASSWORD_LENGTH . ' characters for your new password.';
        }
        if (mb_strlen($pw, 'UTF-8') > 200) {
            return 'That password is too long. Use 200 characters or fewer.';
        }
        if (self::normaliseEmail($pw) === self::normaliseEmail($email)) {
            return 'Your password cannot be your email address.';
        }
        return null;
    }

    /** A one-time password an admin passes on to a new starter. */
    public static function generateTemporaryPassword(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        $out = '';
        for ($i = 0; $i < 14; $i++) {
            $out .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            if ($i === 3 || $i === 8) {
                $out .= '-';
            }
        }
        return $out;
    }

    /** Create or reset a sign-in account. Returns the one-time password. */
    public static function issueTemporaryPassword(string $email): string
    {
        $temp = self::generateTemporaryPassword();
        $hash = password_hash($temp, PASSWORD_DEFAULT);
        $now = Db::now();
        Db::run(
            'INSERT INTO users (email, password_hash, must_change_password, session_epoch, created_at, updated_at)
             VALUES (?, ?, 1, 0, ?, ?)
             ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), must_change_password = 1,
                                     session_epoch = session_epoch + 1, updated_at = VALUES(updated_at)',
            [$email, $hash, $now, $now]
        );
        Db::run('DELETE FROM login_attempts WHERE email = ?', [$email]);
        return $temp;
    }

    /**
     * First run only: while there are no accounts at all, BOOTSTRAP_ADMIN_EMAIL can sign in
     * with BOOTSTRAP_ADMIN_PASSWORD. This creates the first admin, who must then choose a
     * new password. Once any account exists, these settings are ignored.
     */
    private static function bootstrapFirstAdmin(string $email, string $password): void
    {
        $bEmail = Config::get('BOOTSTRAP_ADMIN_EMAIL');
        $bPass = Config::get('BOOTSTRAP_ADMIN_PASSWORD');
        if ($bEmail === null || $bPass === null || self::normaliseEmail($bEmail) !== $email) {
            return;
        }
        if (!hash_equals($bPass, $password)) {
            return;
        }
        $count = (int) Db::one('SELECT COUNT(*) AS n FROM users')['n'];
        if ($count > 0) {
            return;
        }
        $now = Db::now();
        Db::run(
            "INSERT INTO org_members (email, full_name, manager_email, role, created_at, updated_at)
             VALUES (?, ?, NULL, 'admin', ?, ?)
             ON DUPLICATE KEY UPDATE role = 'admin', updated_at = VALUES(updated_at)",
            [$email, $email, $now, $now]
        );
        Db::run(
            'INSERT INTO users (email, password_hash, must_change_password, session_epoch, created_at, updated_at)
             VALUES (?, ?, 1, 0, ?, ?)',
            [$email, password_hash($password, PASSWORD_DEFAULT), $now, $now]
        );
        error_log('[sdi-hr] First admin account created from BOOTSTRAP_ADMIN_EMAIL.');
    }

    private static function isLockedOut(string $email): bool
    {
        $since = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))
            ->modify('-' . self::LOCKOUT_MINUTES . ' minutes')->format('Y-m-d H:i:s');
        $row = Db::one(
            'SELECT SUM(email = ?) AS same_email, COUNT(*) AS all_emails
               FROM login_attempts WHERE ip = ? AND success = 0 AND attempted_at > ?',
            [$email, Http::clientIp(), $since]
        );
        return (int) ($row['same_email'] ?? 0) >= self::MAX_FAILED_ATTEMPTS
            || (int) ($row['all_emails'] ?? 0) >= self::MAX_FAILED_PER_IP;
    }

    private static function recordAttempt(string $email, bool $success): void
    {
        if ($success) {
            Db::run('DELETE FROM login_attempts WHERE email = ? AND ip = ?', [$email, Http::clientIp()]);
            return;
        }
        Db::run(
            'INSERT INTO login_attempts (email, ip, success, attempted_at) VALUES (?, ?, 0, ?)',
            [mb_substr($email, 0, 255), Http::clientIp(), Db::now()]
        );
        // Keep the table small.
        Db::run('DELETE FROM login_attempts WHERE attempted_at < ?', [
            (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))->modify('-1 day')->format('Y-m-d H:i:s'),
        ]);
    }
}
