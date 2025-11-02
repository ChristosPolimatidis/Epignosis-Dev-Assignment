/**
 * ---------------- src/pages/EmployeeHome.jsx ----------------
 *
 * JavaScript/React Version: 18+
 * Employee home dashboard.
 * - Lists the signed-in employee's vacation requests
 * - Client-side search, status filter, and pagination
 * - Modal to create a new request
 * - Account pill with sign-out menu
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api';
import Brand from '../components/Brand';
import { useAuth } from '../AuthContext';

/**
 * toDMY
 * Convert "YYYY-MM-DD" to "DD-MM-YYYY" for display.
 *
 * @param {string} s ISO-like date string (YYYY-MM-DD).
 * @returns {string} Formatted "DD-MM-YYYY" or empty string when falsy input.
 */
const toDMY = (s) => {
  if (!s) { // If no string provided, return empty to avoid "undefined".
    return '';
  }
  const [y, m, d] = String(s).split('-');
  return [d, m, y].join('-');
};

/**
 * StatusBadge
 * Semantic badge for request status.
 *
 * @param {{status: 'pending'|'approved'|'rejected'|string}} props
 * @returns {JSX.Element}
 */
function StatusBadge({ status }) {
  const map = {
    pending: { cls: 'badge badge-pending', label: 'Pending' },
    approved: { cls: 'badge badge-accepted', label: 'Accepted' },
    rejected: { cls: 'badge badge-denied', label: 'Denied' },
  };

  // If status key is unknown, fall back to a neutral badge showing raw status.
  const v = map[status] || { cls: 'badge', label: status };
  return <span className={v.cls}>{v.label}</span>;
}

/**
 * HeaderUserWithMenu
 * Shows user initial/name and a small account menu to sign out.
 *
 * Behavior:
 * - Clicking outside the menu closes it (document-level click handler).
 * - Sign out tries useAuth().signOut or .logout, then clears tokens and redirects.
 */
function HeaderUserWithMenu() {
  const { user, signOut, logout } = useAuth();
  const doLogout = signOut || logout; // Prefer signOut; otherwise fallback to logout
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    /** Close the menu when clicking outside of the component. */
    const onDocClick = (e) => {
      if (!ref.current) { // If ref not ready, ignore.
        return;
      }
      if (!ref.current.contains(e.target)) { // If click target is outside container, close.
        setOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const name = user?.name || ''; // If user or name missing, default to empty string.
  const initial = name?.trim()?.[0]?.toUpperCase?.() || 'U'; // If name empty, default initial 'U'.

  /**
   * handleSignOut
   * Calls backend logout (best effort), clears client tokens, then redirects.
   */
  const handleSignOut = async () => {
    /** Safe local/session storage remover (catches quota/denied errors). */
    const safeRemove = (store, key) => {
      try {
        if (store && typeof store.removeItem === 'function') {
          store.removeItem(key);
        }
      } catch (e) {
        void e; // If removal throws, swallow—logout should still proceed.
      }
    };

    try {
      if (typeof doLogout === 'function') { // If auth context provides a logout, use it.
        await doLogout();
      } else if (api && typeof api.logout === 'function') { // Else if api client exposes logout, call it.
        await api.logout();
      }
    } catch (e) {
      void e; // If network/logout fails, continue to client cleanup.
    } finally {
      if (typeof window !== 'undefined') { // If running in the browser, clear tokens and redirect.
        safeRemove(window.localStorage, 'token');
        safeRemove(window.sessionStorage, 'token');
        window.location.assign('/'); // Hard redirect to login/root.
      }
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'grid', justifyItems: 'end' }}>
      {/* Account pill button — toggles menu visibility */}
      <button
        onClick={() => setOpen((v) => !v)} // If open, close; else open.
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '6px 12px',
          background: '#eef6f1',
          border: '1px solid #d9e7df',
          borderRadius: 999,
          cursor: 'pointer',
          boxShadow: open ? '0 6px 18px rgba(47,107,79,.18)' : '0 2px 6px rgba(47,107,79,.10)',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            background: 'linear-gradient(135deg,#2f6b4f,#56a37d)',
            color: '#fff',
          }}
        >
          {initial}
        </span>
        <span className="emp-user" style={{ fontWeight: 700, color: '#2f2f2f', letterSpacing: 0.2 }}>
          {name}
        </span>
      </button>

      {/* Menu popover: only rendered while open === true */}
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 10px)',
            right: 0,
            minWidth: 200,
            padding: 10,
            borderRadius: 14,
            background: 'rgba(255,255,255,.9)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            border: '1px solid #e6e6e6',
            boxShadow: '0 14px 34px rgba(0,0,0,.12)',
            animation: 'popIn .12s ease',
            zIndex: 50,
          }}
        >
          {/* caret */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -6,
              right: 22,
              width: 12,
              height: 12,
              background: 'inherit',
              borderLeft: '1px solid #e6e6e6',
              borderTop: '1px solid #e6e6e6',
              transform: 'rotate(45deg)',
            }}
          />
          <div style={{ padding: 6 }}>
            <div style={{ fontSize: 12, color: '#6b6b6b', marginBottom: 8 }}>
              Signed in as <b style={{ color: '#2f6b4f' }}>{name}</b>
            </div>
            <button
              onClick={handleSignOut}
              style={{
                width: '100%',
                border: 0,
                borderRadius: 10,
                padding: '12px 14px',
                fontWeight: 800,
                background: 'linear-gradient(135deg,#ff5858,#e0433b)',
                color: '#fff',
                cursor: 'pointer',
                boxShadow: '0 8px 22px rgba(224,67,59,.35)',
              }}
            >
              ⏻  Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * EmployeeHome
 * Main screen for employees: list + filter + pagination + "Create Request" modal.
 *
 * State:
 * - items: fetched requests
 * - q: search query
 * - fStatus: status filter (all|pending|approved|rejected)
 * - page/pageSize: pagination state
 * - showNew: toggles creation modal
 */
