const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';

export async function apiRequest(endpoint, { method = 'GET', body, headers = {}, activeUser } = {}) {
  const reqHeaders = { ...headers };

  if (activeUser?.email) {
    reqHeaders['x-simulated-email'] = activeUser.email;
  }

  const isFormData = body instanceof FormData;
  if (!isFormData && body && typeof body === 'object') {
    reqHeaders['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
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
    throw new Error(text || 'API Request failed');
  }

  return res;
}

export function getDownloadUrl(documentId, userEmail) {
  return `${API_BASE}/documents/${documentId}/download`;
}
