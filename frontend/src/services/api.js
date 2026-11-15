import axios from 'axios';

// Resolve API base URL: defaults to empty string for same-origin / Vite dev proxy
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Response interceptor for consistent error unwrapping
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred';
    let statusCode = error.response?.status;
    let details = [];

    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data.message === 'string') {
        message = data.message;
      }
      if (Array.isArray(data.errors)) {
        details = data.errors;
      }
    } else if (error.request) {
      message = 'No response from server. Please check your network or backend connectivity.';
    } else {
      message = error.message;
    }

    return Promise.reject({
      message,
      statusCode,
      details,
      raw: error,
    });
  }
);

/**
 * Generates a unique Idempotency Key for order checkouts
 */
export function generateIdempotencyKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `idemp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export default api;
