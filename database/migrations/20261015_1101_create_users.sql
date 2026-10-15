-- Sign-in accounts. Replaces Supabase Auth. Passwords are stored only as password_hash() hashes.
-- session_epoch goes up when a password is reset or a person is removed, which ends their open sessions.
CREATE TABLE IF NOT EXISTS users (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email                VARCHAR(255) NOT NULL COMMENT 'Matches org_members.email',
  password_hash        VARCHAR(255) NOT NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 1,
  session_epoch        INT UNSIGNED NOT NULL DEFAULT 0,
  last_login_at        DATETIME(6) NULL,
  created_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at           DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
