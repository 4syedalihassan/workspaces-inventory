import { NavLink } from 'react-router-dom';
import { triggerSync } from '../api';
import { useState } from 'react';

function Navbar({ lastSync, setLastSync }) {
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync('all');
      setLastSync(new Date().toISOString());
      alert('Sync triggered successfully');
    } catch (error) {
      console.error('Sync failed:', error);
      alert('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark" style={{ backgroundColor: 'var(--primary-color)' }}>
      <div className="container-fluid">
        <NavLink className="navbar-brand" to="/dashboard" style={{ color: 'var(--secondary-color)' }}>
          <i className="bi bi-pc-display-horizontal"></i> WorkSpaces Inventory
        </NavLink>
        <button 
          className="navbar-toggler" 
          type="button" 
          data-bs-toggle="collapse" 
          data-bs-target="#navbarNav"
        >
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav me-auto">
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/dashboard"
                style={({ isActive }) => ({ 
                  color: isActive ? 'var(--secondary-color)' : '#fff' 
                })}
              >
                Dashboard
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/workspaces"
                style={({ isActive }) => ({ 
                  color: isActive ? 'var(--secondary-color)' : '#fff' 
                })}
              >
                WorkSpaces
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/usage"
                style={({ isActive }) => ({ 
                  color: isActive ? 'var(--secondary-color)' : '#fff' 
                })}
              >
                Usage
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/billing"
                style={({ isActive }) => ({ 
                  color: isActive ? 'var(--secondary-color)' : '#fff' 
                })}
              >
                Billing
              </NavLink>
            </li>
            <li className="nav-item">
              <NavLink 
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                to="/cloudtrail"
                style={({ isActive }) => ({ 
                  color: isActive ? 'var(--secondary-color)' : '#fff' 
                })}
              >
                Audit Log
              </NavLink>
            </li>
          </ul>
          <div className="d-flex align-items-center">
            <span className="text-light me-3" style={{ fontSize: '0.85rem' }}>
              Last sync: {formatDate(lastSync)}
            </span>
            <button 
              className="btn btn-outline-light btn-sm" 
              onClick={handleSync}
              disabled={syncing}
            >
              <i className={`bi bi-arrow-repeat ${syncing ? 'spinner-border spinner-border-sm' : ''}`}></i> 
              {syncing ? ' Syncing...' : ' Sync Now'}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
