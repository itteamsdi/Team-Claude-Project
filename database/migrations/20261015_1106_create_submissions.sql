-- Routed forms: self-certification, expense claim, flexible working request and DSE assessment.
-- `data` is the employee's form; `manager_data` is the line manager's section or decision.
CREATE TABLE IF NOT EXISTS submissions (
  id             CHAR(36) NOT NULL,
  type           VARCHAR(20) NOT NULL CHECK (type IN ('self_cert','expense','flex_work','dse')),
  employee_email VARCHAR(255) NOT NULL,
  owner_user_id  INT UNSIGNED NULL,
  data           LONGTEXT NOT NULL CHECK (JSON_VALID(data)),
  manager_data   LONGTEXT NOT NULL CHECK (JSON_VALID(manager_data)),
  status         VARCHAR(20) NOT NULL DEFAULT 'submitted' COMMENT 'submitted | authorised | rejected | approved | trial | declined | reviewed',
  submitted_at   DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  decided_by     VARCHAR(255) NULL,
  decided_at     DATETIME(6) NULL,
  updated_at     DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  KEY ix_submissions_type_employee (type, employee_email),
  KEY ix_submissions_submitted (submitted_at),
  CONSTRAINT fk_submissions_owner FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
