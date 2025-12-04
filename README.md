# WorkSpaces Inventory

An internal web application for managing AWS WorkSpaces inventory. This app automatically ingests data from AWS to eliminate manual tracking discrepancies, providing accurate information about users, specs, creation/termination details, and monthly usage for the finance team.

## Problem Statement

Manual tracking of AWS WorkSpaces inventory creates discrepancies:
- User mismatches
- Specification mismatches
- Inaccurate creation and termination dates
- Missing information about who created/terminated workspaces
- Unknown utilization status (monthly usage)
- These issues lead to billing problems

## Solution

This application provides:
- **Automated Data Ingestion**: Syncs directly from AWS APIs to maintain accurate data
- **WorkSpaces Tracking**: ID, user, bundle, running mode, tags, volumes, created/terminated info
- **CloudTrail Integration**: Tracks who created/terminated workspaces and when
- **Billing Data**: Monthly usage hours and cost data from AWS Cost Explorer
- **Filtering**: Search and filter data by user, state, bundle, running mode, date ranges
- **Export**: CSV and Excel exports for finance team reporting

## Features

- 📊 **Dashboard**: Overview of total workspaces, active count, usage stats
- 💻 **WorkSpaces View**: Full inventory with filtering and detailed view
- ⏱️ **Usage Tracking**: Monthly usage hours per workspace
- 💰 **Billing Data**: Cost breakdown from AWS Cost Explorer
- 📋 **Audit Log**: CloudTrail events showing who made changes
- 📁 **Export**: CSV and Excel downloads for all data views
- 🔄 **Auto Sync**: Scheduled synchronization with AWS (configurable)

## Quick Start

### Prerequisites

- Node.js 18+ (or Docker)
- AWS credentials with permissions for:
  - `workspaces:DescribeWorkspaces`
  - `workspaces:DescribeWorkspaceBundles`
  - `cloudtrail:LookupEvents`
  - `ce:GetCostAndUsage`
  - `ds:DescribeDirectories`
  - `ds-data:DescribeUser` (requires Directory Data Access enabled)
  - `ds-data:ListGroupsForMember` (requires Directory Data Access enabled)

#### Directory Data Access

To sync user data from AWS Directory Service (display names, email addresses, group memberships), **Directory Data Access** must be enabled for each AWS Managed Microsoft AD directory. This feature allows API access to read user and group information from the directory.

To enable Directory Data Access:
1. Open the AWS Directory Service console
2. Select your directory
3. Go to "Networking & security" tab
4. Under "Directory Data Access", click "Enable"

If Directory Data Access is not enabled, the application will log an error message:
```
Access denied when querying directory <directory-id>. Ensure Directory Data Access is enabled in the AWS Console for this directory.
```

The application will continue to function but directory user data (display names, email, groups) will not be synced.

### Option 1: Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-org/workspaces-inventory.git
cd workspaces-inventory

# Copy and configure environment
cp .env.example .env
# Edit .env with your AWS credentials

# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

Or build and run manually:

```bash
# Build the Docker image
docker build -t workspaces-inventory .

# Run the container (using .env file for credentials - recommended)
docker run -d \
  --name workspaces-inventory \
  -p 3000:3000 \
  --env-file .env \
  -v workspaces-data:/app/data \
  workspaces-inventory
```

### Option 2: Node.js Installation

```bash
# Clone the repository
git clone https://github.com/your-org/workspaces-inventory.git
cd workspaces-inventory

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env
# Edit .env with your AWS credentials

# Start the application
npm start
```

### Configuration

Create a `.env` file with the following:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key

# Server Configuration
PORT=3000
NODE_ENV=development

# Database
DATABASE_PATH=./data/workspaces.db

# Sync Schedule (cron format) - default: every 6 hours
SYNC_SCHEDULE=0 */6 * * *
```

### Usage

1. Access the dashboard at `http://localhost:3000`
2. Click "Sync Now" to fetch data from AWS (or wait for scheduled sync)
3. Use the navigation to switch between views:
   - **Dashboard**: Overview stats and recent activity
   - **WorkSpaces**: Full inventory with filters
   - **Usage**: Monthly usage hours
   - **Billing**: Cost data
   - **Audit Log**: CloudTrail events
4. Use filters to narrow down data
5. Export to CSV or Excel for finance reporting

## API Endpoints

### WorkSpaces
- `GET /api/workspaces` - List workspaces with filters
- `GET /api/workspaces/:id` - Get workspace details with creation/termination info
- `GET /api/workspaces/filters/options` - Get available filter options

### Usage
- `GET /api/usage` - List usage data with filters
- `GET /api/usage/workspace/:id` - Get usage for a specific workspace
- `GET /api/usage/summary/:month` - Get monthly summary

### Billing
- `GET /api/billing` - List billing data with filters
- `GET /api/billing/summary` - Get billing summary for date range

### CloudTrail
- `GET /api/cloudtrail` - List CloudTrail events with filters
- `GET /api/cloudtrail/workspace/:id` - Get events for a workspace

### Exports
- `GET /api/export/workspaces/excel` - Export workspaces to Excel
- `GET /api/export/workspaces/csv` - Export workspaces to CSV
- `GET /api/export/usage/excel` - Export usage to Excel
- `GET /api/export/usage/csv` - Export usage to CSV
- `GET /api/export/billing/excel` - Export billing to Excel
- `GET /api/export/billing/csv` - Export billing to CSV
- `GET /api/export/cloudtrail/excel` - Export CloudTrail events to Excel

### Sync
- `POST /api/sync/all` - Sync all data sources
- `POST /api/sync/workspaces` - Sync workspaces only
- `POST /api/sync/cloudtrail` - Sync CloudTrail events only
- `POST /api/sync/billing` - Sync billing data only
- `GET /api/sync/history` - Get sync history

## Architecture

```
src/
├── app.js                 # Express application
├── config/               
│   └── index.js          # Configuration
├── models/               
│   ├── database.js       # SQLite database setup
│   ├── Workspace.js      # WorkSpaces model
│   ├── WorkspaceUsage.js # Usage model
│   ├── CloudTrailEvent.js# CloudTrail model
│   ├── BillingData.js    # Billing model
│   └── SyncHistory.js    # Sync tracking model
├── routes/               
│   ├── workspaces.js     # WorkSpaces API routes
│   ├── usage.js          # Usage API routes
│   ├── billing.js        # Billing API routes
│   ├── cloudtrail.js     # CloudTrail API routes
│   ├── export.js         # Export API routes
│   └── sync.js           # Sync API routes
├── services/             
│   ├── WorkspacesService.js  # AWS WorkSpaces integration
│   ├── CloudTrailService.js  # AWS CloudTrail integration
│   ├── BillingService.js     # AWS Cost Explorer integration
│   └── ExportService.js      # CSV/Excel export service
public/
├── index.html            # Frontend HTML
└── app.js                # Frontend JavaScript
```

## Data Storage

Uses SQLite for local storage with the following tables:
- `workspaces` - WorkSpaces inventory
- `workspace_usage` - Monthly usage hours
- `cloudtrail_events` - CloudTrail audit events
- `billing_data` - Cost and billing data
- `sync_history` - Sync job history

## License

ISC