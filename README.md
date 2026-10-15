# SDI HR

An internal HR web app for SDI staff, in plain PHP 8.3 with a MariaDB 10.6 database.

- **Staff Handbook**: company policies with a contents sidebar. Admins edit it.
- **Job Description**: one per person. The line manager proposes changes; an admin approves them before they go live.
- **Routed forms**: Self-Certification, Expense Claim (mileage at 35p per mile), Flexible Working Request and Home Working DSE Self-Assessment. The employee submits; their line manager authorises, decides or reviews.
- **1-2-1 Review**: the employee and line manager fill in a structured review together. Both sign it off, which locks it.
- **1-2-1 History** and **Follow-Up to 1-2-1**: signed-off reviews, and the actions agreed in the open review.
- **Manage Team** (admins): add people, set who they report to, give admin rights and issue one-time passwords.

This replaces the earlier Supabase + Netlify demo (`sdi-121-demo-deploy/` and `sdi-121-backend/` in this repository). The screens are the same. Sign-in, storage and all permission checks now happen on SDI's own server.

## Folders

| Folder | What it holds |
|---|---|
| `public/` | The web root. Entry points `index.php` (the app), `login.php`, `password.php`, `logout.php` and `api.php` (the JSON endpoint the app's JavaScript calls), plus `css/` and `js/`. |
| `src/` | PHP classes and templates. Not reachable from the web. `Access.php` holds the access rules; `Api/` holds one file per feature. |
| `src/content/` | Default Staff Handbook and job description master template, shown until an admin saves their own version. Served only to signed-in staff. |
| `database/migrations/` | One `.sql` file per table, run once in name order on deployment. |

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `APP_ENV` | Yes | `staging` or `production`. |
| `APP_URL` | Yes | The site's address, for example `https://hr.example.com` (no trailing slash). |
| `DB_HOST` | Yes | MariaDB host. |
| `DB_PORT` | No | MariaDB port. Defaults to 3306. |
| `DB_NAME` | Yes | The app's database. |
| `DB_USER` | Yes | Database user for the app. It needs SELECT, INSERT, UPDATE and DELETE on that database. |
| `DB_PASS` | Yes | That user's password. |
| `STORAGE_DIR` | No | Writable folder outside the repository. Not used yet: the app has no uploads or cache files. |
| `BOOTSTRAP_ADMIN_EMAIL` | First run only | Email of the first admin. |
| `BOOTSTRAP_ADMIN_PASSWORD` | First run only | A temporary password for the first admin. It works only while the app has no accounts at all, and the admin must change it straight away. Remove both BOOTSTRAP settings once the first admin has signed in. |

## Setting up a new server (for IT)

1. Point the web server's document root at `public/`. Nothing else in the repository should be reachable. Every request for a path that does not exist should return 404. No rewrite to `index.php` is needed.
2. Serve the site over HTTPS only. Session cookies are marked Secure, so sign-in does not work over plain HTTP.
3. Set the environment variables above for php-fpm.
4. The deployment system runs the files in `database/migrations/`. The user that runs them needs CREATE, ALTER, INDEX and REFERENCES on the app's database. The SQL uses CHECK constraints, JSON_VALID and foreign keys, all supported by MariaDB 10.6.
5. PHP extensions used: pdo_mysql, mbstring, json, openssl and session. Nothing else is needed.
6. PHP sessions use the server's normal session storage. Set `session.gc_maxlifetime = 28800` (8 hours) for the php-fpm pool. Otherwise Ubuntu's session clean-up can sign people out after 24 minutes of inactivity.
7. If the site sits behind a reverse proxy or load balancer, make sure PHP's `REMOTE_ADDR` is the visitor's real IP address. The sign-in lockout counts failures per IP address.
8. The app does not send email or need scheduled tasks.

## First sign-in

1. With `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` set, open the site and sign in with them.
2. Choose a new password when asked. The first admin now exists, and the BOOTSTRAP settings are ignored from then on. IT can remove them.
3. Open **Manage Team** and add people, starting from the top of the org chart. The full name and email come first, then who the person reports to and their role.
4. Each new person gets a **one-time password**. Pass it on in person or by phone, not by email. They choose their own password at first sign-in.
5. If someone forgets their password, an admin uses **Reset password** next to their name in Manage Team.

## Access model

These rules are checked on the server for every request (`src/Access.php` and `src/Api/*.php`).

| Who | 1-2-1 reviews | Forms | Job description | Handbook | Team |
|---|---|---|---|---|---|
| The employee | View, edit, start own, sign as employee | Submit and view own | View own live version | Read | – |
| Direct line manager | View, edit, create, sign as manager | View, authorise and decide | Propose changes | Read | – |
| One level above (skip-level) | View only | View only | View live version only | Read | – |
| Admin | View all, create, reopen signed-off reviews, delete | View all, authorise and decide | Edit, approve, master template | Edit | Manage |

More rules:

- A review can be edited only while nobody has signed it. Once both the employee and line manager have signed, it is **Complete** and locked. Only an admin can reopen it, which clears both signatures.
- A review can be deleted by the person who created it, or by an admin, unless it is Complete.
- The line manager who signs a review is the employee's **current** line manager in the org chart. If someone changes manager, their open reviews move to the new manager.
- Nobody can authorise or decide their own form, admins included. A self-certification or expense decision is final once made.
- A line manager's proposed job description change is visible only to that manager and to admins until it is approved.
- People can only sign in while they are in the org chart. Removing someone signs them out at once and keeps their past records.
- Five wrong passwords in 15 minutes for the same email from one IP address, or 30 from one IP address across any emails, block sign-in from there for 15 minutes.
- Sessions end after 8 hours without activity.

## Security notes

- Every page and API call checks sign-in. Every API call and every form also checks a CSRF token. SQL always uses prepared statements.
- Passwords are stored with `password_hash()`. The session ID is regenerated at sign-in. Cookies are Secure, HttpOnly and SameSite=Lax.
- Handbook and job description text is cleaned on the server (`src/HtmlSanitizer.php`). Only basic formatting tags survive, plus safe `https:`/`mailto:` links. Scripts, styles, event handlers and images are removed. This closes the "add DOMPurify" follow-up from the demo.
- Errors are written to the PHP error log. People only ever see a short generic message.
- Expense totals are recalculated on the server.

## Open questions

- **Export & share** in the review sidebar is switched off. It saved a copy of the old single-file page, which no longer works now that the app is split into PHP, CSS and JS files. A print-friendly summary page could replace it.
- **Old demo files**: `sdi-121-demo-deploy/`, `sdi-121-backend/`, `.github/workflows/deploy.yml` and the root HTML file belong to the Supabase demo. They are left in place until it is agreed they can go.
- **Existing demo data**: anything entered in the Supabase demo has not been carried over. It would need a one-off export and import.

## Checking it on staging

1. Sign in as the first admin (see "First sign-in") and add two people: a manager who reports to you, and an employee who reports to the manager.
2. Sign in as the manager in a private window, create a 1-2-1 review for the employee and type in a few answers.
3. Sign in as the employee in another browser. Check you can see the review, then sign it off. Then sign off as the manager. The review moves to **1-2-1 History** and can no longer be edited.
4. As the employee, submit an expense claim. As the manager, authorise it.
5. As the manager, propose a change to the employee's job description. As the admin, approve it.
