/**
 * ---------------- src/pages/Login.jsx ----------------
 *
 * JavaScript/React Version: 18+
 * Login page.
 * - Uses Auth context to perform POST /login via api.js
 * - On success, redirects managers to /manager and employees to /employee
 * - Includes password visibility toggle and a UI-only "Remember me"
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';

/**
 * Login
 * Top-level login form component.
 *
 * State:
 * - email/password: controlled inputs
 * - showPw: toggles password field visibility
 * - remember: UI-only checkbox (no backend effect)
 * - error: shows last authentication error
 *
 * Behaviors:
 * - onSubmit() prevents default form submit, calls login(email,password),
 *   and navigates according to returned user role.
 *
 * @returns {JSX.Element} The login page.
 */
export default function Login() {
  // Controlled form fields and UI flags.
  const [email, setEmail] = useState('');       // User’s email (controlled)
  const [password, setPassword] = useState(''); // User’s password (controlled)
  const [showPw, setShowPw] = useState(false);  // If true, show password in plain text
  const [remember, setRemember] = useState(false); // UI-only "Remember me" (no persistence)
  const [error, setError] = useState('');       // Last error message shown under the form

  // Auth context (provides login function that hits the backend).
  const { login } = useAuth();

  // Router navigation helper.
  const nav = useNavigate();

  /**
   * onSubmit
   * Handles form submission.
   * - Prevents default browser submit/navigation.
   * - Calls login(email,password) via AuthContext.
   * - Redirects based on role:
   *   if (me.role === 'manager') go to /manager else /employee.
   * - On failure, displays a human-friendly error.
   */
  const onSubmit = async (e) => {
    e.preventDefault(); // Stop native form submission to handle it via JS.

    try {
      const me = await login(email, password);

      // If user is a manager, send to /manager; otherwise to /employee.
      // This ternary is equivalent to: if (me.role === 'manager') {...} else {...}
      nav(me.role === 'manager' ? '/manager' : '/employee', { replace: true });
    } catch (err) {
      // If login throws (non-2xx), show the server-provided message or a fallback.
      setError(err.message || 'Login failed');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <div className="auth-title">Sign In</div>

        {/* onSubmit: see handler above for behavior and navigation logic */}
        <form onSubmit={onSubmit}>
          <div className="label">Email</div>
          <input
            className="input"
            type="email"
            placeholder="johndoes@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)} // Update email as the user types
          />

          <div className="label">Password</div>

          <div className="input-wrap">
            {/* If showPw is true, input type is 'text'; otherwise keep it as 'password'. */}
            <input
              className="input"
              type={showPw ? 'text' : 'password'}
              placeholder="ThisIsAnExample12#"
              value={password}
              onChange={(e) => setPassword(e.target.value)} // Update password as the user types
            />

            {/* Toggle password visibility when pressed (no form submit). */}
            <button
              type="button"
              className="eye"
              onClick={() => setShowPw((s) => !s)} // if (s === true) set false; else set true
              aria-label="toggle password"
            >
              {/* If showPw is true, render an "eye-open" icon; else render "eye-off". */}
              {showPw ? (
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" fill="#393636" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24">
                  <path d="M3.5 2.5 21.5 20.5" stroke="#393636" />
                  <path d="M2 12s3.5-7 10-7c2.1 0 3.9.6 5.4 1.5M22 12s-3.5 7-10 7c-2.1 0-3.9-.6-5.4-1.5" stroke="#393636" fill="none" />
                  <circle cx="12" cy="12" r="3" fill="#393636" />
                </svg>
              )}
            </button>
          </div>

          <label className="row" style={{ marginTop: 10 }}>
            <input
              className="checkbox"
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)} // UI-only toggle; no persistence
            />
            <span style={{ fontWeight: 800 }}>Remember me</span>
          </label>

          {/* If there is an error message, render it in red below the inputs. */}
          {error && (
            <div style={{ color: 'crimson', marginTop: 6, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <button className="btn-primary" type="submit">
            Login
          </button>

          <div className="helper">
            Dont have an account?{' '}
            <Link to="/register" className="link">
              Sign Up
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
