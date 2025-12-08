import { useEffect, useState } from 'react';
import { getUsage, exportUsage } from '../api';
import { Box, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Grid, IconButton, Menu, MenuItem, Snackbar, Alert } from '@mui/material';
import { Search, Clear, FileDownload } from '@mui/icons-material';

function Usage() {
  const [usage, setUsage] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ user_name: '', month_from: '', month_to: '' });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadUsage(); }, []);

  const loadUsage = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getUsage(params);
      setUsage(data.data || []);
    } catch (error) {
      console.error('Error loading usage:', error);
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
      await exportUsage(format, filters);
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
              <TextField fullWidth label="Month From" name="month_from" type="month" value={filters.month_from} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField fullWidth label="Month To" name="month_to" type="month" value={filters.month_to} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={3}>
              <Box display="flex" gap={1}>
                <Button variant="contained" startIcon={<Search />} onClick={loadUsage} fullWidth>Filter</Button>
                <Button variant="outlined" startIcon={<Clear />} onClick={() => { setFilters({ user_name: '', month_from: '', month_to: '' }); setTimeout(loadUsage, 0); }}>Clear</Button>
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
                    <TableCell>Bundle</TableCell>
                    <TableCell>Running Mode</TableCell>
                    <TableCell>Month</TableCell>
                    <TableCell>Usage Hours</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {usage.map((u, idx) => (
                    <TableRow key={idx}>
                      <TableCell><code>{u.workspace_id}</code></TableCell>
                      <TableCell>{u.user_name || '-'}</TableCell>
                      <TableCell><small>{u.bundle_id || '-'}</small></TableCell>
                      <TableCell>{u.running_mode || '-'}</TableCell>
                      <TableCell>{u.month}</TableCell>
                      <TableCell>{u.usage_hours?.toFixed(2) || 0}</TableCell>
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

export default Usage;
