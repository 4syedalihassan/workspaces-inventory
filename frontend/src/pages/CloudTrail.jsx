import { useEffect, useState } from 'react';
import { getCloudTrailEvents, exportCloudTrail } from '../api';
import { Box, Card, CardContent, TextField, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, CircularProgress, Grid, IconButton, Menu, MenuItem, Select, FormControl, InputLabel, Snackbar, Alert } from '@mui/material';
import { Search, Clear, FileDownload } from '@mui/icons-material';

function CloudTrail() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_name: '', workspace_id: '', from_date: '', to_date: '' });
  const [exportAnchorEl, setExportAnchorEl] = useState(null);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  useEffect(() => { loadEvents(); }, []);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => { if (params[key] === '') delete params[key]; });
      const data = await getCloudTrailEvents(params);
      setEvents(data.data || []);
    } catch (error) {
      console.error('Error loading events:', error);
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
      await exportCloudTrail(format, filters);
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
            <Grid item xs={12} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel>Event Name</InputLabel>
                <Select name="event_name" value={filters.event_name} onChange={handleFilterChange} label="Event Name">
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="CreateWorkspaces">CreateWorkspaces</MenuItem>
                  <MenuItem value="TerminateWorkspaces">TerminateWorkspaces</MenuItem>
                  <MenuItem value="ModifyWorkspaceProperties">ModifyWorkspaceProperties</MenuItem>
                  <MenuItem value="RebootWorkspaces">RebootWorkspaces</MenuItem>
                  <MenuItem value="RebuildWorkspaces">RebuildWorkspaces</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="Workspace ID" name="workspace_id" value={filters.workspace_id} onChange={handleFilterChange} size="small" placeholder="ws-..." />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="From Date" name="from_date" type="date" value={filters.from_date} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField fullWidth label="To Date" name="to_date" type="date" value={filters.to_date} onChange={handleFilterChange} size="small" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} md={4}>
              <Box display="flex" gap={1}>
                <Button variant="contained" startIcon={<Search />} onClick={loadEvents} fullWidth>Filter</Button>
                <Button variant="outlined" startIcon={<Clear />} onClick={() => { setFilters({ event_name: '', workspace_id: '', from_date: '', to_date: '' }); setTimeout(loadEvents, 0); }}>Clear</Button>
                <IconButton onClick={(e) => setExportAnchorEl(e.currentTarget)} color="primary"><FileDownload /></IconButton>
                <Menu anchorEl={exportAnchorEl} open={Boolean(exportAnchorEl)} onClose={() => setExportAnchorEl(null)}>
                  <MenuItem onClick={() => handleExport('xlsx')}>Excel</MenuItem>
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
                    <TableCell>Event Time</TableCell>
                    <TableCell>Event Name</TableCell>
                    <TableCell>Workspace ID</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Source IP</TableCell>
                    <TableCell>Region</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {events.map((event, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{event.event_time ? new Date(event.event_time).toLocaleString() : '-'}</TableCell>
                      <TableCell>{event.event_name || '-'}</TableCell>
                      <TableCell><code>{event.workspace_id || '-'}</code></TableCell>
                      <TableCell>{event.user_identity?.userName || event.username || '-'}</TableCell>
                      <TableCell>{event.source_ip_address || '-'}</TableCell>
                      <TableCell>{event.aws_region || '-'}</TableCell>
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

export default CloudTrail;
