-- Files attached to a routed form, such as receipts on an expense claim.
-- The file itself is stored under STORAGE_DIR/uploads with a random name; only its details are kept here.
-- item_index links a receipt to a line on the claim (0 = first line). NULL = the whole claim.
CREATE TABLE IF NOT EXISTS submission_files (
  id            CHAR(36) NOT NULL,
  submission_id CHAR(36) NOT NULL,
  item_index    SMALLINT UNSIGNED NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name   VARCHAR(80) NOT NULL,
  mime_type     VARCHAR(100) NOT NULL,
  size_bytes    INT UNSIGNED NOT NULL,
  uploaded_by   VARCHAR(255) NOT NULL,
  created_at    DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_submission_files_stored (stored_name),
  KEY ix_submission_files_submission (submission_id),
  CONSTRAINT fk_submission_files_submission FOREIGN KEY (submission_id) REFERENCES submissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
