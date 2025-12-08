import { useEffect, useState } from 'react';
import { getBilling, exportBilling } from '../api';
import { toast } from 'react-toastify';

function Billing() {
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    user_name: '',
    start_date: '',
    end_date: ''
  });
  const [pagination, setPagination] = useState({ offset: 0, limit: 50, total: 0 });

  useEffect(() => {
    loadBilling();
  }, []);

  const loadBilling = async (newOffset = 0) => {
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

      const data = await getBilling(params);
      setBilling(data.data || []);
      setPagination(prev => ({ ...prev, offset: newOffset, total: data.total || 0 }));
    } catch (error) {
      console.error('Error loading billing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleApplyFilters = () => {
    loadBilling(0);
  };

  const handleClearFilters = () => {
    setFilters({
      user_name: '',
      start_date: '',
      end_date: ''
    });
    setTimeout(() => loadBilling(0), 0);
  };

  const handleExport = async (format) => {
    try {
      await exportBilling(format, filters);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
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
            <label className="form-label">Start Date</label>
            <input 
              type="date" 
              className="form-control" 
              name="start_date"
              value={filters.start_date}
              onChange={handleFilterChange}
            />
          </div>
          <div className="col-md-2">
            <label className="form-label">End Date</label>
            <input 
              type="date" 
              className="form-control" 
              name="end_date"
              value={filters.end_date}
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
                    <th>Service</th>
                    <th>Usage Type</th>
                    <th>Start Date</th>
                    <th>End Date</th>
                    <th>Amount</th>
                    <th>Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {billing.map((b, idx) => (
                    <tr key={idx}>
                      <td><code>{b.workspace_id}</code></td>
                      <td>{b.user_name || '-'}</td>
                      <td>{b.service || '-'}</td>
                      <td>{b.usage_type || '-'}</td>
                      <td>{b.start_date ? new Date(b.start_date).toLocaleDateString() : '-'}</td>
                      <td>{b.end_date ? new Date(b.end_date).toLocaleDateString() : '-'}</td>
                      <td>${b.amount?.toFixed(2) || '0.00'}</td>
                      <td>{b.currency || 'USD'}</td>
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

export default Billing;
