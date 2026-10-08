import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://api.cloudflare.com/client/v4';

interface DeploymentVersion {
  version_id: string;
  percentage: number;
}

interface Deployment {
  id: string;
  created_on: string;
  author_email?: string;
  source?: string;
  strategy?: string;
  versions?: DeploymentVersion[];
}

interface WorkerVersion {
  id: string;
  number?: number;
  metadata?: {
    created_on?: string;
    author_email?: string;
  };
}

interface ApiResponse<T> {
  success: boolean;
  errors: Array<{ code: number; message: string }>;
  messages: string[];
  result: T;
}

interface CloudflareAuth {
  token: string;
  accountId: string;
}

export async function getCloudflareAuth(): Promise<CloudflareAuth | null> {
  // 1. Check environment variables first (used in CI/CD or custom env)
  let token =
    process.env.CLOUDFLARE_API_TOKEN ||
    process.env.CF_API_TOKEN ||
    process.env.CLOUDFLARE_TOKEN;
  let accountId =
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.CF_ACCOUNT_ID ||
    process.env.ACCOUNT_ID;

  // 2. If token is missing, attempt to read from local Wrangler config
  if (!token) {
    const homedir = os.homedir();
    const possiblePaths = [
      path.join(homedir, '.config', '.wrangler', 'config', 'default.toml'),
      path.join(homedir, '.wrangler', 'config', 'default.toml'),
      path.join(
        process.env.XDG_CONFIG_HOME || path.join(homedir, '.config'),
        'wrangler',
        'config',
        'default.toml'
      ),
    ];

    for (const configPath of possiblePaths) {
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, 'utf8');
          const tokenMatch =
            content.match(/oauth_token\s*=\s*["']([^"']+)["']/) ||
            content.match(/api_token\s*=\s*["']([^"']+)["']/);
          if (tokenMatch?.[1]) {
            token = tokenMatch[1].trim();
            break;
          }
        } catch {
          // ignore read errors
        }
      }
    }
  }

  if (!token) {
    return null;
  }

  // 3. If accountId is missing, resolve it from the Cloudflare API accounts list
  if (!accountId) {
    try {
      const res = await fetch(`${API_BASE}/accounts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      const data = (await res.json()) as ApiResponse<Array<{ id: string; name: string }>>;
      if (data.success && Array.isArray(data.result) && data.result.length > 0) {
        accountId = data.result[0].id;
      }
    } catch {
      // ignore fetch error
    }
  }

  if (!token || !accountId) {
    return null;
  }

  return { token, accountId };
}

async function cfFetch<T>(auth: CloudflareAuth, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${auth.token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = (await response.json()) as ApiResponse<T>;
  if (!data.success) {
    const errorMsg = data.errors.map(e => `[${e.code}] ${e.message}`).join(', ') || response.statusText;
    throw new Error(`Cloudflare API error (${response.status}): ${errorMsg}`);
  }

  return data.result;
}

export function getWorkerName(): string {
  const workerName =
    process.env.WORKER_NAME ||
    process.env.REPO_NAME ||
    (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '');

  if (workerName) return workerName.trim();

  try {
    const remoteUrl = fs.readFileSync(path.resolve('.git', 'config'), 'utf8');
    const match = remoteUrl.match(/url\s*=\s*.*[/:]([^/:]+?)(?:\.git)?$/m);
    if (match?.[1]) return match[1].trim();
  } catch {
    // fallback
  }

  return path.basename(process.cwd()) || 'codebook';
}

export async function pruneDeployments(targetWorkerName?: string): Promise<void> {
  const auth = await getCloudflareAuth();
  if (!auth) {
    console.log('[prune] Skipping pruning: Cloudflare authentication could not be determined from environment or local Wrangler login.');
    return;
  }

  const workerName = (targetWorkerName || getWorkerName()).trim();
  console.log(`[prune] Checking deployments for Worker '${workerName}' (Account: ${auth.accountId})...`);

  // 1. List deployments
  const deploymentsRes = await cfFetch<{ deployments: Deployment[] }>(
    auth,
    `/accounts/${auth.accountId}/workers/scripts/${workerName}/deployments`
  );

  const deployments = deploymentsRes.deployments || [];
  console.log(`[prune] Total active deployments: ${deployments.length}`);

  // Sort by created_on descending (newest first)
  deployments.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());

  const RETENTION_LIMIT = 10;
  if (deployments.length <= RETENTION_LIMIT) {
    console.log(`[prune] Deployments count (${deployments.length}) is <= limit of ${RETENTION_LIMIT}. No pruning required.`);
    return;
  }

  const retainedDeployments = deployments.slice(0, RETENTION_LIMIT);
  const deploymentsToDelete = deployments.slice(RETENTION_LIMIT);

  console.log(`[prune] Pruning ${deploymentsToDelete.length} older deployment(s) exceeding max limit of ${RETENTION_LIMIT}...`);

  // Collect version IDs referenced by retained deployments
  const retainedVersionIds = new Set<string>();
  for (const dep of retainedDeployments) {
    if (dep.versions) {
      for (const v of dep.versions) {
        if (v.version_id) {
          retainedVersionIds.add(v.version_id);
        }
      }
    }
  }

  // 2. Delete older deployments
  for (const dep of deploymentsToDelete) {
    try {
      await cfFetch(
        auth,
        `/accounts/${auth.accountId}/workers/scripts/${workerName}/deployments/${dep.id}`,
        { method: 'DELETE' }
      );
      console.log(`  ✓ Deleted deployment: ${dep.id} (created: ${dep.created_on})`);
    } catch (err: any) {
      console.error(`  ✗ Failed to delete deployment ${dep.id}: ${err.message}`);
    }
  }

  // 3. Prune orphaned versions
  console.log(`[prune] Checking for orphaned worker versions...`);
  try {
    const versionsRes = await cfFetch<{ items: WorkerVersion[] } | WorkerVersion[]>(
      auth,
      `/accounts/${auth.accountId}/workers/scripts/${workerName}/versions`
    );

    const allVersions: WorkerVersion[] = Array.isArray(versionsRes)
      ? versionsRes
      : versionsRes.items || [];

    const versionsToDelete = allVersions.filter(v => !retainedVersionIds.has(v.id));

    if (versionsToDelete.length === 0) {
      console.log(`[prune] No orphaned versions found.`);
    } else {
      console.log(`[prune] Deleting ${versionsToDelete.length} orphaned version(s)...`);
      for (const v of versionsToDelete) {
        try {
          await cfFetch(
            auth,
            `/accounts/${auth.accountId}/workers/scripts/${workerName}/versions/${v.id}`,
            { method: 'DELETE' }
          );
          console.log(`  ✓ Deleted orphaned version: ${v.id}`);
        } catch (err: any) {
          console.warn(`  ! Could not delete version ${v.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[prune] Skipping version pruning (versions API: ${err.message})`);
  }

  console.log(`[prune] Pruning completed successfully. Retained latest ${retainedDeployments.length} deployment(s).`);
}

// Run directly if invoked as script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  pruneDeployments().catch(err => {
    console.error(`[prune] Error: ${err.message}`);
    process.exit(1);
  });
}
