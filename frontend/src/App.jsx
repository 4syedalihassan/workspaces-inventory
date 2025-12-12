import { useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Layout } from 'antd';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import WorkSpaces from './pages/WorkSpaces';
import Usage from './pages/Usage';
import Billing from './pages/Billing';
import CloudTrail from './pages/CloudTrail';
import Settings from './pages/Settings';

const { Content } = Layout;

// Private Route wrapper component
function PrivateRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('authToken');
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Admin Route wrapper component - requires ADMIN role
function AdminRoute({ children }) {
  const isAuthenticated = !!localStorage.getItem('authToken');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'ADMIN';
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function App() {
  const [lastSync, setLastSync] = useState(null);
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  return (
    <div className="app">
      <Layout style={{ minHeight: '100vh' }}>
        {!isLoginPage && <Navbar lastSync={lastSync} setLastSync={setLastSync} />}
        <Content style={{
          padding: isLoginPage ? 0 : '24px',
          background: '#f5f7fa',
          minHeight: 'calc(100vh - 64px)'
        }}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <PrivateRoute>
                  <Dashboard setLastSync={setLastSync} />
                </PrivateRoute>
              }
            />
            <Route
              path="/workspaces"
              element={
                <PrivateRoute>
                  <WorkSpaces />
                </PrivateRoute>
              }
            />
            <Route
              path="/usage"
              element={
                <PrivateRoute>
                  <Usage />
                </PrivateRoute>
              }
            />
            <Route
              path="/billing"
              element={
                <PrivateRoute>
                  <Billing />
                </PrivateRoute>
              }
            />
            <Route
              path="/cloudtrail"
              element={
                <AdminRoute>
                  <CloudTrail />
                </AdminRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <AdminRoute>
                  <Settings />
                </AdminRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <Navigate to="/settings" replace />
                </AdminRoute>
              }
            />
          </Routes>
        </Content>
      </Layout>
    </div>
  );
}

export default App;