export default function EmployeeHome() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 5;
  const [showNew, setShowNew] = useState(false);

  /** load
   * Fetch the current user's requests from the API.
   */
  const load = async () => setItems(await api.myRequests());

  useEffect(() => {
    load(); // On initial mount, load data once.
  }, []);

  /**
   * filtered
   * Apply search + status filtering memoized by inputs.
   */
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();

    return items.filter((r) => {
      if (fStatus !== 'all' && r.status !== fStatus) { // If status filter active and does not match, drop.
        return false;
      }
      if (!term) { // If no search term, keep item.
        return true;
      }

      // Construct a search haystack using reason, date range, and submitted date.
      const hay = [
        r.reason,
        r.date_from,
        r.date_to,
        new Date(r.submitted_at).toLocaleDateString(),
      ]
        .join(' ')
        .toLowerCase();

      return hay.includes(term); // If haystack contains term, keep item.
    });
  }, [items, q, fStatus]);

  /** Compute page count and slice current page items. */
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    if (page > totalPages) { // If current page exceeds total after filtering, clamp to last page.
      setPage(totalPages);
    }
  }, [totalPages, page]);

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ width: 'min(980px,96vw)' }}>
        <div className="emp-header">
          <Brand />
          <div style={{ display: 'grid', gap: 10, textAlign: 'right' }}>
            <HeaderUserWithMenu />
            <div>
              {/* Opens the Create Request modal */}
              <button className="emp-new" onClick={() => setShowNew(true)}>
                + New Request
              </button>
            </div>
          </div>
        </div>

        <h1 className="auth-title" style={{ marginTop: 0 }}>
          My Requests
        </h1>

        {/* Toolbar: search + status filter (both reset page to 1 on change) */}
        <div className="emp-toolbar">
          <input
            className="emp-input"
            placeholder="Search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value); // Update query.
              setPage(1); // If query changed, reset to first page.
            }}
          />
          <select
            className="emp-select"
            value={fStatus}
            onChange={(e) => {
              setFStatus(e.target.value); // Update status filter.
              setPage(1); // If filter changed, reset to first page.
            }}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Accepted</option>
            <option value="rejected">Denied</option>
          </select>
        </div>

        {/* Requests table */}
        <table className="emp-table">
          <thead>
            <tr>
              <th>Submit</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id}>
                <td style={{ width: 150 }}>
                  {new Date(r.submitted_at).toLocaleDateString()}
                </td>
                <td style={{ width: 220 }}>
                  <div>{toDMY(r.date_from)}</div>
                  <div>{toDMY(r.date_to)}</div>
                </td>
                <td>{r.reason}</td>
                <td style={{ width: 160 }}>
                  <StatusBadge status={r.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Empty-state hint when no rows on current page */}
        {pageItems.length === 0 && (
          <>
            <div className="emp-sep" />
            <div style={{ opacity: 0.6, padding: '8px 4px' }}>
              No requests match your filters.
            </div>
          </>
        )}

        <div className="emp-sep" />

        {/* Pagination controls */}
        <div className="emp-pages">
          <button
            className="emp-page"
            onClick={() => setPage((p) => Math.max(1, p - 1))} // If not on first page, go back one.
          >
            &lsaquo;
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              className="emp-page"
              aria-current={n === page}
              onClick={() => setPage(n)} // If clicked, switch to page n.
            >
              {n}
            </button>
          ))}

          <button
            className="emp-page"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} // If not on last page, go forward one.
          >
            &rsaquo;
          </button>
        </div>
      </div>

      {/* Mount the create modal when showNew === true */}
      {showNew && (
        <CreateRequestModal
          onClose={() => {
            setShowNew(false); // If closed, hide the modal.
          }}
          onCreated={async () => {
            setShowNew(false); // If created successfully, hide the modal
            await load(); // and refresh the list.
          }}
        />
      )}
    </div>
  );
}

