// API Base URL
const API_BASE = '/api/v1';
const authToken = localStorage.getItem('authToken');

// Check if user is logged in and is admin
if (!authToken) {
    window.location.href = '/login.html';
}

// Set up axios-like fetch with auth
async function apiFetch(url, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        ...options.headers
    };

    const response = await fetch(url, { ...options, headers });
    if (response.status === 401) {
        localStorage.removeItem('authToken');
        window.location.href = '/login.html';
        return;
    }

    return response;
}

// Load all settings on page load
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadUsers();
    loadIntegrationSettings();
});

// Settings Management
async function loadSettings() {
    try {
        const response = await apiFetch(`${API_BASE}/admin/settings`);
        const data = await response.json();

        if (data.settings) {
            renderSettings(data.settings);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
        document.getElementById('settingsContainer').innerHTML =
            '<div class="alert alert-danger">Failed to load settings</div>';
    }
}

function renderSettings(settingsGroups) {
    const container = document.getElementById('settingsContainer');
    let html = '';

    for (const [category, settings] of Object.entries(settingsGroups)) {
        html += `
            <div class="mb-4">
                <h6 class="text-uppercase text-muted mb-3">${category}</h6>
                ${settings.map(s => `
                    <div class="setting-row">
                        <div class="d-flex justify-content-between align-items-start">
                            <div class="flex-grow-1">
                                <div class="setting-key">
                                    ${s.key}
                                    ${s.encrypted ? '<span class="badge bg-warning encrypted-badge ms-2">Encrypted</span>' : ''}
                                </div>
                                <div class="setting-description">${s.description}</div>
                            </div>
                            <div style="min-width: 300px;">
                                <input
                                    type="${s.encrypted ? 'password' : 'text'}"
                                    class="form-control form-control-sm"
                                    id="setting-${s.key}"
                                    value="${s.value || ''}"
                                    placeholder="${s.description}"
                                >
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    container.innerHTML = html;
}

async function saveAllSettings() {
    const settings = {};
    const inputs = document.querySelectorAll('[id^="setting-"]');

    inputs.forEach(input => {
        const key = input.id.replace('setting-', '');
        settings[key] = input.value;
    });

    try {
        const response = await apiFetch(`${API_BASE}/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showAlert('Settings saved successfully', 'success');
        } else {
            showAlert('Failed to save settings', 'danger');
        }
    } catch (error) {
        showAlert('Error saving settings: ' + error.message, 'danger');
    }
}

// User Management
async function loadUsers() {
    try {
        const response = await apiFetch(`${API_BASE}/admin/users`);
        const data = await response.json();

        if (data.users) {
            renderUsers(data.users);
        }
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

function renderUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td><span class="badge bg-${user.role === 'ADMIN' ? 'danger' : 'primary'}">${user.role}</span></td>
            <td>${user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}</td>
            <td>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id}, '${user.username}')">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

function showCreateUserModal() {
    const modal = new bootstrap.Modal(document.getElementById('createUserModal'));
    modal.show();
}

async function createUser() {
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            body: JSON.stringify({ username, email, password, role })
        });

        if (response.ok) {
            bootstrap.Modal.getInstance(document.getElementById('createUserModal')).hide();
            loadUsers();
            showAlert('User created successfully', 'success');

            // Clear form
            document.getElementById('newUsername').value = '';
            document.getElementById('newEmail').value = '';
            document.getElementById('newPassword').value = '';
        } else {
            const data = await response.json();
            showAlert(data.error || 'Failed to create user', 'danger');
        }
    } catch (error) {
        showAlert('Error creating user: ' + error.message, 'danger');
    }
}

async function deleteUser(userId, username) {
    if (!confirm(`Are you sure you want to delete user "${username}"?`)) {
        return;
    }

    try {
        const response = await apiFetch(`${API_BASE}/admin/users/${userId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadUsers();
            showAlert('User deleted successfully', 'success');
        } else {
            const data = await response.json();
            showAlert(data.error || 'Failed to delete user', 'danger');
        }
    } catch (error) {
        showAlert('Error deleting user: ' + error.message, 'danger');
    }
}

// Helper function to convert setting keys to element IDs
function settingKeyToElementId(key) {
    // Replace first dot with hyphen, then replace first underscore with hyphen
    // This matches the original logic: key.replace('prefix.', 'prefix-').replace('_', '-')
    return key.replace('.', '-').replace('_', '-');
}

// Integration Settings
async function loadIntegrationSettings() {
    try {
        const response = await apiFetch(`${API_BASE}/admin/settings?category=aws`);
        const data = await response.json();

        if (data.settings) {
            data.settings.forEach(s => {
                const id = settingKeyToElementId(s.key);
                const el = document.getElementById(id);
                if (el) el.value = s.value || '';
            });
        }

        // Load DUO settings
        const duoResponse = await apiFetch(`${API_BASE}/admin/settings?category=duo`);
        const duoData = await duoResponse.json();

        if (duoData.settings) {
            duoData.settings.forEach(s => {
                const id = settingKeyToElementId(s.key);
                const el = document.getElementById(id);
                if (el) el.value = s.value || '';
            });
        }

        // Load sync settings
        const syncResponse = await apiFetch(`${API_BASE}/admin/settings?category=sync`);
        const syncData = await syncResponse.json();

        if (syncData.settings) {
            syncData.settings.forEach(s => {
                if (s.key === 'sync.auto_sync_enabled') {
                    document.getElementById('auto-sync-enabled').checked = s.value === 'true';
                } else if (s.key === 'sync.interval_minutes') {
                    document.getElementById('sync-interval').value = s.value;
                }
            });
        }
    } catch (error) {
        console.error('Failed to load integration settings:', error);
    }
}

async function saveAWSSettings() {
    const settings = {
        'aws.region': document.getElementById('aws-region').value,
        'aws.access_key_id': document.getElementById('aws-access-key').value,
        'aws.secret_access_key': document.getElementById('aws-secret-key').value
    };

    try {
        const response = await apiFetch(`${API_BASE}/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showAlert('AWS settings saved successfully', 'success');
        } else {
            showAlert('Failed to save AWS settings', 'danger');
        }
    } catch (error) {
        showAlert('Error saving AWS settings: ' + error.message, 'danger');
    }
}

async function testAWSConnection() {
    const resultDiv = document.getElementById('awsTestResult');
    resultDiv.innerHTML = '<div class="spinner-border spinner-border-sm"></div> Testing connection...';

    try {
        const response = await apiFetch(`${API_BASE}/admin/test/aws`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.status === 'success') {
            resultDiv.innerHTML = `<div class="alert alert-success mb-0">
                <i class="bi bi-check-circle me-2"></i>${data.message}
            </div>`;
        } else {
            resultDiv.innerHTML = `<div class="alert alert-danger mb-0">
                <i class="bi bi-x-circle me-2"></i>${data.message || 'Connection failed'}
                ${data.error ? `<br><small>${data.error}</small>` : ''}
            </div>`;
        }
    } catch (error) {
        resultDiv.innerHTML = `<div class="alert alert-danger mb-0">
            <i class="bi bi-x-circle me-2"></i>Error testing connection: ${error.message}
        </div>`;
    }
}

async function saveDUOSettings() {
    const settings = {
        'duo.integration_key': document.getElementById('duo-integration-key').value,
        'duo.secret_key': document.getElementById('duo-secret-key').value,
        'duo.api_hostname': document.getElementById('duo-api-hostname').value
    };

    try {
        const response = await apiFetch(`${API_BASE}/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showAlert('DUO settings saved successfully', 'success');
        } else {
            showAlert('Failed to save DUO settings', 'danger');
        }
    } catch (error) {
        showAlert('Error saving DUO settings: ' + error.message, 'danger');
    }
}

async function saveSyncSettings() {
    const settings = {
        'sync.auto_sync_enabled': document.getElementById('auto-sync-enabled').checked ? 'true' : 'false',
        'sync.interval_minutes': document.getElementById('sync-interval').value
    };

    try {
        const response = await apiFetch(`${API_BASE}/admin/settings`, {
            method: 'PUT',
            body: JSON.stringify(settings)
        });

        if (response.ok) {
            showAlert('Sync settings saved successfully', 'success');
        } else {
            showAlert('Failed to save sync settings', 'danger');
        }
    } catch (error) {
        showAlert('Error saving sync settings: ' + error.message, 'danger');
    }
}

// Helper function to show alerts
function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);

    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}
