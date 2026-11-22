/**
 * Cloud / V2 feature flag.
 * - Production builds (`vite build`) default to disabled unless `VITE_ENABLE_CLOUD=true`.
 * - Local dev (`vite`) defaults to enabled unless explicitly disabled with `VITE_ENABLE_CLOUD=false`.
 */
export const CLOUD_ENABLED: boolean =
  import.meta.env.VITE_ENABLE_CLOUD === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_CLOUD !== 'false');

/**
 * Guards against static SPA fallbacks (e.g. `not_found_handling: "single-page-application"`)
 * returning HTTP 200 HTML for missing `/api/*` routes.
 */
export function isJsonResponse(res: Response): boolean {
  const contentType = res.headers.get('content-type') || '';
  return contentType.toLowerCase().includes('application/json');
}
