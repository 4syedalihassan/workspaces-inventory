import { useEffect, useState } from 'react';
import { getUsage, exportUsage } from '../api';

function Usage() {
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    user_name: '',
    month_from: '',
    month_to: ''
  });
  const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0 });

  useEffect(() => {
    loadUsage();
  }, []);

  const loadUsage = async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        offset: newOffset,
        limit: pagination.limit
      };
      
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const data = await getUsage(params);
      setUsage(data.data || []);
      setPagination(prev => ({ ...prev, offset: newOffset, total: data.total || 0 }));
    } catch (error) {
      console.error('Error loading usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    loadUsage(0);
  };

  const handleClearFilters = () => {
    setFilters({
      user_name: '',
      month_from: '',
      month_to: ''
    });
    setTimeout(() => loadUsage(0), 0);
  };

  const handleExport = async (format) => {
    try {
      await exportUsage(format, filters);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    }
  };

  return (
    <div>
      <div className="card mb-3" style={{ backgroundColor: '#fff', padding: '1rem', borderRadius: '0.5rem' }}>
        <div className="row g-3">
          <div className="col-md-2">
            <label className="form-label">User Name</label>
            <input 
              type="text" 
              className="form-control" 
              name="user_name"
              value={filters.user_name}
              onChange={handleFilterChange}
              placeholder="Search..." 
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">Month From</label>
            <input 
              type="month" 
              className="form-control" 
              name="month_from"
              value={filters.month_from}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">Month To</label>
            <input 
              type="month" 
              className="form-control" 
              name="month_to"
              value={filters.month_to}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-primary me-2" onClick={handleApplyFilters}>
              <i className="bi bi-search"></i> Filter
            </button>
            <button className="btn btn-outline-secondary" onClick={handleClearFilters}>Clear</button>
          </div>
          <div className="col-md-4 d-flex align-items-end justify-content-end">
            <div className="dropdown">
              <button 
                className="btn btn-success dropdown-toggle" 
                type="button" 
                data-bs-toggle="dropdown"
              >
                <i className="bi bi-download"></i> Export
              </button>
              <ul className="dropdown-menu">
                <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleExport('xlsx'); }}>Excel</a></li>
                <li><a className="dropdown-item" href="#" onClick={(e) => { e.preventDefault(); handleExport('csv'); }}>CSV</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          {loading && (
            <div className="text-center py-3">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
            </div>
          )}
          
          {!loading && (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Workspace ID</th>
                    <th>User</th>
                    <th>Bundle</th>
                    <th>Running Mode</th>
                    <th>Month</th>
                    <th>Usage Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((u, idx) => (
                    <tr key={idx}>
                      <td><code>{u.workspace_id}</code></td>
                      <td>{u.user_name || '-'}</td>
                      <td><small>{u.bundle_id || '-'}</small></td>
                      <td>{u.running_mode || '-'}</td>
                      <td>{u.month}</td>
                      <td>{u.usage_hours?.toFixed(2) || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Usage;
