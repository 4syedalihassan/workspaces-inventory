// API Base URL
const API_BASE = '/api';

// Current active tab
let currentTab = 'dashboard';

// Pagination state
const pagination = {
    workspaces: { offset: 0, limit: 25 },
    usage: { offset: 0, limit: 50 },
    billing: { offset: 0, limit: 50 },
    cloudtrail: { offset: 0, limit: 50 }
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initFilters();
    initExportButtons();
    initSyncButton();
    loadDashboard();
    loadFilterOptions();
});

// Navigation
function initNavigation() {
    document.querySelectorAll('[data-tab]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });
}

function switchTab(tab) {
    currentTab = tab;
    
    // Update nav links
    document.querySelectorAll('[data-tab]').forEach(link => {
        link.classList.toggle('active', link.dataset.tab === tab);
    });
    
    // Show/hide tabs
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.style.display = 'none';
    });
    document.getElementById(`${tab}-tab`).style.display = 'block';
    
    // Load data for tab
    switch (tab) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'workspaces':
            loadWorkspaces();
            break;
        case 'usage':
            loadUsage();
            break;
        case 'billing':
            loadBilling();
            break;
        case 'cloudtrail':
            loadCloudtrail();
            break;
    }
}

// Dashboard
async function loadDashboard() {
    try {
        const [stats, workspaces, syncHistory] = await Promise.all([
            fetch(`${API_BASE}/dashboard`).then(r => r.json()),
            fetch(`${API_BASE}/workspaces?limit=10`).then(r => r.json()),
            fetch(`${API_BASE}/sync/history?limit=10`).then(r => r.json())
        ]);
        
        // Update stats
        document.getElementById('totalWorkspaces').textContent = stats.total_workspaces || 0;
        document.getElementById('activeWorkspaces').textContent = stats.active_workspaces || 0;
        document.getElementById('totalUsageHours').textContent = 
            stats.current_month_usage?.total_hours?.toFixed(1) || '0';
        document.getElementById('avgUsageHours').textContent = 
            stats.current_month_usage?.avg_hours?.toFixed(1) || '0';
        document.getElementById('lastSync').textContent = 
            stats.last_sync ? new Date(stats.last_sync).toLocaleString() : 'Never';
        
        // Update recent workspaces table
        const workspacesBody = document.querySelector('#recentWorkspacesTable tbody');
        workspacesBody.innerHTML = workspaces.data.map(ws => `
            <tr>
                <td>${ws.user_name || '-'}</td>
                <td><span class="badge badge-${ws.state?.toLowerCase() || 'unknown'}">${ws.state || '-'}</span></td>
                <td>${ws.running_mode || '-'}</td>
            </tr>
        `).join('');
        
        // Update sync history table
        const syncBody = document.querySelector('#syncHistoryTable tbody');
        syncBody.innerHTML = (syncHistory.data || []).map(sync => `
            <tr>
                <td>${sync.sync_type}</td>
                <td><span class="badge bg-${sync.status === 'completed' ? 'success' : sync.status === 'failed' ? 'danger' : 'warning'}">${sync.status}</span></td>
                <td>${sync.records_processed || 0}</td>
                <td>${new Date(sync.started_at).toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// WorkSpaces
async function loadWorkspaces() {
    const loading = document.getElementById('workspacesLoading');
    loading.classList.add('active');
    
    try {
        const filters = getWorkspacesFilters();
        const params = new URLSearchParams({
            ...filters,
            limit: pagination.workspaces.limit,
            offset: pagination.workspaces.offset
        });
        
        const response = await fetch(`${API_BASE}/workspaces?${params}`);
        const data = await response.json();
        
        const tbody = document.querySelector('#workspacesTable tbody');
        tbody.innerHTML = data.data.map(ws => `
            <tr>
                <td><code>${ws.id}</code></td>
                <td>${ws.user_name || '-'}</td>
                <td>${ws.user_display_name || '-'}</td>
                <td><span class="badge badge-${ws.state?.toLowerCase() || 'unknown'}">${ws.state || '-'}</span></td>
                <td>${ws.compute_type || '-'}</td>
                <td>${ws.running_mode || '-'}</td>
                <td>${ws.root_volume_size_gib || '-'} GiB</td>
                <td>${ws.user_volume_size_gib || '-'} GiB</td>
                <td>${ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '-'}</td>
                <td>${ws.last_known_user_connection_timestamp ? new Date(ws.last_known_user_connection_timestamp).toLocaleDateString() : '-'}</td>
            </tr>
        `).join('');
        
        updatePagination('workspaces', data.total);
    } catch (error) {
        console.error('Error loading workspaces:', error);
    } finally {
        loading.classList.remove('active');
    }
}

function getWorkspacesFilters() {
    return {
        user_name: document.getElementById('filterUserName').value,
        state: document.getElementById('filterState').value,
        running_mode: document.getElementById('filterRunningMode').value,
        terminated: document.getElementById('filterTerminated').value
    };
}

async function showWorkspaceDetails(id) {
    try {
        const response = await fetch(`${API_BASE}/workspaces/${id}`);
        const workspace = await response.json();
        
        const modalBody = document.getElementById('workspaceModalBody');
        modalBody.innerHTML = `
            <div class="row">
                <div class="col-md-6">
                    <h6>Basic Info</h6>
                    <table class="table table-sm">
                        <tr><th>ID</th><td><code>${workspace.id}</code></td></tr>
                        <tr><th>User</th><td>${workspace.user_name}</td></tr>
                        <tr><th>State</th><td><span class="badge badge-${workspace.state?.toLowerCase()}">${workspace.state}</span></td></tr>
                        <tr><th>Computer Name</th><td>${workspace.computer_name || '-'}</td></tr>
                        <tr><th>IP Address</th><td>${workspace.ip_address || '-'}</td></tr>
                    </table>
                </div>
                <div class="col-md-6">
                    <h6>Specs</h6>
                    <table class="table table-sm">
                        <tr><th>Bundle ID</th><td><small>${workspace.bundle_id}</small></td></tr>
                        <tr><th>Running Mode</th><td>${workspace.running_mode}</td></tr>
                        <tr><th>Root Volume</th><td>${workspace.root_volume_size_gib} GiB</td></tr>
                        <tr><th>User Volume</th><td>${workspace.user_volume_size_gib} GiB</td></tr>
                    </table>
                </div>
            </div>
            <div class="row mt-3">
                <div class="col-md-6">
                    <h6>Creation Info</h6>
                    ${workspace.creation_info ? `
                        <table class="table table-sm">
                            <tr><th>Created At</th><td>${new Date(workspace.creation_info.created_at).toLocaleString()}</td></tr>
                            <tr><th>Created By</th><td>${workspace.creation_info.created_by}</td></tr>
                            <tr><th>Source IP</th><td>${workspace.creation_info.source_ip || '-'}</td></tr>
                        </table>
                    ` : '<p class="text-muted">No creation info available</p>'}
                </div>
                <div class="col-md-6">
                    <h6>Termination Info</h6>
                    ${workspace.termination_info ? `
                        <table class="table table-sm">
                            <tr><th>Terminated At</th><td>${new Date(workspace.termination_info.terminated_at).toLocaleString()}</td></tr>
                            <tr><th>Terminated By</th><td>${workspace.termination_info.terminated_by}</td></tr>
                            <tr><th>Source IP</th><td>${workspace.termination_info.source_ip || '-'}</td></tr>
                        </table>
                    ` : '<p class="text-muted">Not terminated</p>'}
                </div>
            </div>
            ${workspace.history && workspace.history.length > 0 ? `
                <div class="mt-3">
                    <h6>Recent Activity</h6>
                    <table class="table table-sm">
                        <thead>
                            <tr><th>Time</th><th>Event</th><th>User</th></tr>
                        </thead>
                        <tbody>
                            ${workspace.history.slice(0, 10).map(event => `
                                <tr>
                                    <td>${new Date(event.event_time).toLocaleString()}</td>
                                    <td>${event.event_name}</td>
                                    <td>${event.user_identity?.userName || event.user_identity?.arn || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            ` : ''}
        `;
        
        const modalElement = document.getElementById('workspaceModal');
        if (window.bootstrap && window.bootstrap.Modal && modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        } else {
            console.error('Cannot show modal: Bootstrap or modal element is missing.');
        }
    } catch (error) {
        console.error('Error loading workspace details:', error);
    }
}

// Usage
async function loadUsage() {
    const loading = document.getElementById('usageLoading');
    loading.classList.add('active');
    
    try {
        const filters = {
            user_name: document.getElementById('usageFilterUserName').value,
            month_from: document.getElementById('usageFilterMonthFrom').value,
            month_to: document.getElementById('usageFilterMonthTo').value
        };
        
        const params = new URLSearchParams({
            ...filters,
            limit: pagination.usage.limit,
            offset: pagination.usage.offset
        });
        
        const response = await fetch(`${API_BASE}/usage?${params}`);
        const data = await response.json();
        
        const tbody = document.querySelector('#usageTable tbody');
        tbody.innerHTML = data.data.map(u => `
            <tr>
                <td><code>${u.workspace_id}</code></td>
                <td>${u.user_name || '-'}</td>
                <td><small>${u.bundle_id || '-'}</small></td>
                <td>${u.running_mode || '-'}</td>
                <td>${u.month}</td>
                <td>${u.usage_hours?.toFixed(2) || 0}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading usage:', error);
    } finally {
        loading.classList.remove('active');
    }
}

// Billing
async function loadBilling() {
    const loading = document.getElementById('billingLoading');
    loading.classList.add('active');
    
    try {
        const filters = {
            user_name: document.getElementById('billingFilterUserName').value,
            start_date: document.getElementById('billingFilterStartDate').value,
            end_date: document.getElementById('billingFilterEndDate').value
        };
        
        const params = new URLSearchParams({
            ...filters,
            limit: pagination.billing.limit,
            offset: pagination.billing.offset
        });
        
        const response = await fetch(`${API_BASE}/billing?${params}`);
        const data = await response.json();
        
        const tbody = document.querySelector('#billingTable tbody');
        tbody.innerHTML = data.data.map(b => `
            <tr>
                <td><code>${b.workspace_id || '-'}</code></td>
                <td>${b.user_name || '-'}</td>
                <td>${b.service}</td>
                <td>${b.usage_type}</td>
                <td>${b.start_date}</td>
                <td>${b.end_date}</td>
                <td>$${b.amount?.toFixed(2) || '0.00'}</td>
                <td>${b.currency}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading billing:', error);
    } finally {
        loading.classList.remove('active');
    }
}

// CloudTrail
async function loadCloudtrail() {
    const loading = document.getElementById('cloudtrailLoading');
    loading.classList.add('active');
    
    try {
        const filters = {
            event_name: document.getElementById('cloudtrailFilterEventName').value,
            workspace_id: document.getElementById('cloudtrailFilterWorkspaceId').value,
            event_from: document.getElementById('cloudtrailFilterFrom').value,
            event_to: document.getElementById('cloudtrailFilterTo').value
        };
        
        const params = new URLSearchParams({
            ...filters,
            limit: pagination.cloudtrail.limit,
            offset: pagination.cloudtrail.offset
        });
        
        const response = await fetch(`${API_BASE}/cloudtrail?${params}`);
        const data = await response.json();
        
        const tbody = document.querySelector('#cloudtrailTable tbody');
        tbody.innerHTML = data.data.map(e => `
            <tr>
                <td>${new Date(e.event_time).toLocaleString()}</td>
                <td>${e.event_name}</td>
                <td><code>${e.workspace_id || '-'}</code></td>
                <td>${e.user_identity?.userName || e.user_identity?.arn || '-'}</td>
                <td>${e.source_ip_address || '-'}</td>
                <td>${e.aws_region || '-'}</td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error loading cloudtrail:', error);
    } finally {
        loading.classList.remove('active');
    }
}

// Filter options
async function loadFilterOptions() {
    try {
        // Load workspaces filter options
        const response = await fetch(`${API_BASE}/workspaces/filters/options`);
        const options = await response.json();
        
        const stateSelect = document.getElementById('filterState');
        (options.states || []).forEach(state => {
            if (state) {
                const option = document.createElement('option');
                option.value = state;
                option.textContent = state;
                stateSelect.appendChild(option);
            }
        });
        
        const runningModeSelect = document.getElementById('filterRunningMode');
        (options.running_modes || []).forEach(mode => {
            if (mode) {
                const option = document.createElement('option');
                option.value = mode;
                option.textContent = mode;
                runningModeSelect.appendChild(option);
            }
        });
        
        // Load CloudTrail event names
        const eventNamesResponse = await fetch(`${API_BASE}/cloudtrail/event-names`);
        const eventNames = await eventNamesResponse.json();
        
        const eventNameSelect = document.getElementById('cloudtrailFilterEventName');
        (eventNames.data || []).forEach(name => {
            if (name) {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                eventNameSelect.appendChild(option);
            }
        });
    } catch (error) {
        console.error('Error loading filter options:', error);
    }
}

// Filter initialization
function initFilters() {
    // Workspaces filters
    document.getElementById('applyFilters').addEventListener('click', () => {
        pagination.workspaces.offset = 0;
        loadWorkspaces();
    });
    
    document.getElementById('clearFilters').addEventListener('click', () => {
        document.getElementById('filterUserName').value = '';
        document.getElementById('filterState').value = '';
        document.getElementById('filterRunningMode').value = '';
        document.getElementById('filterTerminated').value = '';
        pagination.workspaces.offset = 0;
        loadWorkspaces();
    });
    
    // Usage filters
    document.getElementById('applyUsageFilters').addEventListener('click', () => {
        pagination.usage.offset = 0;
        loadUsage();
    });
    
    document.getElementById('clearUsageFilters').addEventListener('click', () => {
        document.getElementById('usageFilterUserName').value = '';
        document.getElementById('usageFilterMonthFrom').value = '';
        document.getElementById('usageFilterMonthTo').value = '';
        pagination.usage.offset = 0;
        loadUsage();
    });
    
    // Billing filters
    document.getElementById('applyBillingFilters').addEventListener('click', () => {
        pagination.billing.offset = 0;
        loadBilling();
    });
    
    document.getElementById('clearBillingFilters').addEventListener('click', () => {
        document.getElementById('billingFilterUserName').value = '';
        document.getElementById('billingFilterStartDate').value = '';
        document.getElementById('billingFilterEndDate').value = '';
        pagination.billing.offset = 0;
        loadBilling();
    });
    
    // CloudTrail filters
    document.getElementById('applyCloudtrailFilters').addEventListener('click', () => {
        pagination.cloudtrail.offset = 0;
        loadCloudtrail();
    });
    
    document.getElementById('clearCloudtrailFilters').addEventListener('click', () => {
        document.getElementById('cloudtrailFilterEventName').value = '';
        document.getElementById('cloudtrailFilterWorkspaceId').value = '';
        document.getElementById('cloudtrailFilterFrom').value = '';
        document.getElementById('cloudtrailFilterTo').value = '';
        pagination.cloudtrail.offset = 0;
        loadCloudtrail();
    });
}

// Export buttons
function initExportButtons() {
    // Workspaces exports
    document.getElementById('exportWorkspacesExcel').addEventListener('click', (e) => {
        e.preventDefault();
        const filters = getWorkspacesFilters();
        const params = new URLSearchParams(filters);
        window.location.href = `${API_BASE}/export/workspaces/excel?${params}`;
    });
    
    document.getElementById('exportWorkspacesCSV').addEventListener('click', (e) => {
        e.preventDefault();
        const filters = getWorkspacesFilters();
        const params = new URLSearchParams(filters);
        window.location.href = `${API_BASE}/export/workspaces/csv?${params}`;
    });
    
    // Usage exports
    document.getElementById('exportUsageExcel').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({
            user_name: document.getElementById('usageFilterUserName').value,
            month_from: document.getElementById('usageFilterMonthFrom').value,
            month_to: document.getElementById('usageFilterMonthTo').value
        });
        window.location.href = `${API_BASE}/export/usage/excel?${params}`;
    });
    
    document.getElementById('exportUsageCSV').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({
            user_name: document.getElementById('usageFilterUserName').value,
            month_from: document.getElementById('usageFilterMonthFrom').value,
            month_to: document.getElementById('usageFilterMonthTo').value
        });
        window.location.href = `${API_BASE}/export/usage/csv?${params}`;
    });
    
    // Billing exports
    document.getElementById('exportBillingExcel').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({
            user_name: document.getElementById('billingFilterUserName').value,
            start_date: document.getElementById('billingFilterStartDate').value,
            end_date: document.getElementById('billingFilterEndDate').value
        });
        window.location.href = `${API_BASE}/export/billing/excel?${params}`;
    });
    
    document.getElementById('exportBillingCSV').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({
            user_name: document.getElementById('billingFilterUserName').value,
            start_date: document.getElementById('billingFilterStartDate').value,
            end_date: document.getElementById('billingFilterEndDate').value
        });
        window.location.href = `${API_BASE}/export/billing/csv?${params}`;
    });
    
    // CloudTrail export
    document.getElementById('exportCloudtrailExcel').addEventListener('click', (e) => {
        e.preventDefault();
        const params = new URLSearchParams({
            event_name: document.getElementById('cloudtrailFilterEventName').value,
            workspace_id: document.getElementById('cloudtrailFilterWorkspaceId').value,
            event_from: document.getElementById('cloudtrailFilterFrom').value,
            event_to: document.getElementById('cloudtrailFilterTo').value
        });
        window.location.href = `${API_BASE}/export/cloudtrail/excel?${params}`;
    });
}

// Sync button
function initSyncButton() {
    document.getElementById('syncBtn').addEventListener('click', async () => {
        const btn = document.getElementById('syncBtn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Syncing...';
        
        try {
            const response = await fetch(`${API_BASE}/sync/all`, { method: 'POST' });
            const result = await response.json();
            
            alert('Sync completed!\n' + 
                `WorkSpaces: ${result.workspaces?.recordsProcessed || 0} records\n` +
                `CloudTrail: ${result.cloudtrail?.recordsProcessed || 0} records\n` +
                `Billing: ${result.billing?.recordsProcessed || 0} records`);
            
            // Reload current tab
            switchTab(currentTab);
        } catch (error) {
            alert('Sync failed: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-arrow-repeat"></i> Sync Now';
        }
    });
}

// Pagination
function updatePagination(type, total) {
    const paginationEl = document.getElementById(`${type}Pagination`);
    if (!paginationEl) return;
    
    const { offset, limit } = pagination[type];
    const totalPages = Math.ceil(total / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    
    let html = '';
    
    // Previous button
    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage - 1}">Previous</a>
    </li>`;
    
    // Page numbers
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" data-page="${i}">${i}</a>
        </li>`;
    }
    
    // Next button
    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" data-page="${currentPage + 1}">Next</a>
    </li>`;
    
    paginationEl.innerHTML = html;
    
    // Add click handlers
    paginationEl.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = parseInt(link.dataset.page, 10);
            if (page >= 1 && page <= totalPages) {
                pagination[type].offset = (page - 1) * limit;
                
                switch (type) {
                    case 'workspaces':
                        loadWorkspaces();
                        break;
                }
            }
        });
    });
}
