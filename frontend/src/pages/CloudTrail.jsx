import { useEffect, useState } from 'react';
import { getCloudTrailEvents, exportCloudTrail } from '../api';

function CloudTrail() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    event_name: '',
    workspace_id: '',
    from_date: '',
    to_date: ''
  });
  const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0 });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async (newOffset = 0) => {
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

      const data = await getCloudTrailEvents(params);
      setEvents(data.data || []);
      setPagination(prev => ({ ...prev, offset: newOffset, total: data.total || 0 }));
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    loadEvents(0);
  };

  const handleClearFilters = () => {
    setFilters({
      event_name: '',
      workspace_id: '',
      from_date: '',
      to_date: ''
    });
    setTimeout(() => loadEvents(0), 0);
  };

  const handleExport = async (format) => {
    try {
      await exportCloudTrail(format, filters);
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
            <label className="form-label">Event Name</label>
            <select 
              className="form-select" 
              name="event_name"
              value={filters.event_name}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              <option value="CreateWorkspaces">CreateWorkspaces</option>
              <option value="TerminateWorkspaces">TerminateWorkspaces</option>
              <option value="ModifyWorkspaceProperties">ModifyWorkspaceProperties</option>
              <option value="RebootWorkspaces">RebootWorkspaces</option>
              <option value="RebuildWorkspaces">RebuildWorkspaces</option>
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Workspace ID</label>
            <input 
              type="text" 
              className="form-control" 
              name="workspace_id"
              value={filters.workspace_id}
              onChange={handleFilterChange}
              placeholder="ws-..." 
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">From Date</label>
            <input 
              type="date" 
              className="form-control" 
              name="from_date"
              value={filters.from_date}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">To Date</label>
            <input 
              type="date" 
              className="form-control" 
              name="to_date"
              value={filters.to_date}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-md-2 d-flex align-items-end">
            <button className="btn btn-primary me-2" onClick={handleApplyFilters}>
              <i className="bi bi-search"></i> Filter
            </button>
            <button className="btn btn-outline-secondary" onClick={handleClearFilters}>Clear</button>
          </div>
          <div className="col-md-2 d-flex align-items-end justify-content-end">
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
                    <th>Event Time</th>
                    <th>Event Name</th>
                    <th>Workspace ID</th>
                    <th>User</th>
                    <th>Source IP</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, idx) => (
                    <tr key={idx}>
                      <td>{event.event_time ? new Date(event.event_time).toLocaleString() : '-'}</td>
                      <td>{event.event_name || '-'}</td>
                      <td><code>{event.workspace_id || '-'}</code></td>
                      <td>{event.user_identity?.userName || event.username || '-'}</td>
                      <td>{event.source_ip_address || '-'}</td>
                      <td>{event.aws_region || '-'}</td>
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

export default CloudTrail;
