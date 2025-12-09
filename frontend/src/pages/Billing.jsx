import { useEffect, useState } from 'react';
import { getBilling, exportBilling } from '../api';
import { Box, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Grid, IconButton, Menu, MenuItem, Snackbar, Alert } from '@mui/material';
import { Search, Clear, FileDownload } from '@mui/icons-material';

function Billing() {
  const [billing, setBilling] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ user_name: '', start_date: '', end_date: '' });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadBilling(); }, []);

  const loadBilling = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getBilling(params);
      setBilling(data.data || []);
    } catch (error) {
      console.error('Error loading billing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleExport = async (format) => {
    setExportAnchorEl(null);
    try {
      await exportBilling(format, filters);
      setNotification({ open: true, message: 'Export started successfully', severity: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      setNotification({ open: true, message: 'Export failed. Please try again.', severity: 'error' });
    }
  };

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="User Name" name="user_name" value={filters.user_name} onChange={handleFilterChange} size="small" />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="Start Date" name="start_date" type="date" value={filters.start_date} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="End Date" name="end_date" type="date" value={filters.end_date} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box display="flex" gap={1}>
                <Button variant="contained" startIcon={<Search />} onClick={loadBilling} fullWidth>Filter</Button>
                <Button variant="outlined" startIcon={<Clear />} onClick={() => { setFilters({ user_name: '', start_date: '', end_date: '' }); setTimeout(loadBilling, 0); }}>Clear</Button>
                <IconButton onClick={(e) => setExportAnchorEl(e.currentTarget)} color="primary"><FileDownload /></IconButton>
                <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)}>
                  <MenuItem onClick={() => handleExport('xlsx')}>Excel</MenuItem>
                  <MenuItem onClick={() => handleExport('csv')}>CSV</MenuItem>
                </Menu>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" p={4}><CircularProgress /></Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Workspace ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Service</TableCell>
                    <TableCell>Usage Type</TableCell>
                    <TableCell>Start Date</TableCell>
                    <TableCell>End Date</TableCell>
                    <TableCell>Amount</TableCell>
                    <TableCell>Currency</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {billing.map((b, idx) => (
                    <TableRow key={idx}>
                      <TableCell><code>{b.workspace_id}</code></TableCell>
                      <TableCell>{b.user_name || '-'}</TableCell>
                      <TableCell>{b.service || '-'}</TableCell>
                      <TableCell>{b.usage_type || '-'}</TableCell>
                      <TableCell>{b.start_date ? new Date(b.start_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>{b.end_date ? new Date(b.end_date).toLocaleDateString() : '-'}</TableCell>
                      <TableCell>${b.amount?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>{b.currency || 'USD'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      <Snackbar open={notification.open} autoHideDuration={5000} onClose={() => setNotification({...notification, open: false})} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
        <Alert onClose={() => setNotification({...notification, open: false})} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default Billing;
