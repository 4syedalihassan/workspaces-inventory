import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from '@mui/material';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import WorkSpaces from './pages/WorkSpaces';
import Usage from './pages/Usage';
import Billing from './pages/Billing';
import CloudTrail from './pages/CloudTrail';
import Admin from './pages/Admin';

function App() {
  const [lastSync, setLastSync] = useState(null);

  return (
    <div className="app">
      <Navbar lastSync={lastSync} setLastSync={setLastSync} />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard setLastSync={setLastSync} />} />
          <Route path="/workspaces" element={<WorkSpaces />} />
          <Route path="/usage" element={<Usage />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/cloudtrail" element={<CloudTrail />} />
          <Route path="/admin" element={<Admin />} />
        </Routes>
      </Container>
    </div>
  );
}

export default App;
