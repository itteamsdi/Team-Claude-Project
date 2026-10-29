<?php
declare(strict_types=1);

namespace SdiHr\Api;

use SdiHr\Access;
use SdiHr\ApiError;
use SdiHr\Db;
use SdiHr\Input;

/**
 * Cost centres offered on the expense claim form.
 *  - Everyone signed in can read the list.
 *  - The finance team and the CEO add, rename, reorder and delete them.
 * Claims keep the cost centre's name as it was when submitted, so changes here never alter past claims.
 */
final class CostCentresApi
{
    public static function list(array $me, Input $in): array
    {
        return ['items' => self::all(), 'can_manage' => self::canManage($me)];
    }

    /** Add (no id) or rename (with id). */
    public static function save(array $me, Input $in): array
    {
        self::requireManager($me);
        $name = preg_replace('/\s+/u', ' ', $in->str('name', 100));
        if ($name === '') {
            throw new ApiError('Enter a name for the cost centre.');
        }
        $id = $in->has('id') && $in->str('id', 10, false) !== '' ? (int) $in->str('id', 10) : null;
        $clash = Db::one('SELECT id FROM cost_centres WHERE name = ?', [$name]);
        if ($clash !== null && (int) $clash['id'] !== $id) {
            throw new ApiError('There is already a cost centre called "' . $name . '".');
        }
        $now = Db::now();
        if ($id === null) {
            $max = Db::one('SELECT COALESCE(MAX(sort_order), 0) AS m FROM cost_centres');
            Db::run(
                'INSERT INTO cost_centres (name, sort_order, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                [$name, (int) $max['m'] + 10, $me['email'], $now, $now]
            );
        } else {
            $st = Db::run('UPDATE cost_centres SET name = ?, updated_by = ?, updated_at = ? WHERE id = ?', [$name, $me['email'], $now, $id]);
            if ($st->rowCount() === 0 && Db::one('SELECT id FROM cost_centres WHERE id = ?', [$id]) === null) {
                throw new ApiError('That cost centre was not found.', 404);
            }
        }
        return ['items' => self::all()];
    }

    public static function remove(array $me, Input $in): array
    {
        self::requireManager($me);
        $id = (int) $in->str('id', 10);
        Db::run('DELETE FROM cost_centres WHERE id = ?', [$id]);
        return ['items' => self::all()];
    }

    /** Names currently on the list, used to check expense claims. @return string[] */
    public static function names(): array
    {
        return array_map(static fn ($r) => $r['name'], self::all());
    }

    private static function all(): array
    {
        return array_map(static fn ($r) => ['id' => (int) $r['id'], 'name' => $r['name']],
            Db::all('SELECT id, name FROM cost_centres ORDER BY sort_order, name'));
    }

    private static function canManage(array $me): bool
    {
        return Access::isFinance($me) || Access::isCeo($me);
    }

    private static function requireManager(array $me): void
    {
        if (!self::canManage($me)) {
            throw new ApiError('Only the finance team and the CEO can change the cost centres.', 403);
        }
    }
}
