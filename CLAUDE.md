PROJECT BASELINE - read this first and follow it for the whole project.

Project: SDI HR
Short name (from IT): sdi-hr
What it should do: An internal HR web app for SDI staff. Everyone uses it to read the Staff Handbook, see their job description and submit routed forms (self-certification, expense claim, flexible working request, home-working DSE assessment). Employees and line managers fill in 1-2-1 reviews together and sign them off, after which they are locked into a 1-2-1 history. Access follows the org chart: a line manager can see and act on their direct reports' records, one level above can view, and admins manage the team, the handbook and job description approvals.

1. Where the code runs
- Ubuntu 22.04 Linux server, PHP 8.3 running under php-fpm, MariaDB 10.6 database.
- Plain PHP only. No Node.js, no build steps, no Composer packages and no frameworks unless I confirm IT has approved them.
- Only use these PHP extensions: pdo_mysql, mbstring, curl, json, openssl, session, ctype, filter, fileinfo. If you need anything else, stop and tell me, so I can ask IT.
- The code is deployed by copying the Git repository to the server. Nothing is compiled or installed on deployment.

2. Folder structure (the repository root is my connected folder)
- public/  The only folder the web server can see: index.php and any other entry points, plus css/, js/ and images/.
- src/  All other PHP code (classes, functions, templates). Never reachable from the web.
- database/migrations/  Database changes as plain .sql files (see section 4).
- README.md  What the app does, every environment variable it needs, and anything IT must set up.
- CLAUDE.md  A copy of these baseline instructions. Create it now if it is missing, and read it at the start of every conversation.
- .gitignore  Must exclude .env, *.log, storage/, vendor/, node_modules/ and editor files.
- Do not create any other top-level folders without telling me why.

3. Settings and passwords
- Read every setting from environment variables with getenv(): APP_ENV (staging or production), APP_URL, DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASS.
- Never write a password, API key, token or real customer data into any file, including examples, tests and comments. If a new secret or setting is needed, add it to the README and tell me, so I can ask IT to add it on the servers.
- Writable files (uploads, cache) go in the folder named by the STORAGE_DIR environment variable, never inside public/ or the repository.

4. Database
- Connect with PDO using utf8mb4, ERRMODE_EXCEPTION and real prepared statements (ATTR_EMULATE_PREPARES false) for every query. Never build SQL by joining user input into strings.
- The app may only use its own database. Never write CREATE DATABASE, USE, GRANT, CREATE USER, or names in the form database.table.
- Every schema change is a new file in database/migrations/ named YYYYMMDD_HHMM_short_description.sql (for example 20261009_1430_create_members.sql). Files run once, in name order, automatically on deployment.
- Never edit or delete a migration after it has been pushed. Make a new one instead.
- Keep each migration small (one table or one change). Use InnoDB and utf8mb4_unicode_ci. Use CREATE TABLE IF NOT EXISTS where sensible.
- The table schema_migrations is reserved for the deployment system. Do not create, change or use it.
- SQL must work on MariaDB 10.6.

5. Security (these come from SDI's 2026 penetration test)
- Check login and permissions at the start of every page and every endpoint, including AJAX and form handlers. Nothing is public unless I say so.
- Escape all output with htmlspecialchars() (ENT_QUOTES, UTF-8). Validate all input on the server.
- Use CSRF tokens on every form and state-changing request.
- Hash passwords with password_hash() and password_verify(). Session cookies must be Secure, HttpOnly and SameSite=Lax. Regenerate the session ID on login.
- No SVG uploads. Check other uploads by type and size, give them new random names and store them in STORAGE_DIR.
- Never show errors on screen. Log them with error_log().
- No sample pages, test scripts, phpinfo(), debug code or default pages in public/.
- Do not use exec, shell_exec, system, passthru, proc_open or popen. They are disabled on the servers.

6. How we work together
- Write and change files directly in my connected folder. Never ask me to copy code by hand.
- Never connect to, or run commands on, SDI's servers, GitHub or any database. I send changes to GitHub with GitHub Desktop, and the test server updates itself.
- After each piece of work, tell me in plain English: what changed, how to check it on the staging site, and a one-line summary to use as the GitHub commit message.
- If anything needs IT (a new PHP extension, a scheduled task, sending email, a new setting or secret, more storage), say so clearly in a separate paragraph starting "FOR IT:", written so I can forward it unchanged.
- Keep README.md up to date as you go.
- Ask me before making large structural changes or removing features.

---------------------------------------------------------------------------
Project notes for future conversations (not part of the baseline above)
- Decisions agreed with Helen (15 Oct 2026): email + password sign-in stored in MariaDB (no Microsoft 365 for now);
  no email sending - admins add people and pass on a one-time password; keep the existing screens.
- The PHP version was rebuilt from the newest Supabase demo (with two-party review sign-off and 1-2-1 History).
  The Supabase/Netlify demo, its files and its data were retired on 15 Oct 2026. "Export & share" was dropped.
- Access rules live in src/Access.php; per-feature rules are in src/Api/*.php. Keep them in step with README "Access model".
- Handbook and job description HTML is cleaned on the server by src/HtmlSanitizer.php (the DOM extension is not approved).
- Initial testing fixes (23 Oct 2026, branch initial-testing): org_members gained job_title, department, is_finance, is_ceo;
  expense claims are line manager approve -> finance authorise payment -> finance mark paid, with an audit trail in manager_data.trail;
  receipts are uploaded through public/upload.php into STORAGE_DIR/uploads (src/Files.php) and served by public/file.php;
  cost centres live in the cost_centres table (finance manages them). Expense and flexible working history is visible to the
  whole reporting line above the employee, finance and the CEO (Access::canViewSubmission). All form decisions are final.
