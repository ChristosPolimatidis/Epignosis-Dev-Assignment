/**
 * ---------------- src/App.jsx ----------------
 *
 * JavaScript/React Version: 18+
 * Root application router.
 * - Provides Auth context
 * - Mounts BrowserRouter
 * - Defines route table and safe fallbacks
 *
 * Author: Christos Polimatidis
 * Date:   2025-11-01
 */

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthProvider from './AuthContext';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import EmployeeHome from './pages/EmployeeHome.jsx';
import ManagerHome from './pages/ManagerHome.jsx';

/**
 * App
 * Top-level component wiring auth + routing.
 *
 * @returns {JSX.Element} The application shell with routes.
 */
export default function App() {
  return (
    <AuthProvider>
      {/* BrowserRouter provides history + location context */}
      <BrowserRouter>
        <Routes>
          {/* Redirect root to /login to provide a clear entry point */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          {/* Employee area (guarding should be handled inside pages or via wrappers) */}
          <Route path="/employee" element={<EmployeeHome />} />
          {/* Manager area */}
          <Route path="/manager" element={<ManagerHome />} />
          {/* Catch-all: any unknown path goes to /login to avoid 404 screens */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
