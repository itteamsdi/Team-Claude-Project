-- 1-2-1 reviews. `state` holds the whole review as JSON, as in the Supabase version.
-- Sign-off: when both the employee and the line manager have signed, status becomes 'Complete'
-- and the review is locked (enforced in src/Api/ReviewsApi.php).
CREATE TABLE IF NOT EXISTS reviews (
  id                 CHAR(36) NOT NULL,
  owner_user_id      INT UNSIGNED NULL COMMENT 'Account that created the review',
  employee_name      VARCHAR(200) NULL,
  employee_email     VARCHAR(255) NOT NULL,
  manager_name       VARCHAR(200) NULL,
  manager_email      VARCHAR(255) NULL,
  review_date        DATE NULL,
  status             VARCHAR(20) NOT NULL DEFAULT 'Open',
  state              LONGTEXT NOT NULL CHECK (JSON_VALID(state)),
  employee_signed_at DATETIME(6) NULL,
  employee_signed_by VARCHAR(255) NULL,
  manager_signed_at  DATETIME(6) NULL,
  manager_signed_by  VARCHAR(255) NULL,
  completed_at       DATETIME(6) NULL,
  reopened_at        DATETIME(6) NULL,
  reopened_by        VARCHAR(255) NULL,
  created_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at         DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_reviews_employee (employee_email),
  KEY ix_reviews_manager (manager_email),
  KEY ix_reviews_updated (updated_at),
  CONSTRAINT fk_reviews_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
