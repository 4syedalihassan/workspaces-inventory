import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import WorkSpaces from './pages/WorkSpaces';
import Usage from './pages/Usage';
import Billing from './pages/Billing';
import CloudTrail from './pages/CloudTrail';
import Admin from './pages/Admin';
import './App.css';

function App() {
  const [lastSync, setLastSync] = useState(null);

  return (
    <div className="app">
      <Navbar lastSync={lastSync} setLastSync={setLastSync} />
      <div className="container-fluid py-4">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard setLastSync={setLastSync} />} />
          <Route path="/workspaces" element={<WorkSpaces />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/cloudtrail" element={<CloudTrail />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </div>
  );
}

export default App;
