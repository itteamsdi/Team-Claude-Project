<?php
declare(strict_types=1);

namespace SdiHr;

/**
 * Cleans the rich text that admins and line managers write in the handbook and job
 * description editors, before it is stored and again before it is sent to a browser.
 *
 * Only a short list of formatting tags is kept, and no attributes at all except a safe
 * href on links and colspan/rowspan on table cells. Everything else (scripts, styles,
 * event handlers, iframes, images, SVG) is removed. Uses only core PHP, because the
 * DOM extension is not on the approved list.
 */
final class HtmlSanitizer
{
    private const ALLOWED = [
        'p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'sub', 'sup', 'small',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'hr',
        'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'a', 'span', 'div', 'pre', 'code',
    ];
    private const VOID = ['br', 'hr'];
    /** Tags removed together with everything inside them. */
    private const DROP_WITH_CONTENT = ['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript', 'textarea', 'select', 'title', 'head'];
    public const MAX_BYTES = 1_000_000;

    /** @param bool $checkSize true when cleaning new input; false when re-cleaning stored text for output */
    public static function clean(string $html, bool $checkSize = true): string
    {
        if ($checkSize && strlen($html) > self::MAX_BYTES) {
            throw new ApiError('That document is too large to save.', 413);
        }
        $html = str_replace("\0", '', $html);
        // Remove comments and CDATA.
        $html = preg_replace('/<!--.*?(-->|$)/s', '', $html) ?? '';
        $html = preg_replace('/<!\[CDATA\[.*?(\]\]>|$)/s', '', $html) ?? '';
        // Remove dangerous elements with their contents.
        foreach (self::DROP_WITH_CONTENT as $t) {
            $html = preg_replace('#<' . $t . '\b[^>]*>.*?(</' . $t . '\s*>|$)#is', '', $html) ?? '';
            $html = preg_replace('#</?' . $t . '\b[^>]*>#i', '', $html) ?? '';
        }

        $out = '';
        $open = [];
        $len = strlen($html);
        $pos = 0;
        $nextGt = -1; // position of the next ">" (cached), or false when there are no more
        while ($pos < $len) {
            $lt = strpos($html, '<', $pos);
            if ($lt === false) {
                $out .= self::text(substr($html, $pos));
                break;
            }
            $out .= self::text(substr($html, $pos, $lt - $pos));
            // A tag runs to the next ">". Finding it with strpos keeps this fast on any input.
            if ($nextGt !== false && $nextGt < $lt) {
                $nextGt = strpos($html, '>', $lt);
            }
            $gt = $nextGt;
            if ($gt === false) {
                $out .= self::text(substr($html, $lt));
                break;
            }
            $segment = substr($html, $lt, $gt - $lt + 1);
            if (!preg_match('#^<(/?)([a-zA-Z][a-zA-Z0-9]*)(.*)>$#s', $segment, $m)) {
                // A lone "<" that is not a tag: keep it as text.
                $out .= '&lt;';
                $pos = $lt + 1;
                continue;
            }
            $pos = $gt + 1;
            $closing = $m[1] === '/';
            $tag = strtolower($m[2]);
            if (!in_array($tag, self::ALLOWED, true)) {
                continue; // drop the tag, keep its text
            }
            if ($closing) {
                $idx = array_search($tag, array_reverse($open, true), true);
                if ($idx === false) {
                    continue;
                }
                // Close any tags opened after this one, then this one.
                while (count($open) > $idx) {
                    $out .= '</' . array_pop($open) . '>';
                }
                continue;
            }
            $out .= '<' . $tag . self::attributes($tag, $m[3]) . '>';
            if (!in_array($tag, self::VOID, true)) {
                $open[] = $tag;
            }
        }
        while ($open) {
            $out .= '</' . array_pop($open) . '>';
        }
        return $out;
    }

    /** Re-encode text so that only real entities survive and no stray markup does. */
    private static function text(string $s): string
    {
        if ($s === '') {
            return '';
        }
        $decoded = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return htmlspecialchars($decoded, ENT_NOQUOTES | ENT_SUBSTITUTE, 'UTF-8');
    }

    private static function attributes(string $tag, string $raw): string
    {
        $keep = [];
        if (!preg_match_all('#([a-zA-Z_:][a-zA-Z0-9_:.-]*)\s*(?:=\s*("[^"]*"|\'[^\']*\'|[^\s"\'>]+))?#', $raw, $mm, PREG_SET_ORDER)) {
            return '';
        }
        foreach ($mm as $a) {
            $name = strtolower($a[1]);
            $val = isset($a[2]) ? trim($a[2], "\"'") : '';
            $val = html_entity_decode($val, ENT_QUOTES | ENT_HTML5, 'UTF-8');
            if ($tag === 'a' && $name === 'href') {
                $v = trim($val);
                if (preg_match('#^(https?:|mailto:|\#)#i', $v)) {
                    $keep['href'] = $v;
                }
            } elseif (($tag === 'td' || $tag === 'th') && ($name === 'colspan' || $name === 'rowspan')) {
                if (ctype_digit($val) && (int) $val >= 1 && (int) $val <= 50) {
                    $keep[$name] = $val;
                }
            }
        }
        $s = '';
        foreach ($keep as $k => $v) {
            $s .= ' ' . $k . '="' . htmlspecialchars($v, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '"';
        }
        if ($tag === 'a' && isset($keep['href']) && !str_starts_with($keep['href'], '#')) {
            $s .= ' rel="noopener noreferrer" target="_blank"';
        }
        return $s;
    }
}
