const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

const buildUrl = (path) => `${API_BASE}${path}`;

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data?.error || `${res.status} ${res.statusText}` || 'Request failed';
    throw new Error(message);
  }
  return data;
};

const jsonRequest = (path, { method = 'GET', token, body } = {}) =>
  fetch(buildUrl(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  }).then(handleResponse);

export const api = {
  register: (payload) => jsonRequest('/api/auth/register', { method: 'POST', body: payload }),
  login: (payload) => jsonRequest('/api/auth/login', { method: 'POST', body: payload }),
  me: (token) => jsonRequest('/api/me', { token }),
  startRun: (token) => jsonRequest('/api/run/start', { method: 'POST', token }),
  finishRun: (token, payload) => jsonRequest('/api/run/finish', { method: 'POST', token, body: payload }),
  leaderboardTop5: () => jsonRequest('/api/leaderboard/top5'),
  leaderboardTop50: () => jsonRequest('/api/leaderboard/top50')
};
