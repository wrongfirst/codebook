import { describe, it, expect } from 'vitest';
import app from './index';

describe('Edge HTTP Boundary Seam', () => {
  it('GET /api/health returns 200 with status ok', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      status: 'ok',
      service: 'codebook',
      timestamp: expect.any(Number),
    });
  });

  it('GET /api/unknown returns 404', async () => {
    const res = await app.request('/api/unknown');
    expect(res.status).toBe(404);
  });
});
