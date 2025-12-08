import { useEffect, useState } from 'react';
import { getWorkspaces, getFilterOptions, exportWorkspaces } from '../api';
import {
  Box, Card, CardContent, TextField, Button, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, CircularProgress,
  Grid, IconButton, Menu, MenuItem, Select, FormControl, InputLabel,
  Chip, Pagination, Snackbar, Alert
} from '@mui/material';
import { Search, Clear, FileDownload } from '@mui/icons-material';

function WorkSpaces() {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({ states: [], runningModes: [] });
  const [filters, setFilters] = useState({ user_name: '', state: '', running_mode: '', terminated: '' });
  const [pagination, setPagination] = useState({ offset: 0, limit: 25, total: 0 });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

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
      const params = { ...filters, offset: newOffset, limit: pagination.limit };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
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
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePageChange = (event, page) => {
    loadWorkspaces((page - 1) * pagination.limit);
  };

  const handleExport = async (format) => {
    setExportAnchorEl(null);
    try {
      await exportWorkspaces(format, filters);
      setNotification({ open: true, message: 'Export started successfully', severity: 'success' });
    } catch (error) {
      console.error('Export failed:', error);
      setNotification({ open: true, message: 'Export failed. Please try again.', severity: 'error' });
    }
  };

  const getStateBadgeColor = (state) => {
    const stateMap = { 'AVAILABLE': 'success', 'PENDING': 'warning', 'TERMINATED': 'error', 'STOPPED': 'default' };
    return stateMap[state] || 'default';
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  return (
    <Box>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="User Name" name="user_name" value={filters.user_name} onChange={handleFilterChange} size="small" />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>State</InputLabel>
                <Select name="state" value={filters.state} onChange={handleFilterChange} label="State">
                  <MenuItem value="">All</MenuItem>
                  {filterOptions.states?.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Running Mode</InputLabel>
                <Select name="running_mode" value={filters.running_mode} onChange={handleFilterChange} label="Running Mode">
                  <MenuItem value="">All</MenuItem>
                  {filterOptions.runningModes?.map(mode => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Terminated</InputLabel>
                <Select name="terminated" value={filters.terminated} onChange={handleFilterChange} label="Terminated">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="false">Active Only</MenuItem>
                  <MenuItem value="true">Terminated Only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1}>
                <Button variant="contained" startIcon={<Search />} onClick={() => loadWorkspaces(0)} fullWidth>Filter</Button>
                <Button variant="outlined" startIcon={<Clear />} onClick={() => { setFilters({ user_name: '', state: '', running_mode: '', terminated: '' }); setTimeout(() => loadWorkspaces(0), 0); }}>Clear</Button>
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
            <>
              <TableContainer sx={{ maxHeight: 600 }}>
                <Table stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Assigned To</TableCell>
                      <TableCell>Display Name</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Compute Type</TableCell>
                      <TableCell>Running Mode</TableCell>
                      <TableCell>Root Vol</TableCell>
                      <TableCell>User Vol</TableCell>
                      <TableCell>Created At</TableCell>
                      <TableCell>Created By</TableCell>
                      <TableCell>Last Connection</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {workspaces.map((ws) => (
                      <TableRow key={ws.id}>
                        <TableCell><code>{ws.id}</code></TableCell>
                        <TableCell>{ws.user_name || '-'}</TableCell>
                        <TableCell>{ws.user_display_name || '-'}</TableCell>
                        <TableCell><Chip label={ws.state || '-'} color={getStateBadgeColor(ws.state)} size="small" /></TableCell>
                        <TableCell>{ws.compute_type || '-'}</TableCell>
                        <TableCell>{ws.running_mode || '-'}</TableCell>
                        <TableCell>{ws.root_volume_size_gib || '-'} GiB</TableCell>
                        <TableCell>{ws.user_volume_size_gib || '-'} GiB</TableCell>
                        <TableCell>{ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>{ws.created_by || '-'}</TableCell>
                        <TableCell>{ws.last_known_user_connection_timestamp ? new Date(ws.last_known_user_connection_timestamp).toLocaleDateString() : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {totalPages > 1 && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <Pagination count={totalPages} page={currentPage} onChange={handlePageChange} color="primary" />
                </Box>
              )}
            </>
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

export default WorkSpaces;
