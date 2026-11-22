export type FeatureFlag = 'cloud';

export type FeatureFlags = Record<FeatureFlag, boolean>;

/**
 * Build-time feature flag defaults.
 * - `cloud`: disabled in production builds (`vite build`) unless `VITE_ENABLE_CLOUD=true`;
 *   enabled in local dev (`vite`) unless explicitly disabled with `VITE_ENABLE_CLOUD=false`.
 */
const BUILD_TIME_FLAGS: Readonly<FeatureFlags> = {
  cloud:
    import.meta.env.VITE_ENABLE_CLOUD === 'true' ||
    (import.meta.env.DEV && import.meta.env.VITE_ENABLE_CLOUD !== 'false'),
};

let runtimeOverrides: Partial<FeatureFlags> = {};

/**
 * Returns whether a feature flag is currently enabled.
 * Runtime overrides (e.g. hydrated from `/api/config` or `/api/auth/me` in V3+)
 * take precedence over build-time defaults without requiring call-site changes.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const override = runtimeOverrides[flag];
  if (typeof override === 'boolean') {
    return override;
  }
  return BUILD_TIME_FLAGS[flag];
}

/**
 * Applies runtime feature flag overrides (seam for future `/api/config` or `/api/auth/me` hydration).
 */
export function setRuntimeFeatureFlags(overrides: Partial<FeatureFlags>): void {
  runtimeOverrides = { ...runtimeOverrides, ...overrides };
}

/**
 * Clears runtime feature flag overrides back to build-time defaults.
 */
export function resetRuntimeFeatureFlags(): void {
  runtimeOverrides = {};
}

/**
 * Build-time snapshot of the `cloud` feature flag.
 */
export const CLOUD_ENABLED: boolean = BUILD_TIME_FLAGS.cloud;

/**
 * Guards against static SPA fallbacks (e.g. `not_found_handling: "single-page-application"`)
 * returning HTTP 200 HTML for missing `/api/*` routes.
 */
export function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}
