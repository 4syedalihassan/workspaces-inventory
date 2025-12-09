// API Base URL
export const API_BASE = '/api/v1';

// Helper function to make API requests
async function fetchAPI(endpoint, options = {}) {
  const authToken = localStorage.getItem('authToken');
  
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`);
  }

  return response.json();
}

// Dashboard API
export const getDashboardStats = () => fetchAPI('/dashboard');

// WorkSpaces API
export const getWorkspaces = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/workspaces${query ? `?${query}` : ''}`);
};

export const getWorkspace = (id) => fetchAPI(`/workspaces/${id}`);

export const getFilterOptions = () => fetchAPI('/workspaces/filters/options');

// Usage API
export const getUsage = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/usage${query ? `?${query}` : ''}`);
};

// Billing API
export const getBilling = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/billing${query ? `?${query}` : ''}`);
};

// CloudTrail API
export const getCloudTrailEvents = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/cloudtrail${query ? `?${query}` : ''}`);
};

// Sync API
export const getSyncHistory = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return fetchAPI(`/sync/history${query ? `?${query}` : ''}`);
};

export const triggerSync = (type = 'all') => 
  fetchAPI(`/sync/trigger?type=${type}`, { method: 'POST' });

// Export API
export const exportWorkspaces = async (format = 'csv', filters = {}) => {
  const params = new URLSearchParams({ ...filters, format }).toString();
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}/workspaces/export?${params}`, {
    headers: {
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  // Trigger download
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `workspaces_export_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const exportUsage = async (format = 'csv', filters = {}) => {
  const params = new URLSearchParams({ ...filters, format }).toString();
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}/usage/export?${params}`, {
    headers: {
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usage_export_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const exportBilling = async (format = 'csv', filters = {}) => {
  const params = new URLSearchParams({ ...filters, format }).toString();
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}/billing/export?${params}`, {
    headers: {
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `billing_export_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

export const exportCloudTrail = async (format = 'xlsx', filters = {}) => {
  const params = new URLSearchParams({ ...filters, format }).toString();
  const authToken = localStorage.getItem('authToken');
  
  const response = await fetch(`${API_BASE}/cloudtrail/export?${params}`, {
    headers: {
      ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
    },
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cloudtrail_export_${Date.now()}.${format}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
