// Sanitize API_BASE to automatically handle missing /api or trailing slashes
function getNormalizedApiBase() {
  let base = (import.meta.env.VITE_API_BASE || 'http://localhost:5000/api').trim();
  // Strip trailing slashes
  base = base.replace(/\/+$/, '');
  // If user omitted /api, automatically append it
  if (!base.endsWith('/api')) {
    base = `${base}/api`;
  }
  return base;
}

const API_BASE = getNormalizedApiBase();

export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, activeUser } = {}) {
  const reqHeaders = { ...headers };

  if (activeUser?.email) {
    reqHeaders['x-simulated-email'] = activeUser.email;
  }

  const isFormData = body instanceof FormData;
  if (!isFormData && body && typeof body === 'object') {
    reqHeaders['Content-Type'] = 'application/json';
  }

  // Ensure clean single slash between base and endpoint
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${cleanEndpoint}`.replace(/([^:]\/)\/+/g, '$1');

  const res = await fetch(url, {
    method,
    headers: reqHeaders,
    body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
  });

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'API Request failed');
    }
    return data;
  }

  if (!res.ok) {
    const text = await res.text();
    // Strip raw HTML tags if an HTML error page was returned
    const cleanError = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    throw new Error(cleanError || `Server returned error (${res.status})`);
  }

  return res;
}

export function getDownloadUrl(documentId, userEmail) {
  return `${API_BASE}/documents/${documentId}/download`.replace(/([^:]\/)\/+/g, '$1');
}
