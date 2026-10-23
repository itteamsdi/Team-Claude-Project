-- Who is in the finance team and who is the CEO, set by an admin in Manage Team.
--  - Finance team: authorises payment of expense claims, marks them paid, manages cost centres,
--    and can see expense and flexible working history.
--  - CEO: can see expense and flexible working history for everyone.
ALTER TABLE org_members
  ADD COLUMN IF NOT EXISTS is_finance TINYINT(1) NOT NULL DEFAULT 0 AFTER role,
  ADD COLUMN IF NOT EXISTS is_ceo     TINYINT(1) NOT NULL DEFAULT 0 AFTER is_finance;
