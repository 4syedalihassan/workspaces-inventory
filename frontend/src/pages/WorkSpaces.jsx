import { useEffect, useState } from 'react';
import { getWorkspaces, getFilterOptions, exportWorkspaces } from '../api';
import { toast } from 'react-toastify';

function WorkSpaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ states: [], runningModes: [] });
  const [filters, setFilters] = useState({
    user_name: '',
    state: '',
    running_mode: '',
    terminated: ''
  });
  const [pagination, setPagination] = useState({ offset: 0, limit: 25, total: 0 });

  useEffect(() => {
    loadFilterOptions();
    loadWorkspaces();
  }, [filters, pagination.limit]);

  const loadFilterOptions = async () => {
    try {
      const options = await getFilterOptions();
      setFilterOptions(options);
    } catch (error) {
      console.error('Error loading filter options:', error);
    }
  };

  const loadWorkspaces = async (newOffset = 0) => {
    setLoading(true);
    try {
      const params = {
        ...filters,
        offset: newOffset,
        limit: pagination.limit
      };
      
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null || params[key] === undefined) {
          delete params[key];
        }
      });

      const data = await getWorkspaces(params);
      setWorkspaces(data.data || []);
      setPagination(prev => ({ ...prev, offset: newOffset, total: data.total || 0 }));
    } catch (error) {
      console.error('Error loading workspaces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    loadWorkspaces(0);
  };

  const handleClearFilters = () => {
    setFilters({
      user_name: '',
      state: '',
      running_mode: '',
      terminated: ''
    });
    setTimeout(() => loadWorkspaces(0), 0);
  };

  const handleExport = async (format) => {
    try {
      await exportWorkspaces(format, filters);
      toast.success('Export started successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
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

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

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
            <label className="form-label">State</label>
            <select 
              className="form-select" 
              name="state"
              value={filters.state}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              {filterOptions.states?.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Running Mode</label>
            <select 
              className="form-select" 
              name="running_mode"
              value={filters.running_mode}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              {filterOptions.runningModes?.map(mode => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
          </div>
          <div className="col-md-2">
            <label className="form-label">Terminated</label>
            <select 
              className="form-select" 
              name="terminated"
              value={filters.terminated}
              onChange={handleFilterChange}
            >
              <option value="">All</option>
              <option value="false">Active Only</option>
              <option value="true">Terminated Only</option>
            </select>
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
            <>
              <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="table table-hover">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Assigned To</th>
                      <th>Display Name</th>
                      <th>State</th>
                      <th>Compute Type</th>
                      <th>Running Mode</th>
                      <th>Root Vol</th>
                      <th>User Vol</th>
                      <th>Created At</th>
                      <th>Created By</th>
                      <th>Last Connection</th>
                    </tr>
                  </thead>
                  <tbody>
                    {workspaces.map((ws) => (
                      <tr key={ws.id}>
                        <td><code>{ws.id}</code></td>
                        <td>{ws.user_name || '-'}</td>
                        <td>{ws.user_display_name || '-'}</td>
                        <td>
                          <span className={`badge ${getStateBadgeClass(ws.state)}`}>
                            {ws.state || '-'}
                          </span>
                        </td>
                        <td>{ws.compute_type || '-'}</td>
                        <td>{ws.running_mode || '-'}</td>
                        <td>{ws.root_volume_size_gib || '-'} GiB</td>
                        <td>{ws.user_volume_size_gib || '-'} GiB</td>
                        <td>{ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-'}</td>
                        <td>{ws.created_by || '-'}</td>
                        <td>{ws.last_known_user_connection_timestamp ? new Date(ws.last_known_user_connection_timestamp).toLocaleDateString() : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <nav>
                  <ul className="pagination justify-content-center">
                    <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => loadWorkspaces(pagination.offset - pagination.limit)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                    </li>
                    <li className="page-item active">
                      <span className="page-link">
                        {currentPage} / {totalPages}
                      </span>
                    </li>
                    <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
                      <button 
                        className="page-link" 
                        onClick={() => loadWorkspaces(pagination.offset + pagination.limit)}
                        disabled={currentPage === totalPages}
                      >
                        Next
                      </button>
                    </li>
                  </ul>
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkSpaces;
