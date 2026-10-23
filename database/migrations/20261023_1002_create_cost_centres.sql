-- Cost centres offered on the expense claim form. The finance team adds, renames and deletes them.
-- Claims store the cost centre's name, so changing this list never alters past claims.
CREATE TABLE IF NOT EXISTS cost_centres (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  updated_by VARCHAR(255) NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (id),
  UNIQUE KEY uq_cost_centres_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
