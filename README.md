# SDI HR

An internal HR web app for SDI staff, in plain PHP 8.3 with a MariaDB 10.6 database.

- **Staff Handbook**: company policies with a contents sidebar. Admins edit it.
- **Job Description**: one per person. The line manager proposes changes; an admin approves them before they go live.
- **Routed forms**: Self-Certification, Expense Claim (mileage at 35p per mile, with receipts attached), Flexible Working Request and Home Working DSE Self-Assessment. The employee submits; their line manager authorises, decides or reviews. Expense claims then go to the finance team, who authorise payment and mark them paid. Each form has a history list, so past requests and decisions can be looked up later.
- **Cost centres**: the finance team keeps the list offered on expense claims (Expense Claim → Manage cost centres).
- **1-2-1 Review**: the employee and line manager fill in a structured review together. Both sign it off, which locks it.
- **1-2-1 History** and **Follow-Up to 1-2-1**: signed-off reviews, and the actions agreed in the open review.
- **Manage Team** (admins): add people with their job title and department, set who they report to, mark the finance team and the CEO, give admin rights and issue one-time passwords.

This replaces the earlier Supabase + Netlify demo, which has been retired. The screens are the same; the review sidebar's "Export & share" button has been dropped. Sign-in, storage and all permission checks now happen on SDI's own server.

## Folders

| Folder | What it holds |
|---|---|
| `public/` | The web root. Entry points `index.php` (the app), `login.php`, `password.php`, `logout.php`, `api.php` (the JSON endpoint the app's JavaScript calls), `upload.php` (attach a receipt) and `file.php` (open an attached file, with permission checks), plus `css/`, `js/`, `robots.txt` and `.user.ini` (raises PHP's upload limit to 10 MB for this site only). |
| `src/` | PHP classes and templates. Not reachable from the web. `Access.php` holds the access rules; `Api/` holds one file per feature. |
| `src/content/` | Default Staff Handbook and job description master template, shown until an admin saves their own version. Served only to signed-in staff. |
| `database/migrations/` | One `.sql` file per change, run once in name order on deployment. |

## Environment variables

| Name | Required | What it is |
|---|---|---|
| `APP_ENV` | Yes | `staging` or `production`. |
| `APP_URL` | Yes | The site's address, for example `https://hr.example.com` (no trailing slash). |
| `DB_HOST` | Yes | MariaDB host: `localhost` when MariaDB is on the same server. |
| `DB_PORT` | No | MariaDB port. Defaults to 3306. |
| `DB_NAME` | Yes | The app's database. |
| `DB_USER` | Yes | Database user for the app. It needs SELECT, INSERT, UPDATE and DELETE on that database. |
| `DB_PASS` | Yes | That user's password. |
| `STORAGE_DIR` | Yes | Writable folder outside the repository and outside `public/`. The app keeps its sign-in sessions in `STORAGE_DIR/sessions` and attached receipts in `STORAGE_DIR/uploads`, and creates both folders itself. Without it, receipts cannot be attached and PHP's shared session folder is used. Include this folder in the server backups: it holds the only copy of each receipt. |
| `BOOTSTRAP_ADMIN_EMAIL` | First run only | Email of the first admin. |
| `BOOTSTRAP_ADMIN_PASSWORD` | First run only | A temporary password for the first admin. It works only while the app has no accounts at all, and the admin must change it straight away. Remove both BOOTSTRAP settings once the first admin has signed in. |

## Setting up a new server (for IT)

