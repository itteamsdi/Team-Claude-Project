-- One job description per person. `content` is the live version (only an admin changes it);
-- `pending_content` is a line manager's proposed change awaiting admin approval.
CREATE TABLE IF NOT EXISTS job_descriptions (
  employee_email  VARCHAR(255) NOT NULL,
  content         MEDIUMTEXT NULL,
  pending_content MEDIUMTEXT NULL,
  pending_by      VARCHAR(255) NULL,
  pending_at      DATETIME(6) NULL,
  updated_at      DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (employee_email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
