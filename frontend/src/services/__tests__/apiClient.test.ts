import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEFAULT_LOCAL_BASE_URL,
  getApiBaseUrl,
  buildUrl,
  apiRequest,
  apiClient,
  ApiError,
} from '../apiClient';

describe('apiClient service', () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    // Reset env after tests
    Object.assign(import.meta.env, originalEnv);
  });

  describe('getApiBaseUrl', () => {
    it('returns default local base URL when VITE_API_BASE_URL is not set', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL;
      expect(getApiBaseUrl()).toBe(DEFAULT_LOCAL_BASE_URL);
    });

    it('returns trimmed configured URL without trailing slash', () => {
      (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL = 'https://api.epl-fantasy.click/api/v1///';
      expect(getApiBaseUrl()).toBe('https://api.epl-fantasy.click/api/v1');
    });

    it('falls back to default if configured URL is empty string or whitespace', () => {
      (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL = '   ';
      expect(getApiBaseUrl()).toBe(DEFAULT_LOCAL_BASE_URL);
    });
  });

  describe('buildUrl', () => {
    it('constructs correct full URL without query params', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL;
      expect(buildUrl('/players')).toBe('http://localhost:8000/api/v1/players');
      expect(buildUrl('players')).toBe('http://localhost:8000/api/v1/players');
    });

    it('attaches serialized query params properly', () => {
      delete (import.meta.env as Record<string, unknown>).VITE_API_BASE_URL;
      const url = buildUrl('/players', {
        position: 'MID',
        min_cost: 8.5,
        available_only: true,
        ignored: undefined,
        empty: null,
      });

      expect(url).toBe('http://localhost:8000/api/v1/players?position=MID&min_cost=8.5&available_only=true');
    });
  });

  describe('apiRequest and HTTP helper methods', () => {
    it('executes successful GET request and parses JSON data', async () => {
      const mockData = [{ id: 1, web_name: 'Haaland', now_cost: 140 }];
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => mockData,
      });
      global.fetch = fetchSpy;

      const data = await apiClient.get<typeof mockData>('/players');
      expect(data).toEqual(mockData);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/players',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            Accept: 'application/json',
          }),
        })
      );
    });

    it('executes successful POST request sending stringified body', async () => {
      const payload = { budget: 100.0, formation: '4-3-3' };
      const responseData = { status: 'optimal', total_cost: 99.5 };

      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => responseData,
      });
      global.fetch = fetchSpy;

      const result = await apiClient.post('/optimizer/solve', payload);
      expect(result).toEqual(responseData);
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/optimizer/solve',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        })
      );
    });

    it('throws ApiError with detail message on non-2xx status code', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ detail: 'Invalid formation requested' }),
      });
      global.fetch = fetchSpy;

      await expect(apiClient.get('/invalid')).rejects.toThrow(ApiError);
      await expect(apiClient.get('/invalid')).rejects.toThrow('Invalid formation requested');
    });

    it('supports PUT and DELETE methods', async () => {
      const fetchSpy = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ success: true }),
      });
      global.fetch = fetchSpy;

      await apiClient.put('/lineups/1', { name: 'My Team' });
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/lineups/1',
        expect.objectContaining({ method: 'PUT' })
      );

      await apiClient.delete('/lineups/1');
      expect(fetchSpy).toHaveBeenCalledWith(
        'http://localhost:8000/api/v1/lineups/1',
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });
});

