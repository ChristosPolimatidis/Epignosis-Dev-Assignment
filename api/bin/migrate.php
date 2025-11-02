<?php
declare(strict_types=1);

/**
 * ---------------- bin/migrate.php ----------------
 *
 * PHP Version: 8.4
 * One-shot migration + seed script.
 * - Loads Composer autoload and optional .env
 * - Ensures DB schema is applied (exec schema.sql)
 * - Seeds a default manager user iff the users table is empty
 *
 * Usage:
 *   php bin/migrate.php
 *
 * Env:
 *   DB_DSN=<pdo dsn>  (falls back to sqlite:…/var/app.sqlite via App\DB)
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

use App\DB;

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

/** Resolve project root assuming this file lives under /bin. */
$ROOT = dirname(__DIR__);

/** Composer autoload (required for Dotenv and App\DB). */
$autoload = $ROOT . '../vendor/autoload.php';
if (is_file($autoload)) { // If the autoloader exists, include it so classes are available.
    require_once $autoload;
}

/** DB bootstrap (exposes App\DB::pdo()). */
$dbBootstrap = $ROOT . '../src/db.php';
if (is_file($dbBootstrap)) { // If the DB bootstrap file exists, include it.
    require_once $dbBootstrap;
}

/**
 * out
 * Print a line to STDOUT with a trailing newline.
 *
 * @param string $msg Message to print.
 */
function out(string $msg): void
{
    fwrite(STDOUT, $msg . PHP_EOL);
}

/**
 * load_env
 * Optionally load variables from a .env file if vlucas/phpdotenv is available.
 *
 * @param string $root Project root to look for the .env file.
 */
function load_env(string $root): void
{
    // If Dotenv is available and .env file exists, load it.
    if (class_exists(\Dotenv\Dotenv::class)) { // If Dotenv library is installed,
        $envPath = $root . '../.env';
        if (is_file($envPath)) { // and a .env file exists, load it.
            /** @var \Dotenv\Dotenv $dotenv */
            $dotenv = \Dotenv\Dotenv::createImmutable($root);
            $dotenv->safeLoad();
        }
    }
}

/**
 * pdo
 * Acquire a PDO connection using App\DB::pdo() if available.
 * Falls back to a direct SQLite file under var/app.sqlite.
 *
 * @param string $root Project root to resolve default SQLite path.
 *
 * @return PDO Connected PDO instance.
 */
function pdo(string $root): PDO
{
    // Prefer central App\DB::pdo() when available to keep one source of truth.
    if (class_exists(\App\DB::class) && method_exists(\App\DB::class, 'pdo')) { // If App\DB::pdo exists, use it.
        return DB::pdo();
    }

    // Fallback to local SQLite under /var/app.sqlite (keeps parity with comments).
    $dsn = 'sqlite:' . $root . '../var/app.sqlite';
    $pdo = new PDO($dsn, null, null, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,  // Throw on errors.
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,        // Fetch assoc arrays by default.
    ]);

    // If this is SQLite, make sure foreign keys are enforced.
    if (str_starts_with($dsn, 'sqlite:')) { // If using SQLite, turn on PRAGMA foreign_keys.
        $pdo->exec('PRAGMA foreign_keys = ON');
    }

    return $pdo;
}

/**
 * find_schema_file
 * Locate a schema.sql file in common locations.
 *
 * @param string $root Project root.
 *
 * @return string Path to schema file.
 *
 * @throws RuntimeException When no schema file can be located.
 */
function find_schema_file(string $root): string
{
    $candidates = [
        $root . '/config/schema.sql',
        $root . '/var/schema.sql',
        __DIR__ . '/schema.sql',
    ];

    foreach ($candidates as $file) {
        if (is_file($file)) { // If a candidate path exists as a regular file, use it.
            return $file;
        }
    }

    throw new RuntimeException('schema.sql not found (looked in /schema.sql, /var/schema.sql, /bin/schema.sql)');
}

/**
 * apply_schema
 * Execute the SQL contained in schema.sql.
 *
 * Notes:
 * - Uses PDO::exec on each statement split by ';' to avoid issues with drivers
 *   that do not support multi-statement execution in one call.
 *
 * @param PDO    $pdo   Database connection.
 * @param string $path  Absolute path to schema.sql.
 */
function apply_schema(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if ($sql === false) { // If file_get_contents failed, abort with a clear message.
        throw new RuntimeException('Failed to read schema file: ' . $path);
    }

    // Naive split on semicolons; good enough for simple schema files.
    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        static fn(string $s) => $s !== ''
    );

    foreach ($statements as $stmt) {
        $pdo->exec($stmt); // Execute each DDL/DML statement; will throw on error.
    }
}

/**
 * users_count
 * Count rows in the users table.
 *
 * @param PDO $pdo Database connection.
 *
 * @return int Number of rows in users.
 */
function users_count(PDO $pdo): int
{
    // If the table does not exist yet, SELECT will fail — let it bubble up for clarity.
    $count = (int)$pdo->query('SELECT COUNT(*) FROM users')->fetchColumn();
    return $count;
}

/**
 * generate_employee_code
 * Produce a unique code in the form ###-###-###.
 *
 * @param PDO $pdo Database connection (to check uniqueness).
 *
 * @return string Unique employee code.
 */
function generate_employee_code(PDO $pdo): string
{
    do {
        $code = sprintf(
            '%03d-%03d-%03d',
            random_int(100, 999),
            random_int(100, 999),
            random_int(0, 999)
        );

        $s = $pdo->prepare('SELECT 1 FROM users WHERE employee_code = ? LIMIT 1');
        $s->execute([$code]);

        // Repeat until no collision is found.
    } while ($s->fetchColumn());

    return $code;
}

/**
 * seed_manager_if_empty
 * Insert a default manager user when the users table has no rows.
 *
 * @param PDO $pdo Database connection.
 */
function seed_manager_if_empty(PDO $pdo): void
{
    $count = users_count($pdo);

    if ($count === 0) { // If there are no users yet, create the initial manager.
        $name  = 'Manager';
        $email = 'manager@example.com';
        $pass  = 'pass'; // Intentionally simple per original script’s message.
        $hash  = password_hash($pass, PASSWORD_DEFAULT);

        $code = generate_employee_code($pdo);

        $ins = $pdo->prepare(
            'INSERT INTO users (name,email,employee_code,role,password_hash,created_at)
             VALUES (?,?,?,?,?,datetime("now"))'
        );
        $ins->execute([$name, $email, $code, 'manager', $hash]);

        out("Seeded manager: $email / pass   (employee_code=$code)");
    } else { // If the table already contains users, skip seeding.
        out('DB already has users; no seed needed.');
    }
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

try {
    // Load .env if available (safe no-op when absent).
    load_env($ROOT);

    // Connect to DB.
    $pdo = pdo($ROOT);

    out('Applying schema…');
    $schemaFile = find_schema_file($ROOT);
    apply_schema($pdo, $schemaFile);
    out('Schema applied.');

    out('Seeding default manager (if needed)…');
    seed_manager_if_empty($pdo);

    out('Migration done.');
    exit(0);

} catch (Throwable $e) {
    fwrite(STDERR, "Migration failed: {$e->getMessage()}" . PHP_EOL);
    exit(1);
}
