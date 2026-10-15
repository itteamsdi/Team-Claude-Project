-- The org chart: who works here, who they report to, and who is an admin.
-- Access to reviews, forms and job descriptions is worked out from this table.
CREATE TABLE IF NOT EXISTS org_members (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(255) NOT NULL COMMENT 'Work email, stored in lower case',
  full_name     VARCHAR(200) NULL,
  manager_email VARCHAR(255) NULL COMMENT 'Who they report to. NULL = top of the org',
  role          ENUM('member','admin') NOT NULL DEFAULT 'member',
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_org_members_email (email),
  KEY ix_org_members_manager (manager_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