/**
 * CreateRequestModal
 * Simple modal to post a new request.
 *
 * Props:
 * - onClose(): close modal without creating
 * - onCreated(): callback after creation for parent to refresh
 */
function CreateRequestModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ date_from: '', date_to: '', reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  /**
   * submit
   * Validate and send the form to backend.
   */
  const submit = async (e) => {
    e?.preventDefault?.(); // If event exists, prevent native form submit.

    setErr(''); // Clear any prior error.

    if (!form.date_from || !form.date_to || !form.reason.trim()) { // If any field missing, show error and stop.
      setErr('Please fill all fields');
      return;
    }

    setBusy(true);

    try {
      await api.createRequest(form); // Send POST /me/requests
      await onCreated?.(); // If parent provided a callback, invoke it.
    } catch (e) {
      setErr(e.message || 'Failed to create'); // If server/JS error, surface message.
    } finally {
      setBusy(false); // Always clear busy flag at the end.
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose /* If backdrop clicked, close modal. */}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation() /* If card clicked, do not bubble to backdrop. */}
      >
        <Brand />
        <h2 className="auth-title" style={{ marginTop: 0 }}>
          Create Request
        </h2>

        {/* onSubmit delegates to submit() for validation + API call */}
        <form onSubmit={submit}>
          <div className="modal-grid">
            <div>
              <div className="label">Date From</div>
              <input
                className="input"
                type="date"
                value={form.date_from}
                onChange={(e) => setForm({ ...form, date_from: e.target.value })}
                placeholder="DD-MM-YYYY"
              />
            </div>
            <div>
              <div className="label">Date To</div>
              <input
                className="input"
                type="date"
                value={form.date_to}
                onChange={(e) => setForm({ ...form, date_to: e.target.value })}
                placeholder="DD-MM-YYYY"
              />
            </div>
            <div className="full">
              <div className="label">Reason</div>
              <textarea
                className="input"
                rows={6}
                placeholder="The reason is..."
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>

          {/* Error message area */}
          {err && <div style={{ color: 'crimson', fontWeight: 700, marginTop: 6 }}>{err}</div>}

          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={busy /* If busy, disable submit. */}>
              Create Request
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose /* If cancel, close modal. */}>
              <span className="icon-x">×</span>
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** Inject tiny keyframes used by the menu popover (guarded to avoid duplicates). */
const style = document.createElement('style');
style.innerHTML = `
@keyframes popIn { from { opacity:0; transform: translateY(-4px) scale(.98); }
                    to   { opacity:1; transform: translateY(0)    scale(1); } }
`;
if (typeof document !== 'undefined' && !document.getElementById('popInKeyframes')) { // If running in DOM and not yet injected, append once.
  style.id = 'popInKeyframes';
  document.head.appendChild(style);
}
