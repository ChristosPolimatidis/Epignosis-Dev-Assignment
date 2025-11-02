/**
 * ---------------- src/pages/Register.jsx ----------------
 *
 * JavaScript/React Version: 18+
 * Public registration page.
 * - Uses api.register() to call POST /register
 * - Client-side validation for required fields and password match
 * - Role radio is UI-only (backend ignores it on public sign-up)
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

import { useState } from 'react';
import { api } from '../api';
import { Link, useNavigate } from 'react-router-dom';
import Brand from '../components/Brand';

/**
 * Register
 * Top-level sign-up form component.
 *
 * State:
 * - form: { name, email, password, confirm, role }
 * - show1/show2: toggle visibility for password inputs
 * - error: last error message to show to the user
 * - loading: disables submit while awaiting backend
 *
 * Behavior:
 * - submit(e): prevents default, validates inputs, calls api.register,
 *   and navigates to /login on success.
 *
 * @returns {JSX.Element} The registration page.
 */
export default function Register() {
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirm: '',
    role: 'employee',
  });

  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  /**
   * change
   * Update a single form field by key.
   *
   * @param {string} k Field name (e.g., "email").
   * @param {string} v New value.
   */
  const change = (k, v) => setForm((s) => ({ ...s, [k]: v }));

  /**
   * submit
   * Handle form submission:
   * - Prevent native submit.
   * - Validate required fields and matching passwords.
   * - Call api.register with {name,email,password}.
   * - On success, redirect to /login.
   *
   * @param {React.FormEvent} e Submit event.
   */
  const submit = async (e) => {
    e.preventDefault(); // Prevent full page reload; we handle submission in JS.

    setError('');

    // Validate presence of basic fields.
    if (!form.name || !form.email || !form.password) {
      // If any required field is missing, show error and stop.
      setError('Please fill all fields');
      return;
    }

    // Validate password confirmation.
    if (form.password !== form.confirm) {
      // If passwords differ, show error and stop.
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      // NOTE: Backend public /register ignores role; role radio is UI-only here.
      await api.register({
        name: form.name,
        email: form.email,
        password: form.password,
      });

      nav('/login'); // On successful registration, go to the Sign In page.
    } catch (err) {
      // If server returned an error, display it; else show a generic message.
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <div className="auth-title">Sign Up</div>

        {/* onSubmit: see submit() above for validation and navigation flow */}
        <form onSubmit={submit}>
          <div className="label">Name</div>
          <input
            className="input"
            placeholder="John Doe"
            value={form.name}
            onChange={(e) => change('name', e.target.value)}
          />

          <div className="label">Email</div>
          <input
            className="input"
            type="email"
            placeholder="johndoes@example.com"
            value={form.email}
            onChange={(e) => change('email', e.target.value)}
          />

          <div className="label">Password</div>
          <div className="input-wrap">
            <input
              className="input"
              type={show1 ? 'text' : 'password'} // If show1 is true, show plaintext; else mask.
              placeholder="ThisIsAnExample12#"
              value={form.password}
              onChange={(e) => change('password', e.target.value)}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShow1((s) => !s)} // If currently visible, hide; else show.
              aria-label="toggle password"
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  fill="#393636"
                />
              </svg>
            </button>
          </div>

          <div className="label">Confirm Password</div>
          <div className="input-wrap">
            <input
              className="input"
              type={show2 ? 'text' : 'password'} // If show2 is true, show plaintext; else mask.
              placeholder="ThisIsAnExample12#"
              value={form.confirm}
              onChange={(e) => change('confirm', e.target.value)}
            />
            <button
              type="button"
              className="eye"
              onClick={() => setShow2((s) => !s)} // Toggle visibility for confirm field.
              aria-label="toggle password"
            >
              <svg width="22" height="22" viewBox="0 0 24 24">
                <path
                  d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 4a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"
                  fill="#393636"
                />
              </svg>
            </button>
          </div>

          {/* Role selection (UI-only). Keeps parity with original behavior. */}
          <div className="row" style={{ marginTop: 14 }}>
            <label className="row" style={{ gap: 10, margin: 0 }}>
              <input
                className="radio"
                type="radio"
                name="role"
                value="employee"
                checked={form.role === 'employee'}
                onChange={() => change('role', 'employee')} // If chosen, store 'employee' in form.role.
              />
              <span style={{ fontWeight: 800 }}>Employee</span>
            </label>

            <label className="row" style={{ gap: 10, marginLeft: 22 }}>
              <input
                className="radio"
                type="radio"
                name="role"
                value="manager"
                checked={form.role === 'manager'}
                onChange={() => change('role', 'manager')} // If chosen, store 'manager' in form.role.
              />
              <span style={{ fontWeight: 800 }}>Manager</span>
            </label>
          </div>

          {/* If there is a validation/server error, show it under the controls. */}
          {error && (
            <div style={{ color: 'crimson', marginTop: 6, fontWeight: 700 }}>
              {error}
            </div>
          )}

          <button className="btn-primary" disabled={loading} type="submit">
            {loading ? 'Registering…' : 'Register'}
          </button>

          <div className="helper">
            You have an account?{' '}
            <Link to="/login" className="link">
              Sign In
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
