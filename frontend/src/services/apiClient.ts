/**
 * API Client Service for EPL Fantasy Lineup Builder
 * Automatically handles baseURL according to environment (dev/prod)
 * and provides typed request helpers.
 */

// Fallback base URL for local development
export const DEFAULT_LOCAL_BASE_URL = 'http://localhost:8000/api/v1';

/**
 * Resolves the active API base URL.
 * In production or custom deployments, prioritizes VITE_API_BASE_URL.
 * Falls back to local API endpoint in development or if unset.
 */
export function getApiBaseUrl(): string {
  // Vite exposes env variables through import.meta.env
  const configuredUrl = import.meta.env.VITE_API_BASE_URL;
  if (configuredUrl && typeof configuredUrl === 'string' && configuredUrl.trim() !== '') {
    // Strip trailing slash if present for consistency
    const trimmed = configuredUrl.trim().replace(/\/+$/, '');
    // If it is a relative path (e.g. /api/v1), prepend window.location.origin in browser
    if (trimmed.startsWith('/') && typeof window !== 'undefined') {
      return `${window.location.origin}${trimmed}`;
    }
    return trimmed;
  }

  // When running inside browser on port 5173, reverse proxy /api/v1 is available directly
  if (typeof window !== 'undefined' && window.location.port === '5173') {
    return `${window.location.origin}/api/v1`;
  }

  return DEFAULT_LOCAL_BASE_URL;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Formats full URL including query parameters
 */
export function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const fullUrl = `${baseUrl}${cleanEndpoint}`;

  if (!params) return fullUrl;

  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      searchParams.append(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `${fullUrl}?${queryString}` : fullUrl;
}

/**
 * Core apiClient wrapper with json parsing and error normalization
 */
export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, body, headers, ...customConfig } = options;

  const url = buildUrl(endpoint, params);

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };

  const config: RequestInit = {
    ...customConfig,
    headers: {
      ...defaultHeaders,
      ...headers,
    },
  };

  if (body !== undefined) {
    config.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  const response = await fetch(url, config);

  let responseData: unknown = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (responseData && typeof responseData === 'object' && 'detail' in responseData && typeof (responseData as { detail: unknown }).detail === 'string')
        ? (responseData as { detail: string }).detail
        : `Request failed with status ${response.status}: ${response.statusText}`;

    throw new ApiError(errorMessage, response.status, responseData);
  }

  return responseData as T;
}

export const apiClient = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  getBaseUrl: getApiBaseUrl,
};

export default apiClient;

