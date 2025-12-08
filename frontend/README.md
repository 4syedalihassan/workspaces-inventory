# WorkSpaces Inventory Frontend

Modern React 18 frontend for the AWS WorkSpaces Inventory application.

## Technology Stack

- **React 19** - UI framework
- **Vite** - Build tool and development server
- **React Router** - Client-side routing
- **Bootstrap 5** - UI components and styling
- **Bootstrap Icons** - Icon library

## Development

### Prerequisites

- Node.js 20+ 
- npm 10+

### Install Dependencies

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

The app will be available at http://localhost:5173

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

### Lint Code

```bash
npm run lint
```

## Project Structure

```
frontend/
├── src/
│   ├── components/      # Reusable React components
│   │   └── Navbar.jsx   # Navigation bar
│   ├── pages/           # Page components
│   │   ├── Dashboard.jsx    # Dashboard with stats
│   │   ├── WorkSpaces.jsx   # WorkSpaces list with filtering
│   │   ├── Usage.jsx        # Usage tracking
│   │   ├── Billing.jsx      # Billing data
│   │   └── CloudTrail.jsx   # Audit logs
│   ├── api.js           # API client functions
│   ├── App.jsx          # Main app component
│   ├── App.css          # App-level styles
│   ├── main.jsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html           # HTML template
├── vite.config.js       # Vite configuration
└── package.json         # Dependencies and scripts
```

## API Integration

The frontend communicates with the Go backend via REST API at `/api/v1`. All API calls are handled through the `api.js` module.

### Key API Endpoints

- `GET /api/v1/dashboard` - Dashboard statistics
- `GET /api/v1/workspaces` - List workspaces with filtering
- `GET /api/v1/usage` - Usage data
- `GET /api/v1/billing` - Billing data
- `GET /api/v1/cloudtrail` - Audit trail events
- `POST /api/v1/sync/trigger` - Trigger data sync
- `GET /api/v1/sync/history` - Sync history

## Features

### Dashboard
- Real-time statistics (total workspaces, active, usage hours)
- Recent workspaces list
- Sync history

### WorkSpaces
- Comprehensive workspace inventory
- Advanced filtering (user, state, running mode, terminated status)
- Export to Excel/CSV
- Pagination

### Usage
- Monthly usage hours tracking
- Filtering by user and date range
- Export capabilities

### Billing
- Cost data from AWS Cost Explorer
- Filtering and export

### Audit Log
- CloudTrail event tracking
- Workspace lifecycle events
- User action attribution

## Docker Deployment

The frontend is containerized with Nginx in a multi-stage build:

1. **Build stage**: Node.js container builds the React app
2. **Runtime stage**: Nginx Alpine serves the static files

See `frontend-container/Dockerfile` for details.

## Environment Variables

No environment variables needed - the frontend proxies all API requests through Nginx to the backend.