1. Create the database and its user. See "Step 1: Create the database".
2. Set the site's settings in its Apache virtual host. See "Step 2: Apache settings".
3. Point the site's document root at the repository's `public/` folder. Nothing else in the repository should be reachable.
4. Serve the site over HTTPS only. Session cookies are marked Secure, so sign-in does not work over plain HTTP.
5. The deployment system runs the files in `database/migrations/`. The user that runs them needs CREATE, ALTER, INDEX and REFERENCES on the app's database. The SQL uses CHECK constraints, JSON_VALID and foreign keys, all supported by MariaDB 10.6.
6. PHP extensions used: pdo_mysql (Ubuntu package `php8.3-mysql`), mbstring, json, openssl, session and fileinfo (checks the type of uploaded receipts). Nothing else is needed.
7. Receipts can be up to 10 MB. `public/.user.ini` raises `upload_max_filesize` to 10M and `post_max_size` to 12M for this site only. php-fpm reads it automatically (within 5 minutes, or at once after `sudo systemctl reload php8.3-fpm`). If the server sets `user_ini.filename` to empty, set those two values in the site's php-fpm pool instead.
8. Set `STORAGE_DIR` so the app keeps its own sessions. With a shared session folder, Ubuntu's clean-up can sign people out after 24 minutes of inactivity.
9. If the site sits behind Cloudflare, a reverse proxy or a load balancer, PHP's `REMOTE_ADDR` must be the visitor's real IP address, because the sign-in lockout counts failures per address. See "Cloudflare" below.
10. The app does not send email or need scheduled tasks.

## Step 1: Create the database

Use one database and one user per environment. Suggested names:

| | Staging | Production |
|---|---|---|
| Database | `sdihr_staging` | `sdihr_production` |
| App user | `sdihr_staging_user` | `sdihr_production_user` |

