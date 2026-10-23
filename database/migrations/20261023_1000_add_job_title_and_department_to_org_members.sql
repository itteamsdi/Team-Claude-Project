-- Job title and department for each person, set by an admin in Manage Team.
-- Used to fill in the Flexible Working Request and DSE Self-Assessment automatically.
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS job_title  VARCHAR(200) NULL AFTER full_name,
  ADD COLUMN IF NOT EXISTS department VARCHAR(200) NULL AFTER job_title;
