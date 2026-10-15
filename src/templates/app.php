<?php
/** @var array $boot */
use SdiHr\Http;

$v = static fn (string $f): string => $f . '?v=' . (string) @filemtime(dirname(__DIR__, 2) . '/public/' . $f);
?>
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="icon" href="data:,">
<meta name="csrf-token" content="<?= Http::e(Http::csrfToken()) ?>">
<title>SDI HR</title>
<link rel="stylesheet" href="<?= Http::e($v('css/app.css')) ?>">
</head>
<body>
<?php readfile(__DIR__ . '/app_body.html'); ?>
<div class="toast" id="toast"></div>
<form id="logout-form" method="post" action="logout.php" hidden>
  <input type="hidden" name="csrf" value="<?= Http::e(Http::csrfToken()) ?>">
</form>
<script id="boot-data" type="application/json"><?= json_encode($boot, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE) ?></script>
<script src="<?= Http::e($v('js/review.js')) ?>"></script>
<script src="<?= Http::e($v('js/data.js')) ?>"></script>
<script src="<?= Http::e($v('js/hr.js')) ?>"></script>
</body>
</html>
