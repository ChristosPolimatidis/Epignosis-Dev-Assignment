<?php
declare(strict_types=1);

/**
 * ---------------- public/index.php ----------------
 *
 * PHP Version: 8.4
 * Minimal API front controller.
 * - Loads vendor + DB bootstrap
 * - JSON helpers
 * - Session + CORS for Vite (localhost:5173)
 * - Routes:
 *   POST /login
 *   POST /logout
 *   GET  /me
 *   POST /register              (public employee sign-up)
 *   POST /me/requests
 *   GET  /me/requests
 *   GET  /admin/users           (manager only)
 *   POST /admin/users           (manager only, auto employee_code)
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

// ---------------------------------------------------------------------
// Bootstrap: autoload + DB
// ---------------------------------------------------------------------
require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/../src/db.php';

use App\DB;

// ---------------------------------------------------------------------
// Global CORS headers (explicit origin for Vite dev at :5173)
// ---------------------------------------------------------------------
header('Access-Control-Allow-Origin: http://localhost:5173');
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');

/** Handle preflight requests early (CORS OPTIONS). */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { // If the request is a CORS preflight (OPTIONS), end with 204.
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------
// Error handling (display off, convert errors to exceptions)
// ---------------------------------------------------------------------
error_reporting(E_ALL);
ini_set('display_errors', '0');

/** Global exception handler: always respond JSON for uncaught throwables. */
set_exception_handler(function ($ex): void {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Server error', 'detail' => $ex->getMessage()]);
    exit;
});

/** Convert PHP errors/notices into exceptions to unify flow. */
set_error_handler(function ($severity, $message, $file, $line): void {
    throw new ErrorException($message, 0, $severity, $file, $line);
});

// ---------------------------------------------------------------------
// JSON helpers
// ---------------------------------------------------------------------

/**
 * Emit a JSON response with success data and terminate.
 *
 * @param array<mixed> $data Payload to send back.
 * @param int          $code HTTP status code (default 200).
 */
function json_ok(array $data = [], int $code = 200): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Emit a JSON error object with message and terminate.
 *
 * @param int    $code    HTTP status to send.
 * @param string $message Human-readable error.
 */
function json_error(int $code, string $message): void
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode(['error' => $message], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/**
 * Decode request JSON body into an associative array.
 *
 * @return array<string,mixed> Parsed JSON or empty array on failure.
 */
function json_input(): array
{
    $raw = file_get_contents('php://input') ?: '';
    $in  = json_decode($raw, true);

    // If decoding failed or top-level is not an array, return empty.
    return is_array($in) ? $in : [];
}

// ---------------------------------------------------------------------
// App init (PDO + session)
// ---------------------------------------------------------------------
/** Obtain PDO connection from DB bootstrap; fail fast if missing. */
$db = DB::pdo();
if (!$db) { // If DB initialization failed, return 500.
    json_error(500, 'DB not initialized');
}

/** Configure and start the session cookie with sane defaults. */
session_set_cookie_params([
    'httponly' => true,
    'samesite' => 'Lax',
]);
session_start();

// ---------------------------------------------------------------------
// Additional CORS handling for Vite dev server origin
// ---------------------------------------------------------------------
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

/** Mirror CORS headers only for the known dev origin. */
if ($origin === 'http://localhost:5173') { // If the origin matches Vite dev server, allow credentials and verbs.
    header('Access-Control-Allow-Origin: http://localhost:5173');
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS');
}

/** Exit for a second preflight pass if one happens after session start. */
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { // If a secondary CORS preflight sneaks in, just exit.
    exit;
}

// ---------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------

/** Ensure session is active (idempotent). */
if (session_status() === PHP_SESSION_NONE) { // If no session yet, start it.
    session_start();
}

/**
 * Check if the requester is local development.
 *
 * @return bool True when remote address is loopback.
 */
function is_local(): bool
{
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    return $ip === '127.0.0.1' || $ip === '::1';
}

/**
 * Extract a Bearer token from the Authorization header, if present.
 *
 * @return string|null The token string or null when absent.
 */
function bearer_token(): ?string
{
    $h = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    return (stripos($h, 'Bearer ') === 0) ? substr($h, 7) : null;
}

/**
 * Try to resolve current user from session or (optionally) from a bearer token.
 *
 * @return array<string,mixed>|null User assoc array or null if not authenticated.
 */
function current_user_or_null(): ?array
{
    // 1) Session-stored user (if an app stores full user data in session).
    if (!empty($_SESSION['user'])) { // If session contains 'user', return it directly.
        return $_SESSION['user'];
    }

    // 2) Optional bearer token support (if a token resolver exists).
    $t = bearer_token();
    if ($t && function_exists('find_user_by_token')) { // If token and resolver exist, delegate lookup.
        return find_user_by_token($t);
    }

    // No user available.
    return null;
}

/**
 * Fetch the current user (minimal fields) based on session uid.
 *
 * @param PDO $db Database connection.
 *
 * @return array<string,mixed>|null User row or null if not logged in.
 */
function current_user(PDO $db): ?array
{
    $id = $_SESSION['uid'] ?? null;

    if (!$id) { // If no uid in session, there is no logged-in user.
        return null;
    }

    $st = $db->prepare('SELECT id, name, email, role, employee_code FROM users WHERE id = ?');
    $st->execute([$id]);
    $u = $st->fetch(PDO::FETCH_ASSOC);

    return $u ?: null;
}

/**
 * Require the requester to be authenticated; otherwise 401 JSON.
 *
 * @param PDO $db Database connection.
 *
 * @return array<string,mixed> The authenticated user row.
 */
function require_auth(PDO $db): array
{
    $u = current_user($db);

    if (!$u) { // If not logged in, deny access.
        json_error(401, 'Unauthorized');
    }

    return $u;
}

/**
 * Require the requester to be a manager; otherwise 403 JSON.
 *
 * @param PDO $db Database connection.
 *
 * @return array<string,mixed> The authenticated manager user row.
 */
function require_manager(PDO $db): array
{
    $u = require_auth($db);

    if (($u['role'] ?? '') !== 'manager') { // If role is not manager, forbid.
        json_error(403, 'Forbidden');
    }

    return $u;
}

/**
 * Generate a unique employee code ###-###-### not present in DB.
 *
 * @param PDO $db Database connection.
 *
 * @return string Unique employee code.
 */
function generate_employee_code(PDO $db): string
{
    do {
        $code = sprintf(
            '%03d-%03d-%03d',
            random_int(100, 999),
            random_int(100, 999),
            random_int(0, 999)
        );

        $s = $db->prepare('SELECT 1 FROM users WHERE employee_code = ? LIMIT 1');
        $s->execute([$code]);

        // Repeat until no collision found.
    } while ($s->fetchColumn());

    return $code;
}

/** Double-check session is started (keeps original behavior). */
if (session_status() === PHP_SESSION_NONE) { // If session somehow not active, start again (idempotent).
    session_start();
}

/**
 * Legacy helper: emit raw JSON (kept for compatibility).
 *
 * @param mixed $data Any serializable payload.
 * @param int   $code HTTP status code.
 */
if (!function_exists('json')) { // If a global json() helper is missing, define it for backward compatibility.
    function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
        exit;
    }
}

/**
 * Legacy guard: require logged-in user using the legacy json() helper.
 */
if (!function_exists('require_login')) { // If legacy require_login() not defined, add it.
    function require_login(): void
    {
        if (empty($_SESSION['user'])) { // If no 'user' in session, deny as Unauthorized.
            json(['error' => 'Unauthorized'], 401);
        }
    }
}

/**
 * Legacy guard: require manager role using the legacy json() helper.
 * Note: Name overlaps with typed version above, but guarded by function_exists.
 */
if (!function_exists('require_manager')) { // If the untyped legacy require_manager() is not defined, add it.
    function require_manager(): void
    {
        if (($_SESSION['user']['role'] ?? '') !== 'manager') { // If role not manager, deny as Forbidden.
            json(['error' => 'Forbidden'], 403);
        }
    }
}

// ---------------------------------------------------------------------
// Router: method + path
// ---------------------------------------------------------------------
$method = $_SERVER['REQUEST_METHOD'];
$path   = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/';

/** Normalize when app is mounted under /api (strip the prefix). */
if (str_starts_with($path, '/api/')) { // If the path starts with /api/, remove it for internal routing.
    $path = substr($path, 4);
}
/** Edge case: /api exactly should behave like root. */
if ($path === '/api') { // If exactly '/api', normalize to '/'.
    $path = '/';
}

// ---------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------

/** POST /login — authenticate user by email and password. */
if ($path === '/login' && $method === 'POST') { // If route is /login with POST, attempt authentication.
    $in    = json_input();
    $email = strtolower(trim($in['email'] ?? ''));
    $pass  = (string)($in['password'] ?? '');

    // Validate inputs.
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $pass === '') { // If email invalid or password missing, reject.
        json_error(400, 'Invalid credentials');
    }

    // Fetch user by email.
    $st  = $db->prepare('SELECT id, name, email, role, employee_code, password_hash FROM users WHERE email = ?');
    $st->execute([$email]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    // Verify credentials.
    if (!$row || !password_verify($pass, $row['password_hash'])) { // If user not found or password mismatch, reject.
        json_error(401, 'Invalid email or password');
    }

    // Login success: store uid and return user sans hash.
    $_SESSION['uid'] = (int)$row['id'];
    unset($row['password_hash']);
    json_ok($row);
}

/** POST /logout — destroy the current session. */
if ($path === '/logout' && $method === 'POST') { // If route is /logout with POST, terminate the session.
    session_destroy();
    json_ok(['ok' => true]);
}

/** GET /me — fetch current user details or 401 if not logged in. */
if ($path === '/me' && $method === 'GET') { // If route is /me with GET, return current user or Unauthorized.
    $u = current_user($db);

    if (!$u) { // If no authenticated user, deny access.
        json_error(401, 'Unauthorized');
    }

    json_ok($u);
}

// ---------------------------------------------------------------------
// Public Register (employee)
// ---------------------------------------------------------------------

/** POST /register — create a new employee account (public). */
if ($path === '/register' && $method === 'POST') { // If route is /register with POST, perform registration.
    $in    = json_input();
    $name  = trim($in['name'] ?? '');
    $email = strtolower(trim($in['email'] ?? ''));
    $pass  = (string)($in['password'] ?? '');

    // Validate fields.
    if ($name === '') { // If name empty, reject.
        json_error(400, 'Name required');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { // If email invalid, reject.
        json_error(400, 'Invalid email');
    }
    if (strlen($pass) < 6) { // If password too short, reject.
        json_error(400, 'Password must be at least 6 characters');
    }

    // Ensure email uniqueness.
    $s = $db->prepare('SELECT 1 FROM users WHERE email = ?');
    $s->execute([$email]);
    if ($s->fetchColumn()) { // If email already exists, conflict.
        json_error(409, 'Email already in use');
    }

    // Generate code + hash password, insert new employee.
    $code = generate_employee_code($db);
    $hash = password_hash($pass, PASSWORD_DEFAULT);

    $ins = $db->prepare(
        'INSERT INTO users (name,email,employee_code,role,password_hash,created_at)
         VALUES (?,?,?,?,?,datetime("now"))'
    );
    $ins->execute([$name, $email, $code, 'employee', $hash]);

    json_ok(['ok' => true, 'employee_code' => $code], 201);
}

// ---------------------------------------------------------------------
// Employee: My Requests
// ---------------------------------------------------------------------

/** GET /me/requests — list current user's vacation requests. */
if ($path === '/me/requests' && $method === 'GET') { // If route is /me/requests with GET, list user's requests.
    $u = require_auth($db);

    $st = $db->prepare(
        'SELECT id, user_id, reason, status, date_from, date_to, submitted_at
           FROM vacation_requests
          WHERE user_id = ?
          ORDER BY id DESC'
    );
    $st->execute([$u['id']]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);

    json_ok($rows);
}

/** POST /me/requests — submit a new vacation request for the current user. */
if ($path === '/me/requests' && $method === 'POST') { // If route is /me/requests with POST, create a request.
    $u  = require_auth($db);
    $in = json_input();

    $date_from = trim($in['date_from'] ?? '');
    $date_to   = trim($in['date_to'] ?? '');
    $reason    = trim($in['reason'] ?? '');

    // Simple YYYY-MM-DD validation and non-empty reason.
    $date_re = '/^\d{4}-\d{2}-\d{2}$/';
    if (
        !preg_match($date_re, $date_from) // If start date invalid,
        || !preg_match($date_re, $date_to) // or end date invalid,
        || $reason === '' // or reason missing, reject.
    ) {
        json_error(400, 'Invalid input');
    }

    // Insert pending request.
    $st = $db->prepare(
        'INSERT INTO vacation_requests (user_id, date_from, date_to, reason, status, submitted_at)
         VALUES (?, ?, ?, ?, "pending", datetime("now"))'
    );
    $st->execute([$u['id'], $date_from, $date_to, $reason]);

    json_ok(['id' => (int)$db->lastInsertId()], 201);
}

// ---------------------------------------------------------------------
// Admin: Users
// ---------------------------------------------------------------------

/** GET /admin/users — list users (manager-only). */
if ($path === '/admin/users' && $method === 'GET') { // If route is /admin/users with GET, list all users for managers.
    require_manager($db);

    $rows = $db->query(
        'SELECT id, name, email, role, employee_code, created_at
           FROM users
          ORDER BY id DESC'
    )->fetchAll(PDO::FETCH_ASSOC);

    json_ok($rows);
}

/** POST /admin/users — create a user (manager-only, auto employee_code if missing). */
if ($path === '/admin/users' && $method === 'POST') { // If route is /admin/users with POST, create user as manager.
    require_manager($db);

    $in    = json_input();
    $name  = trim($in['name'] ?? '');
    $email = strtolower(trim($in['email'] ?? ''));
    $pass  = (string)($in['password'] ?? '');
    $role  = ($in['role'] ?? 'employee') === 'manager' ? 'manager' : 'employee';

    // Validate basic fields.
    if ($name === '') { // If name empty, reject.
        json_error(400, 'Name required');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) { // If email invalid, reject.
        json_error(400, 'Invalid email');
    }
    if ($pass === '') { // If password missing, reject.
        json_error(400, 'Password required');
    }

    // Unique email check.
    $s = $db->prepare('SELECT 1 FROM users WHERE email = ?');
    $s->execute([$email]);
    if ($s->fetchColumn()) { // If email already exists, conflict.
        json_error(409, 'Email already in use');
    }

    // Use provided employee_code or generate one.
    $code = trim((string)($in['employee_code'] ?? ''));
    if ($code === '') { // If no code provided, generate a unique one.
        $code = generate_employee_code($db);
    }

    // Insert user.
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $ins  = $db->prepare(
        'INSERT INTO users (name,email,employee_code,role,password_hash,created_at)
         VALUES (?,?,?,?,?,datetime("now"))'
    );
    $ins->execute([$name, $email, $code, $role, $hash]);

    json_ok(['id' => (int)$db->lastInsertId(), 'employee_code' => $code], 201);
}

// ---------------------------------------------------------------------
// Manager: Requests moderation
// ---------------------------------------------------------------------

/** GET /admin/requests — list all requests (manager-only). */
if ($path === '/admin/requests' && $method === 'GET') { // If route is /admin/requests with GET, list all requests.
    require_manager($db);

    $sql  = 'SELECT r.id, r.user_id, r.reason, r.status, r.date_from, r.date_to, r.submitted_at,
                    u.name AS user_name, u.email
               FROM vacation_requests r
               JOIN users u ON u.id = r.user_id
              ORDER BY r.id DESC';
    $rows = $db->query($sql)->fetchAll(PDO::FETCH_ASSOC);

    json_ok($rows);
}

/** POST /admin/requests/{id}/approve|reject — set request status (manager-only). */
if (preg_match('#^/admin/requests/(\d+)/(approve|reject)$#', $path, $m) && $method === 'POST') { // If path matches approve/reject pattern with POST, update status.
    require_manager($db);

    /** @var array{0:string,1:string,2:string} $m */
    [$all, $rid, $action] = $m;
    $status               = $action === 'approve' ? 'approved' : 'rejected';

    $st = $db->prepare('UPDATE vacation_requests SET status = ? WHERE id = ?');
    $st->execute([$status, (int)$rid]);

    json_ok(['ok' => true]);
}

// ---------------------------------------------------------------------
// Admin: Update user
// ---------------------------------------------------------------------

/** PUT /admin/users/{id} — update user fields (manager-only, partial). */
if (preg_match('#^/admin/users/(\d+)$#', $path, $m) && $method === 'PUT') { // If path matches user id with PUT, perform partial update.
    require_manager($db);

    $id = (int)$m[1];
    $in = json_input();

    // Accept partial fields; null means "not provided".
    $name  = isset($in['name']) ? trim((string)$in['name']) : null;
    $email = isset($in['email']) ? strtolower(trim((string)$in['email'])) : null;
    $pass  = isset($in['password']) ? (string)$in['password'] : null;

    // Validate provided fields only.
    if ($name !== null && $name === '') { // If name provided but empty, reject.
        json_error(400, 'Name required');
    }
    if ($email !== null && !filter_var($email, FILTER_VALIDATE_EMAIL)) { // If email provided but invalid, reject.
        json_error(400, 'Invalid email');
    }
    if ($pass !== null && $pass !== '' && strlen($pass) < 6) { // If password provided but too short, reject.
        json_error(400, 'Password too short');
    }

    // Ensure user exists.
    $chk = $db->prepare('SELECT id FROM users WHERE id = ?');
    $chk->execute([$id]);
    if (!$chk->fetchColumn()) { // If user not found, 404.
        json_error(404, 'User not found');
    }

    // Ensure unique email if changing it.
    if ($email !== null) { // If email is provided, check for duplicates (excluding self).
        $du = $db->prepare('SELECT 1 FROM users WHERE email = ? AND id <> ?');
        $du->execute([$email, $id]);
        if ($du->fetchColumn()) { // If duplicate exists, conflict.
            json_error(409, 'Email already in use');
        }
    }

    // Build dynamic UPDATE only with provided fields.
    $sets = [];
    $vals = [];

    if ($name !== null) { // If name provided, include it in SET list.
        $sets[] = 'name = ?';
        $vals[] = $name;
    }

    if ($email !== null) { // If email provided, include it in SET list.
        $sets[] = 'email = ?';
        $vals[] = $email;
    }

    if ($pass !== null && $pass !== '') { // If password provided and non-empty, hash and include it.
        $sets[] = 'password_hash = ?';
        $vals[] = password_hash($pass, PASSWORD_DEFAULT);
    }

    if (!$sets) { // If nothing to update, still return success (no-op).
        json_ok(['ok' => true]);
    }

    $vals[] = $id;
    $sql    = 'UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?';
    $st     = $db->prepare($sql);
    $st->execute($vals);

    json_ok(['ok' => true]);
}

// ---------------------------------------------------------------------
// Admin: Delete user
// ---------------------------------------------------------------------

/** DELETE /admin/users/{id} — delete user (manager-only). */
if ($method === 'DELETE' && preg_match('#^/admin/users/(\d+)$#', $path, $m)) { // If method is DELETE and path has user id, delete user as manager.
    require_manager($db); // If not manager, this call will 403 and exit.

    $id = (int)$m[1];

    // Ensure user exists before deletion.
    $st = $db->prepare('SELECT 1 FROM users WHERE id = ?');
    $st->execute([$id]);
    if (!$st->fetchColumn()) { // If user not found, 404.
        json_error(404, 'Not found');
    }

    // Perform deletion (assumes ON DELETE CASCADE for related vacation_requests).
    $del = $db->prepare('DELETE FROM users WHERE id = ?');
    $del->execute([$id]);

    // No content on success.
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------
// Fallback: no matching route
// ---------------------------------------------------------------------
json_error(404, 'Not found');
