import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import { NavigateNext as NavigateNextIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';

function PageHeader({ title, subtitle, icon: Icon, breadcrumbs, actions }) {
  return (
    <Box sx={{ mb: 4 }}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon fontSize="small" />}
          sx={{ mb: 2 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return isLast ? (
              <Typography key={index} color="text.primary">
                {crumb.label}
              </Typography>
            ) : (
              <Link
                key={index}
                component={RouterLink}
                to={crumb.path}
                underline="hover"
                color="inherit"
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 2
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {Icon && (
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: 'primary.main',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white'
              }}
            >
              <Icon sx={{ fontSize: 32 }} />
            </Box>
          )}
          <Box>
            <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom={!!subtitle}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
        </Box>
        {actions && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            {actions}
          </Box>
        )}
      </Box>
    </Box>
  );
}

export default PageHeader;
