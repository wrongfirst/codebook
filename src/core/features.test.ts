import { describe, it, expect, afterEach } from 'vitest';
import {
  CLOUD_ENABLED,
  isFeatureEnabled,
  isJsonResponse,
  resetRuntimeFeatureFlags,
  setRuntimeFeatureFlags,
} from './features';

describe('features', () => {
  afterEach(() => {
    resetRuntimeFeatureFlags();
  });

  it('defaults isFeatureEnabled("cloud") to the build-time CLOUD_ENABLED value', () => {
    expect(isFeatureEnabled('cloud')).toBe(CLOUD_ENABLED);
  });

  it('allows runtime overrides to take precedence and reset cleanly', () => {
    setRuntimeFeatureFlags({ cloud: true });
    expect(isFeatureEnabled('cloud')).toBe(true);

    setRuntimeFeatureFlags({ cloud: false });
    expect(isFeatureEnabled('cloud')).toBe(false);

    resetRuntimeFeatureFlags();
    expect(isFeatureEnabled('cloud')).toBe(CLOUD_ENABLED);
  });

  it('detects JSON responses and rejects HTML fallback responses', () => {
    expect(
      isJsonResponse(new Response('{}', { headers: { 'content-type': 'application/json; charset=utf-8' } }))
    ).toBe(true);
    expect(
      isJsonResponse(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }))
    ).toBe(false);
    expect(isJsonResponse(new Response(''))).toBe(false);
  });
});
