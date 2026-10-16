# SDI HR

An internal HR web app for SDI staff, in plain PHP 8.3 with a MariaDB 10.6 database.

- **Staff Handbook**: company policies with a contents sidebar. Admins edit it.
- **Job Description**: one per person. The line manager proposes changes; an admin approves them before they go live.
- **Routed forms**: Self-Certification, Expense Claim (mileage at 35p per mile), Flexible Working Request and Home Working DSE Self-Assessment. The employee submits; their line manager authorises, decides or reviews.
- **1-2-1 Review**: the employee and line manager fill in a structured review together. Both sign it off, which locks it.
- **1-2-1 History** and **Follow-Up to 1-2-1**: signed-off reviews, and the actions agreed in the open review.
- **Manage Team** (admins): add people, set who they report to, give admin rights and issue one-time passwords.

This replaces the earlier Supabase + Netlify demo, which has been retired. The screens are the same; the review sidebar's "Export & share" button has been dropped. Sign-in, storage and all permission checks now happen on SDI's own server.

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
| `STORAGE_DIR` | Recommended | Writable folder outside the repository and outside `public/`. The app keeps its sign-in sessions in `STORAGE_DIR/sessions` and creates that folder itself. If this is not set, PHP's shared session folder is used. |
| `BOOTSTRAP_ADMIN_EMAIL` | First run only | Email of the first admin. |
| `BOOTSTRAP_ADMIN_PASSWORD` | First run only | A temporary password for the first admin. It works only while the app has no accounts at all, and the admin must change it straight away. Remove both BOOTSTRAP settings once the first admin has signed in. |

## Setting up a new server (for IT)

1. Point the web server's document root at `public/`. Nothing else in the repository should be reachable. Every request for a path that does not exist should return 404. No rewrite to `index.php` is needed.
2. Serve the site over HTTPS only. Session cookies are marked Secure, so sign-in does not work over plain HTTP.
3. Set the environment variables above for this site. See "Server set-up: Apache with a shared php-fpm" below.
4. The deployment system runs the files in `database/migrations/`. The user that runs them needs CREATE, ALTER, INDEX and REFERENCES on the app's database. The SQL uses CHECK constraints, JSON_VALID and foreign keys, all supported by MariaDB 10.6.
5. PHP extensions used: pdo_mysql, mbstring, json, openssl and session. Nothing else is needed.
6. Set `STORAGE_DIR` so the app keeps its own sessions. With a shared session folder, Ubuntu's clean-up can sign people out after 24 minutes of inactivity.
7. If the site sits behind a reverse proxy or load balancer, make sure PHP's `REMOTE_ADDR` is the visitor's real IP address. The sign-in lockout counts failures per IP address.
8. The app does not send email or need scheduled tasks.

## Server set-up: Apache with a shared php-fpm

SDI's servers run one php-fpm for all sites. Each site's settings go in **that site's Apache virtual host**, using `SetEnv`. Apache passes them to php-fpm with every request, and the app reads them with `getenv()`. Other sites never see them. The values live only on the server, never in this repository.

### 1. Find the site's virtual host file

On Ubuntu, each site has a file in `/etc/apache2/sites-available/`, usually named after the site's address, for example `hr.example.com.conf`. Apache uses it while a link to it exists in `/etc/apache2/sites-enabled/`. To see exactly which file serves which address, run:

```bash
sudo apache2ctl -S
```

Each line shows an address and the file and line number of its `<VirtualHost>` block, for example `port 443 namevhost hr.example.com (/etc/apache2/sites-enabled/hr.example.com-le-ssl.conf:2)`.

- Put the settings in the **port 443 (HTTPS)** block.
- If the certificate came from Let's Encrypt (certbot), that block is usually in a separate file ending `-le-ssl.conf`.
- If the site has no virtual host yet, create `/etc/apache2/sites-available/<address>.conf`, then turn it on with `sudo a2ensite <address>`.

### 2. Add the settings

Inside the site's `<VirtualHost *:443>` block (replace every value in angle brackets):

```apache
DocumentRoot /path/to/repository/public

SetEnv APP_ENV     staging
SetEnv APP_URL     https://<site address>
SetEnv DB_HOST     localhost
SetEnv DB_PORT     3306
SetEnv DB_NAME     <database name>
SetEnv DB_USER     <database user>
SetEnv DB_PASS     "<database password>"
SetEnv STORAGE_DIR /var/lib/sdi-hr-staging

# First sign-in only. Remove both lines once the first admin has signed in.
SetEnv BOOTSTRAP_ADMIN_EMAIL    <first admin's email>
SetEnv BOOTSTRAP_ADMIN_PASSWORD "<temporary password>"
```

- Keep the double quotes around passwords, so spaces and symbols are read correctly.
- The block must also send `.php` files to php-fpm. The server's existing sites show how. It is usually a `SetHandler "proxy:unix:/run/php/php8.3-fpm.sock|fcgi://localhost"` line inside `<FilesMatch "\.php$">`, or the server-wide `php8.3-fpm` Apache config.
- Use `staging` or `production` for `APP_ENV`, and a different database, user and `STORAGE_DIR` for each.

### 3. Create the storage folder and lock down the file

```bash
sudo mkdir -p /var/lib/sdi-hr-staging
sudo chown www-data:www-data /var/lib/sdi-hr-staging
sudo chmod 700 /var/lib/sdi-hr-staging
sudo chmod 640 /etc/apache2/sites-available/<site file>.conf
```

`www-data` is the user php-fpm runs as on Ubuntu. To check, run `grep -E '^(user|group)' /etc/php/8.3/fpm/pool.d/www.conf`, and put the user it shows in the `chown` command.

If the site is behind Cloudflare, also turn on Apache's `remoteip` module with `RemoteIPHeader CF-Connecting-IP` and Cloudflare's address ranges as `RemoteIPTrustedProxy`. Otherwise every visitor appears to come from a Cloudflare address, and the sign-in lockout would treat them all as one person.

### 4. Check the configuration and reload Apache

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

`configtest` should say `Syntax OK`. Apache's `env` module must be on, as it is by default. If `SetEnv` is reported as unknown, run `sudo a2enmod env`.

### 5. Check the database login and the site

Check that the database name, user and password work. This asks for the password rather than putting it on the command line:

```bash
mariadb -h localhost -u <database user> -p <database name> -e "SELECT 'connected' AS result;"
```

Then open the site address. You should see the SDI HR sign-in page.

- If it says "Something went wrong on the server", look for lines starting `[sdi-hr]` in the site's Apache error log, the file named by `ErrorLog` in the virtual host. With php-fpm, PHP messages usually appear there as `PHP message: ...`. They can also be in `/var/log/php8.3-fpm.log`.
- The database tables appear after the deployment system has run the migrations. If sign-in fails before then, check that the migrations have run.

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

## Checking it on staging

1. Sign in as the first admin (see "First sign-in") and add two people: a manager who reports to you, and an employee who reports to the manager.
2. Sign in as the manager in a private window, create a 1-2-1 review for the employee and type in a few answers.
3. Sign in as the employee in another browser. Check you can see the review, then sign it off. Then sign off as the manager. The review moves to **1-2-1 History** and can no longer be edited.
4. As the employee, submit an expense claim. As the manager, authorise it.
5. As the manager, propose a change to the employee's job description. As the admin, approve it.
