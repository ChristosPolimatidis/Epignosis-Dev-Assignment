<?php
declare(strict_types=1);

namespace App;

use PDO;

/**
 * ---------------- src/db.php ----------------
 *
 * PHP Version: 8.4
 * Database bootstrap.
 * - Provides a tiny PDO holder (singleton-ish) via App\DB::pdo()
 * - Provides legacy helpers: db(), delete_user(), find_user()
 * - DSN resolution prefers $_ENV['DB_DSN'], falls back to local SQLite
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

/**
 * DB
 * Tiny PDO holder (singleton-ish) for the app.
 *
 * Source of truth for the database connection. Reads the DSN from
 * the environment variable `DB_DSN`; falls back to a local SQLite
 * file at `var/app.sqlite` (project root) if not set.
 *
 * Examples of valid DSNs:
 *  - sqlite:/absolute/path/to/app.sqlite
 *  - mysql:host=127.0.0.1;port=3306;dbname=vacay;charset=utf8mb4
 *  - pgsql:host=127.0.0.1;port=5432;dbname=vacay
 *
 * PDO options:
 *  - ERRMODE: EXCEPTION (throw on DB errors)
 *  - DEFAULT_FETCH_MODE: FETCH_ASSOC (array keyed by column name)
 */
final class DB
{
    /**
     * Cached PDO instance for the current process.
     * Null until the first call to pdo().
     *
     * @var PDO|null
     */
    private static ?PDO $pdo = null;

    /**
     * pdo
     * Returns a shared PDO connection. Creates it on first call.
     *
     * Resolution order for DSN:
     *  1) $_ENV['DB_DSN']
     *  2) 'sqlite:' . dirname(__DIR__) . '../var/app.sqlite'
     *
     * @return PDO Connected PDO handle.
     */
    public static function pdo(): PDO
    {
        // If we already created the PDO once in this process, return it.
        if (self::$pdo) { // If a cached PDO exists, reuse it to avoid reconnecting.
            return self::$pdo;
        }

        // Resolve DSN (env first, otherwise local SQLite in ../var/app.sqlite).
        $dsn = $_ENV['DB_DSN'] ?? ('sqlite:' . dirname(__DIR__) . '../var/app.sqlite');

        // Create and cache PDO with sane defaults.
        self::$pdo = new PDO($dsn, null, null, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return self::$pdo;
    }
}

/**
 * db
 * Legacy/global PDO accessor used by older helpers below.
 * Uses a file-local SQLite database at src/db.sqlite.
 *
 * @return PDO Connected PDO handle.
 */
function db(): PDO
{
    static $pdo = null;

    // Reuse the same PDO across calls in this request.
    if ($pdo) { // If a cached PDO exists in this function scope, return it.
        return $pdo;
    }

    // Create SQLite connection (adjust DSN for your setup if needed).
    $pdo = new PDO('sqlite:' . __DIR__ . '../db.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // IMPORTANT for SQLite: enable FK so ON DELETE CASCADE works.
    $pdo->exec('PRAGMA foreign_keys = ON');

    return $pdo;
}

/**
 * delete_user
 * Minimal delete by id.
 * Your schema is expected to cascade vacation_requests automatically.
 *
 * @param int $userId User primary key to delete.
 */
function delete_user(int $userId): void
{
    $stmt = db()->prepare('DELETE FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
}

/**
 * find_user
 * Optional existence check / simple fetch by id.
 *
 * @param int $userId User primary key to look up.
 *
 * @return array<string,mixed>|null Selected columns for the user or null if not found.
 */
function find_user(int $userId): ?array
{
    $stmt = db()->prepare('SELECT id, name, email, role FROM users WHERE id = :id');
    $stmt->execute([':id' => $userId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    // If no row returned, expose null for the caller to handle.
    return $row ?: null; // If $row is falsey (not found), return null; otherwise return the assoc array.
}
