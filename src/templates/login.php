<?php
/** @var ?string $error  @var string $email  @var string $title */
use SdiHr\Http;
?>
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="data:,">
<title>SDI HR – <?= Http::e($title) ?></title>
<link rel="stylesheet" href="css/app.css">
</head>
<body>
<div id="auth-gate">
  <div class="auth-card">
    <h2>SDI HR</h2>
    <div class="auth-sub">Sign in to access your 1-2-1 reviews, job description, staff handbook, self-certification and expenses.</div>
    <?php if ($error !== null): ?>
      <div class="auth-err show" role="alert"><?= Http::e($error) ?></div>
    <?php endif; ?>
    <form method="post" action="login.php" autocomplete="on">
      <input type="hidden" name="csrf" value="<?= Http::e(Http::csrfToken()) ?>">
      <div class="auth-field"><label for="auth-email">Email</label>
        <input id="auth-email" name="email" type="email" autocomplete="username" required maxlength="255" value="<?= Http::e($email) ?>" placeholder="you@sdi-e.com"></div>
      <div class="auth-field"><label for="auth-password">Password</label>
        <input id="auth-password" name="password" type="password" autocomplete="current-password" required maxlength="200"></div>
      <div class="auth-actions"><button class="auth-btn" type="submit">Sign in</button></div>
    </form>
    <div class="auth-sub" style="margin:16px 0 0;">New here, or forgotten your password? Ask an SDI HR admin to give you a one-time password.</div>
  </div>
</div>
</body>
</html>
