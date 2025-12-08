import { useEffect, useState } from 'react';
import { getDashboardStats, getWorkspaces, getSyncHistory } from '../api';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  CircularProgress
} from '@mui/material';

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

  const getStateBadgeColor = (state) => {
    const stateMap = {
      'AVAILABLE': 'success',
      'PENDING': 'warning',
      'TERMINATED': 'error',
      'STOPPED': 'default'
    };
    return stateMap[state] || 'default';
  };

  const getSyncStatusColor = (status) => {
    if (status === 'completed') return 'success';
    if (status === 'failed') return 'error';
    return 'warning';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h3" color="primary" fontWeight="bold">
                {stats.total_workspaces || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total WorkSpaces
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h3" color="primary" fontWeight="bold">
                {stats.active_workspaces || 0}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active WorkSpaces
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h3" color="primary" fontWeight="bold">
                {stats.current_month_usage?.total_hours?.toFixed(1) || '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Usage Hours (This Month)
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderLeft: 6, borderColor: 'secondary.main' }}>
            <CardContent>
              <Typography variant="h3" color="primary" fontWeight="bold">
                {stats.current_month_usage?.avg_hours?.toFixed(1) || '0'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Avg Hours/WorkSpace
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent WorkSpaces
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>State</TableCell>
                      <TableCell>Running Mode</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentWorkspaces.map((ws, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{ws.user_name || '-'}</TableCell>
                        <TableCell>
                          <Chip
                            label={ws.state || '-'}
                            color={getStateBadgeColor(ws.state)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{ws.running_mode || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Sync History
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Records</TableCell>
                      <TableCell>Time</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {syncHistory.map((sync, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{sync.sync_type}</TableCell>
                        <TableCell>
                          <Chip
                            label={sync.status}
                            color={getSyncStatusColor(sync.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>{sync.records_processed || 0}</TableCell>
                        <TableCell>{new Date(sync.started_at).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
