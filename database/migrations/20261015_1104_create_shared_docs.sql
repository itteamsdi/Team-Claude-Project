-- Company-wide documents edited by admins: 'handbook' and 'jd_template'.
-- Until a row exists, the app shows the default text in src/content/.
CREATE TABLE IF NOT EXISTS shared_docs (
  doc_key    VARCHAR(64) NOT NULL,
  content    MEDIUMTEXT NULL,
  updated_by VARCHAR(255) NULL,
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (doc_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
