/**
 * ---------------- src/api.js ----------------
 *
 * JavaScript Version: ES2022+
 * Minimal API client.
 * - Base path: /api (proxied or backend-mounted prefix)
 * - Credentials: include (session cookies)
 * - JSON helpers + typed endpoints
 *
 * Routes covered:
 *   Auth: POST /login, POST /logout, GET /me, POST /register
 *   Employee: GET/POST /me/requests
 *   Manager Users: GET/POST/PUT/DELETE /admin/users, DELETE /admin/users/:id
 *   Manager Requests: GET /admin/requests, POST /admin/requests/:id/(approve|reject)
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

const base = '/api';

/**
 * req
 * Thin wrapper around fetch that:
 *  - prefixes with `base`
 *  - includes credentials for session cookies
 *  - sends/accepts JSON
 *  - throws on non-2xx with a human message
 *
 * @param {string} path   API path beginning with '/'
 * @param {RequestInit} [options] fetch options override
 * @returns {Promise<any>} parsed JSON
 */
async function req(path, options = {}) {
  const res = await fetch(base + path, {
    credentials: 'include', // Always include cookies for session-bound auth
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  // Try to parse JSON even on errors so we can surface {error}
  const data = await res.json().catch(() => ({}));

  // If status outside 2xx, raise a descriptive error to the caller.
  if (!res.ok) {
    // If the server provided an error string, prefer it; otherwise fall back to status.
    const msg = (data && data.error) ? data.error : `Request failed: ${res.status}`;
    throw new Error(msg);
  }

  return data;
}

/**
 * deleteUser (standalone export)
 * Direct DELETE call used by older code paths.
 * Note: There is also api.deleteUser below; both are kept for backward compatibility.
 *
 * @param {number|string} id User ID to delete.
 * @returns {Promise<any>} backend response JSON (if any).
 */
export async function deleteUser(id) {
  const res = await fetch(`/admin/users/${id}`, {
    method: 'DELETE',
    credentials: 'include', // Required so the server sees the session
    headers: { 'Content-Type': 'application/json' },
  });

  // On failure, attempt to surface {error} or provide a generic message.
  if (!res.ok) {
    const errJson = await res.json().catch(() => ({})); // If body not JSON, default to empty object.
    // If server responded with {error}, use it; else use a fixed fallback.
    throw new Error(errJson.error || 'Delete failed');
  }

  // Some DELETE endpoints may return an empty body; try JSON and fall back to empty object.
  return res.json().catch(() => ({}));
}

// -----------------------------------------------------------------------------
// Structured API surface
// -----------------------------------------------------------------------------

/**
 * api
 * Organized endpoints for convenient importing in components.
 */
export const api = {
  // ---------------- Auth ----------------

  /**
   * POST /login
   * @param {string} email
   * @param {string} password
   */
  login: (email, password) =>
    req('/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  /**
   * POST /register
   * @param {object} payload {name,email,password}
   */
  register: (payload) =>
    req('/register', { method: 'POST', body: JSON.stringify(payload) }),

  /** POST /logout */
  logout: () => req('/logout', { method: 'POST' }),

  /** GET /me */
  me: () => req('/me', { method: 'GET' }),

  // -------------- Employee --------------

  /** GET /me/requests */
  myRequests: () => req('/me/requests', { method: 'GET' }),

  /**
   * POST /me/requests
   * @param {object} payload {date_from,date_to,reason}
   */
  createRequest: (payload) =>
    req('/me/requests', { method: 'POST', body: JSON.stringify(payload) }),

  /**
   * DELETE /me/requests/:id
   * (Note: backend route may not be implemented; kept if you add it later.)
   */
  deleteRequest: (id) => req(`/me/requests/${id}`, { method: 'DELETE' }),

  // ------------- Manager: users -------------

  /** GET /admin/users */
  listUsers: () => req('/admin/users', { method: 'GET' }),

  /**
   * POST /admin/users
   * @param {object} u {name,email,password,role?,employee_code?}
   */
  createUser: (u) =>
    req('/admin/users', { method: 'POST', body: JSON.stringify(u) }),

  /**
   * PUT /admin/users/:id
   * @param {number|string} id
   * @param {object} payload partial fields {name?,email?,password?}
   */
  updateUser: (id, payload) =>
    req(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  /**
   * DELETE /admin/users/:id
   * Duplicate of the standalone export for compatibility with newer code paths.
   * @param {number|string} id
   */
  deleteUser: (id) => req(`/admin/users/${id}`, { method: 'DELETE' }),

  // ----------- Manager: requests -----------

  /** GET /admin/requests */
  allRequests: () => req('/admin/requests'),

  /**
   * POST /admin/requests/:id/approve
   * @param {number|string} id
   */
  approve: (id) => req(`/admin/requests/${id}/approve`, { method: 'POST' }),

  /**
   * POST /admin/requests/:id/reject
   * @param {number|string} id
   */
  reject: (id) => req(`/admin/requests/${id}/reject`, { method: 'POST' }),
};