**Password.** Generate a new random password for each environment, for example with a password manager or `openssl rand -base64 24`. Keep it only on the server and in the password manager, never in this repository, an email or a ticket. Avoid the characters `"`, `\` and `${`, which Apache treats specially in its configuration.

Open MariaDB as an admin (`sudo mariadb`) and run:

```sql
CREATE DATABASE sdihr_staging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'sdihr_staging_user'@'localhost' IDENTIFIED BY '<database password>';
GRANT SELECT, INSERT, UPDATE, DELETE ON sdihr_staging.* TO 'sdihr_staging_user'@'localhost';
```

- **The host part.** It must match how the app connects. With `DB_HOST localhost` the user must be `'...'@'localhost'`. With `DB_HOST 127.0.0.1` it must be `'...'@'127.0.0.1'`.
- **The tables.** Do not create them by hand. The deployment system creates them from `database/migrations/`.
- **Leaving MariaDB.** Type `exit;` and press Enter, or press Ctrl+D. If the prompt shows `->`, MariaDB is waiting for the end of a command. Type `;` and press Enter, or press Ctrl+C, first.

Check the login works. This asks for the password rather than putting it on the command line:

```bash
mariadb -h localhost -u sdihr_staging_user -p sdihr_staging -e "SELECT 'connected' AS result;"
```

Once the migrations have run, `SHOW TABLES;` in place of the SELECT should list nine tables: `cost_centres`, `job_descriptions`, `login_attempts`, `org_members`, `reviews`, `shared_docs`, `submission_files`, `submissions` and `users`.

## Step 2: Apache settings (one shared php-fpm for all sites)

SDI's servers run one php-fpm for all sites, so each site's settings go in **that site's Apache virtual host**, using `SetEnv`. Apache passes them to php-fpm with every request, and the app reads them with `getenv()`. Other sites never see them. The values live only on the server, never in this repository.

### Find the site's virtual host file

On Ubuntu, each site has a file in `/etc/apache2/sites-available/`, usually named after the site's address. Apache uses it while a link to it exists in `/etc/apache2/sites-enabled/`. To see which file serves which address:

```bash
sudo apache2ctl -S | grep <site address>
```

Each line shows a port, the address, and the file and line number of its `<VirtualHost>` block.

- **Port 80 block.** Leave it as it is. When certbot (Let's Encrypt) set up the certificate, it added lines there that redirect every visitor to HTTPS. They are still needed.
- **Port 443 block.** The settings go here. It is usually in a separate file ending `-le-ssl.conf`, for example `/etc/apache2/sites-available/<site address>-le-ssl.conf`.
- **No port 443 block?** The site has no HTTPS yet. Run `sudo certbot --apache -d <site address>` to create it, then edit the new file.

### Edit the port 443 block

Change `DocumentRoot` and the `<Directory>` path so they point at the repository's `public` folder, and add the `SetEnv` lines. Leave the certificate lines that certbot added (`SSLCertificateFile`, `Include /etc/letsencrypt/...`) unchanged. With the repository deployed into `/home/www/<site address>/htdocs`, it looks like this:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
	ServerName <site address>
	DocumentRoot /home/www/<site address>/htdocs/public

	<Directory "/home/www/<site address>/htdocs/public">
		Options -Indexes +FollowSymLinks +SymLinksIfOwnerMatch -Multiviews
		AllowOverride all
		Require all granted
		DirectoryIndex index.php
	</Directory>

	<FilesMatch \.php$>
		SetHandler "proxy:unix:/run/php/php8.3-fpm.sock|fcgi://localhost"
	</FilesMatch>

	SetEnv APP_ENV     staging
	SetEnv APP_URL     https://<site address>
	SetEnv DB_HOST     localhost
	SetEnv DB_PORT     3306
	SetEnv DB_NAME     sdihr_staging
	SetEnv DB_USER     sdihr_staging_user
	SetEnv DB_PASS     "<database password>"
	SetEnv STORAGE_DIR /home/www/<site address>/storage

	# First sign-in only. Remove both lines once the first admin has signed in.
	SetEnv BOOTSTRAP_ADMIN_EMAIL    <first admin's email>
	SetEnv BOOTSTRAP_ADMIN_PASSWORD "<temporary password>"

	ErrorLog /home/www/logs/error-logs/<site address>-error.log
	CustomLog /home/www/logs/access-logs/<site address>-access.log combined

	# ... the certificate lines certbot added, unchanged ...
</VirtualHost>
</IfModule>
```

**Writing the `SetEnv` lines:**

- **Angle brackets.** Text in angle brackets is a placeholder. Replace the whole thing, brackets included. For example, write `SetEnv BOOTSTRAP_ADMIN_EMAIL name@sdi-e.com`, not `<name@sdi-e.com>`.
- **Quotes.** Put passwords in double quotes, so spaces and symbols are read correctly. Emails and names need no quotes.
- **One of each.** Have only one line for each setting in the block.
- **The `/public` on the end of `DocumentRoot`.** This matters. If the site pointed at `htdocs` itself, anyone could download `src/`, `README.md`, `CLAUDE.md` and the `.git` folder.
- **Staging and production.** Use `staging` or `production` for `APP_ENV`. Give each environment its own database, user and `STORAGE_DIR`.

### Create the storage folder and lock down the file

```bash
grep -E '^(user|group)' /etc/php/8.3/fpm/pool.d/www.conf
sudo mkdir -p /home/www/<site address>/storage
sudo chown <php-fpm user>:<php-fpm group> /home/www/<site address>/storage
sudo chmod 700 /home/www/<site address>/storage
sudo chmod 640 /etc/apache2/sites-available/<site file>.conf
```

The first command shows the user php-fpm runs as. On Ubuntu this is normally `www-data`. The app creates `sessions` inside the storage folder on first use.

### Check and reload Apache

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

`configtest` should say `Syntax OK`. Reload Apache after **every** change to the file. If `SetEnv` is reported as unknown, run `sudo a2enmod env`.

### Cloudflare

If the site is behind Cloudflare, the logs show visitor addresses such as `172.68.x.x` or `172.69.x.x`. Turn on Apache's `remoteip` module (`sudo a2enmod remoteip`) and add `RemoteIPHeader CF-Connecting-IP` to the site, with Cloudflare's published address ranges as `RemoteIPTrustedProxy` lines. Without this, every visitor appears to come from Cloudflare, and five wrong passwords from anyone would block sign-in for everyone for 15 minutes.

## First sign-in

1. **Check the BOOTSTRAP settings.** `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` must be in the port 443 block, Apache reloaded, and the migrations run (see Step 1 for the `SHOW TABLES` check).
2. **Sign in.** Open the site and enter exactly that email and temporary password.
3. **Choose your password.** You are taken to "Choose your password". Enter the temporary password, then your own password twice (at least 10 characters). You are now the first admin.
4. **Remove the BOOTSTRAP lines.** Delete both lines from the virtual host file and reload Apache. They only work while the app has no accounts at all, so they are ignored from now on anyway.
5. **Add people.** Open **Manage Team** and add people, starting from the top of the org chart: full name, work email, who they report to and their role.
6. **Pass on one-time passwords.** Each new person gets a **one-time password**. Pass it on in person or by phone, not by email. They choose their own password at first sign-in.
7. **Forgotten passwords.** If someone forgets their password, an admin uses **Reset password** next to their name in Manage Team.

## Troubleshooting

When the app hits a problem, it shows a short message and writes the real reason to the site's Apache error log (the `ErrorLog` file in the virtual host). To see the latest app errors:

```bash
sudo grep "sdi-hr" /home/www/logs/error-logs/<site address>-error.log | tail -5
```

If nothing is there, try `sudo tail -20 /var/log/php8.3-fpm.log`.

### On screen

| What you see | What it means | Fix |
|---|---|---|
| Apache's own **Forbidden** page | Apache found no `index.php` in the document root, or cannot open the folder | Check that `DocumentRoot` points at the repository's `public` folder and that `index.php` is there (`ls -la <path>/public/`). The error log says which: `AH01276` means no index file; `AH00035` means folder permissions (`sudo chmod o+x` on each folder in the path); `AH01630` means the `<Directory>` block does not cover that path. |
| "Something went wrong on the server" | See the error log; the table below lists the usual causes | |
| "That email and password do not match an account" | The email or password is different from what is stored | Check for typing errors. For the first sign-in, check the BOOTSTRAP values have no leftover `< >` or stray spaces, and that Apache was reloaded. The BOOTSTRAP sign-in only works while the `users` table is empty. |
| "Too many attempts" | Five wrong passwords in 15 minutes | Wait 15 minutes, or ask an admin to reset the password. If it happens to everyone, see "Cloudflare". |

### In the error log

| What the log line contains | What it means | Fix |
|---|---|---|
| `Missing required environment variable DB_HOST` (or another name) | Apache is not passing the settings | Put the `SetEnv` lines inside the port 443 block, not the port 80 one, then reload Apache. |
| `could not find driver` | PHP's MariaDB driver is missing | `sudo apt install php8.3-mysql`, then `sudo systemctl restart php8.3-fpm`. |
| `[1045] Access denied for user` | MariaDB refused the user or password | Test the login with the `mariadb` command in Step 1. If that fails too, check `SELECT user, host FROM mysql.user WHERE user = '<database user>';` and create the user for the right host, or reset its password with `ALTER USER '<database user>'@'localhost' IDENTIFIED BY '<database password>';`. If the terminal login works, the `DB_PASS` line is wrong: check the quotes, stray spaces, or the characters `"`, `\` and `${`. |
| `[2002] No such file or directory` | PHP cannot find MariaDB's local socket | Use `DB_HOST 127.0.0.1`, and make sure the user exists as `'<database user>'@'127.0.0.1'`. |
| `[1049] Unknown database` | `DB_NAME` does not match the database | Correct the name in the `SetEnv` line. |
| `Table '...users' doesn't exist` (`42S02`) | The migrations have not run | Ask IT to run the files in `database/migrations/` in name order. |
| `[1142] ... command denied` | The user is missing a permission | Grant SELECT, INSERT, UPDATE and DELETE on the database to that user. |
| `STORAGE_DIR/sessions is not writable` | php-fpm cannot write to the storage folder | Set the storage folder's owner to the php-fpm user (see "Create the storage folder"). |

## Access model

These rules are checked on the server for every request (`src/Access.php` and `src/Api/*.php`).

| Who | 1-2-1 reviews | Forms | Job description | Handbook | Team |
|---|---|---|---|---|---|
| The employee | View own, sign as employee | Submit and view own | View own live version | Read | – |
| Direct line manager | View, edit, start (direct reports only), sign as manager | View, approve or authorise, decide | Propose changes | Read | – |
| Everyone further up the reporting line, up to the CEO | View only | View only | View live version only | Read | – |
| CEO (ticked in Manage Team) | View everyone's, as top of the chain | View everyone's; manage cost centres | View | Read | – |
| Finance team (ticked in Manage Team) | As their own position in the org chart | As their own position, plus all expense claims: authorise payment of approved claims, mark them paid; manage cost centres | As own position | Read | – |
| Admin | As their own position in the org chart; can reopen a signed-off review they can see | As their own position in the org chart | Approve, master template | Edit | Manage |

**Admin rights do not give access to anyone's reviews or forms** (agreed after initial testing, 28 Oct 2026). Admin means Manage Team, the Staff Handbook and job description approval. Reviews and forms follow the chain of command; finance joins in for expense claims only.

**Expense claim steps:** the employee submits (with a Yes/No receipt answer and a file for each line marked Yes) → the line manager reviews the full claim and approves or rejects → anyone in the finance team authorises payment or rejects → finance marks it paid with the payment date. A reason is required to reject. Every step is recorded with who did it and when (the claim's audit trail).

More rules:

- A review can be edited only while nobody has signed it. Once both the employee and line manager have signed, it is **Complete** and locked. Only an admin who can see the review (someone in the employee's chain of command) can reopen it, which clears both signatures.
- A review can be deleted by the person who created it, unless it is Complete.
- The line manager who signs a review is the employee's **current** line manager in the org chart. If someone changes manager, their open reviews move to the new manager.
- Nobody can authorise, decide or pay their own form, admins and finance included. Every decision (self-certification, each expense step, flexible working and DSE) is final once saved and stays in the history.
- A line manager's proposed job description change is visible only to that manager and to admins until it is approved.
- People can only sign in while they are in the org chart. Removing someone signs them out at once and keeps their past records.
- Five wrong passwords in 15 minutes for the same email from one IP address, or 30 from one IP address across any emails, block sign-in from there for 15 minutes.
- Sessions end after 8 hours without activity.

## Security notes

- Every page and API call checks sign-in. Every API call and every form also checks a CSRF token. SQL always uses prepared statements.
- Passwords are stored with `password_hash()`. The session ID is regenerated at sign-in. Cookies are Secure, HttpOnly and SameSite=Lax.
- Handbook and job description text is cleaned on the server (`src/HtmlSanitizer.php`). Only basic formatting tags survive, plus safe `https:`/`mailto:` links. Scripts, styles, event handlers and images are removed. This closes the "add DOMPurify" follow-up from the demo.
- Errors are written to the PHP error log. People only ever see a short generic message.
- Expense totals are recalculated on the server, mileage at 35p per mile. Cost centres are checked against the current list.
- Receipts: PDF, JPG or PNG only (checked by file content, not name; no SVG), up to 10 MB, at most 50 per form. They are stored under `STORAGE_DIR/uploads` with new random names and are only served through `file.php`, which checks the person may see the form.
- Every form's required fields are checked on the server as well as in the browser.
- Search engines are kept out. `public/robots.txt` asks every crawler to stay away. Every page also sends an `X-Robots-Tag: noindex, nofollow, noarchive` header, so a page is never listed even if a crawler finds a link to it. This applies to staging and production alike.

## Checking it on staging

1. Sign in as the first admin (see "First sign-in") and add two people: a manager who reports to you, and an employee who reports to the manager.
2. Sign in as the manager in a private window, create a 1-2-1 review for the employee and type in a few answers.
3. Sign in as the employee in another browser. Check you can see the review, then sign it off. Then sign off as the manager. The review moves to **1-2-1 History** and can no longer be edited.
4. In Manage Team, tick **Finance team** for one person and **CEO** for another, and fill in job titles and departments.
5. As the employee, submit an expense claim with a train fare (receipt attached) and a mileage line. As the manager, open it with **Review**, check the receipt opens, and approve it. As the finance person, authorise payment and mark it paid. As the CEO, check it appears in **Expense history** as Paid.
6. As the manager, propose a change to the employee's job description. As the admin, approve it.
