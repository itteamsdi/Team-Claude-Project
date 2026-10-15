<?php
/** @var ?string $error  @var bool $forced  @var array $me  @var string $title */
use SdiHr\Auth;
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
    <h2><?= $forced ? 'Choose your password' : 'Change your password' ?></h2>
    <div class="auth-sub">
      <?php if ($forced): ?>
        You signed in with a one-time password. Choose your own password to continue.
      <?php else: ?>
        Signed in as <?= Http::e($me['email']) ?>.
      <?php endif; ?>
      Use at least <?= Auth::MIN_PASSWORD_LENGTH ?> characters. A short phrase is easier to remember than a jumble.
    </div>
    <?php if ($error !== null): ?>
      <div class="auth-err show" role="alert"><?= Http::e($error) ?></div>
    <?php endif; ?>
    <form method="post" action="password.php">
      <input type="hidden" name="csrf" value="<?= Http::e(Http::csrfToken()) ?>">
      <input type="text" name="username" value="<?= Http::e($me['email']) ?>" autocomplete="username" hidden>
      <div class="auth-field"><label for="pw-current"><?= $forced ? 'One-time password' : 'Current password' ?></label>
        <input id="pw-current" name="current" type="password" autocomplete="current-password" required maxlength="200"></div>
      <div class="auth-field"><label for="pw-new">New password</label>
        <input id="pw-new" name="new" type="password" autocomplete="new-password" required minlength="<?= Auth::MIN_PASSWORD_LENGTH ?>" maxlength="200"></div>
      <div class="auth-field"><label for="pw-confirm">Type the new password again</label>
        <input id="pw-confirm" name="confirm" type="password" autocomplete="new-password" required minlength="<?= Auth::MIN_PASSWORD_LENGTH ?>" maxlength="200"></div>
      <div class="auth-actions"><button class="auth-btn" type="submit">Save password</button></div>
    </form>
    <div class="auth-foot">
      <?php if (!$forced): ?><a class="auth-link" href="index.php">Back to SDI HR</a><?php else: ?><span></span><?php endif; ?>
      <form method="post" action="logout.php" style="margin:0;">
        <input type="hidden" name="csrf" value="<?= Http::e(Http::csrfToken()) ?>">
        <button class="auth-link" type="submit">Sign out</button>
      </form>
    </div>
  </div>
</div>
</body>
</html>
