import { useEffect, useState } from 'react';
import { getDashboardStats, getWorkspaces, getSyncHistory } from '../api';

function Dashboard({ setLastSync }) {
  const [stats, setStats] = useState({});
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);
  const [syncHistory, setSyncHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsData, workspacesData, syncData] = await Promise.all([
        getDashboardStats(),
        getWorkspaces({ limit: 10 }),
        getSyncHistory({ limit: 10 })
      ]);

      setStats(statsData);
      setRecentWorkspaces(workspacesData.data || []);
      setSyncHistory(syncData.data || []);
      if (statsData.last_sync) {
        setLastSync(statsData.last_sync);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStateBadgeClass = (state) => {
    const stateMap = {
      'AVAILABLE': 'success',
      'PENDING': 'warning',
      'TERMINATED': 'danger',
      'STOPPED': 'secondary'
    };
    return `bg-${stateMap[state] || 'secondary'}`;
  };

  if (loading) {
    return (
      <div className="text-center py-5">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="row mb-4">
        <div className="col-md-3">
          <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
            <div className="card-body">
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {stats.total_workspaces || 0}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Total WorkSpaces</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
            <div className="card-body">
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {stats.active_workspaces || 0}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Active WorkSpaces</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
            <div className="card-body">
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {stats.current_month_usage?.total_hours?.toFixed(1) || '0'}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Usage Hours (This Month)</div>
            </div>
          </div>
        </div>
        <div className="col-md-3">
          <div className="card" style={{ borderLeft: '4px solid var(--secondary-color)' }}>
            <div className="card-body">
              <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary-color)' }}>
                {stats.current_month_usage?.avg_hours?.toFixed(1) || '0'}
              </div>
              <div style={{ color: '#666', fontSize: '0.9rem' }}>Avg Hours/WorkSpace</div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Recent WorkSpaces</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>State</th>
                      <th>Running Mode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentWorkspaces.map((ws, idx) => (
                      <tr key={idx}>
                        <td>{ws.user_name || '-'}</td>
                        <td>
                          <span className={`badge ${getStateBadgeClass(ws.state)}`}>
                            {ws.state || '-'}
                          </span>
                        </td>
                        <td>{ws.running_mode || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-6">
          <div className="card">
            <div className="card-header">
              <h5 className="mb-0">Sync History</h5>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table table-sm table-hover">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Records</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {syncHistory.map((sync, idx) => (
                      <tr key={idx}>
                        <td>{sync.sync_type}</td>
                        <td>
                          <span className={`badge bg-${
                            sync.status === 'completed' ? 'success' : 
                            sync.status === 'failed' ? 'danger' : 'warning'
                          }`}>
                            {sync.status}
                          </span>
                        </td>
                        <td>{sync.records_processed || 0}</td>
                        <td>{new Date(sync.started_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
