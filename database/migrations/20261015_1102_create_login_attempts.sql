-- Failed sign-in attempts, used to slow down password guessing (5 failures in 15 minutes per email and IP).
-- Rows older than a day are deleted automatically by the app.
CREATE TABLE IF NOT EXISTS login_attempts (
  id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email        VARCHAR(255) NOT NULL,
  ip           VARCHAR(45) NOT NULL,
  success      TINYINT(1) NOT NULL DEFAULT 0,
  attempted_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_login_attempts_lookup (email, ip, attempted_at),
  KEY ix_login_attempts_time (attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
