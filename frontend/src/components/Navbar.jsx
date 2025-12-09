import { NavLink } from 'react-router-dom';
import { triggerSync } from '../api';
import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  CircularProgress,
  Snackbar,
  Alert
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  Computer as ComputerIcon,
  QueryStats as QueryStatsIcon,
  AttachMoney as AttachMoneyIcon,
  History as HistoryIcon,
  Settings as SettingsIcon,
  Sync as SyncIcon
} from '@mui/icons-material';

function Navbar({ lastSync, setLastSync }) {
  const [syncing, setSyncing] = useState(false);
  const [notification, setNotification] = useState({ open: false, message: '', severity: 'success' });

  const handleSync = async () => {
    setSyncing(true);
    try {
      await triggerSync('all');
      setLastSync(new Date().toISOString());
      setNotification({ open: true, message: 'Sync triggered successfully', severity: 'success' });
    } catch (error) {
      console.error('Sync failed:', error);
      setNotification({ open: true, message: 'Sync failed. Please try again.', severity: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const handleCloseNotification = () => {
    setNotification({ ...notification, open: false });
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component={NavLink}
            to="/dashboard"
            sx={{
              flexGrow: 0,
              textDecoration: 'none',
              color: 'secondary.main',
              fontWeight: 'bold',
              mr: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <ComputerIcon /> WorkSpaces Inventory
          </Typography>

          <Box sx={{ flexGrow: 1, display: 'flex', gap: 1 }}>
            <Button
              component={NavLink}
              to="/dashboard"
              startIcon={<DashboardIcon />}
              sx={{ color: 'white' }}
            >
              Dashboard
            </Button>
            <Button
              component={NavLink}
              to="/workspaces"
              startIcon={<ComputerIcon />}
              sx={{ color: 'white' }}
            >
              WorkSpaces
            </Button>
            <Button
              component={NavLink}
              to="/usage"
              startIcon={<QueryStatsIcon />}
              sx={{ color: 'white' }}
            >
              Usage
            </Button>
            <Button
              component={NavLink}
              to="/billing"
              startIcon={<AttachMoneyIcon />}
              sx={{ color: 'white' }}
            >
              Billing
            </Button>
            <Button
              component={NavLink}
              to="/cloudtrail"
              startIcon={<HistoryIcon />}
              sx={{ color: 'white' }}
            >
              Audit Log
            </Button>
            <Button
              component={NavLink}
              to="/admin"
              startIcon={<SettingsIcon />}
              sx={{ color: 'white' }}
            >
              Admin
            </Button>
          </Box>

          <Typography variant="body2" sx={{ mr: 2, color: 'white' }}>
            Last sync: {formatDate(lastSync)}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            onClick={handleSync}
            disabled={syncing}
            startIcon={syncing ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
            sx={{ color: 'white', borderColor: 'white' }}
          >
            {syncing ? 'Syncing...' : 'Sync Now'}
          </Button>
        </Toolbar>
      </AppBar>

      <Snackbar
        open={notification.open}
        autoHideDuration={5000}
        onClose={handleCloseNotification}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
          {notification.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default Navbar;
