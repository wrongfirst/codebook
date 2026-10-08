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

async function cfFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) {
    throw new Error('CLOUDFLARE_API_TOKEN environment variable is required');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
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

function getWorkerName(): string {
  const workerName =
    process.env.WORKER_NAME ||
    process.env.REPO_NAME ||
    (process.env.GITHUB_REPOSITORY ? process.env.GITHUB_REPOSITORY.split('/')[1] : '');

  if (!workerName) {
    throw new Error('Could not determine WORKER_NAME. Set WORKER_NAME or REPO_NAME environment variable.');
  }

  return workerName.trim();
}

async function pruneDeploymentsAndVersions(): Promise<void> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID environment variable is required');
  }

  const workerName = getWorkerName();
  console.log(`[Prune] Target Worker: ${workerName}`);

  // 1. List deployments
  console.log(`[Prune] Fetching deployments...`);
  const deploymentsRes = await cfFetch<{ deployments: Deployment[] }>(
    `/accounts/${accountId}/workers/scripts/${workerName}/deployments`
  );

  const deployments = deploymentsRes.deployments || [];
  console.log(`[Prune] Total deployments found: ${deployments.length}`);

  // Sort by created_on descending (newest first)
  deployments.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());

  const RETENTION_LIMIT = 10;
  if (deployments.length <= RETENTION_LIMIT) {
    console.log(`[Prune] Deployments count (${deployments.length}) is within the limit (<= ${RETENTION_LIMIT}). No deployments to delete.`);
  }

  const retainedDeployments = deployments.slice(0, RETENTION_LIMIT);
  const deploymentsToDelete = deployments.slice(RETENTION_LIMIT);

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
  if (deploymentsToDelete.length > 0) {
    console.log(`[Prune] Deleting ${deploymentsToDelete.length} older deployment(s)...`);
    for (const dep of deploymentsToDelete) {
      try {
        await cfFetch(
          `/accounts/${accountId}/workers/scripts/${workerName}/deployments/${dep.id}`,
          { method: 'DELETE' }
        );
        console.log(`  ✓ Deleted deployment: ${dep.id} (created: ${dep.created_on})`);
      } catch (err: any) {
        console.error(`  ✗ Failed to delete deployment ${dep.id}: ${err.message}`);
      }
    }
  }

  // 3. Prune orphaned versions
  console.log(`[Prune] Fetching versions to check for orphaned snapshots...`);
  try {
    const versionsRes = await cfFetch<{ items: WorkerVersion[] } | WorkerVersion[]>(
      `/accounts/${accountId}/workers/scripts/${workerName}/versions`
    );

    const allVersions: WorkerVersion[] = Array.isArray(versionsRes)
      ? versionsRes
      : versionsRes.items || [];

    console.log(`[Prune] Total versions found: ${allVersions.length}`);
    console.log(`[Prune] Retained version IDs count: ${retainedVersionIds.size}`);

    const versionsToDelete = allVersions.filter(v => !retainedVersionIds.has(v.id));

    if (versionsToDelete.length === 0) {
      console.log(`[Prune] No orphaned versions found.`);
    } else {
      console.log(`[Prune] Deleting ${versionsToDelete.length} orphaned version(s)...`);
      for (const v of versionsToDelete) {
        try {
          await cfFetch(
            `/accounts/${accountId}/workers/scripts/${workerName}/versions/${v.id}`,
            { method: 'DELETE' }
          );
          console.log(`  ✓ Deleted orphaned version: ${v.id}`);
        } catch (err: any) {
          console.warn(`  ! Could not delete version ${v.id}: ${err.message}`);
        }
      }
    }
  } catch (err: any) {
    console.warn(`[Prune] Skipping version pruning (versions API error: ${err.message})`);
  }

  console.log(`[Prune] Completed successfully.`);
}

pruneDeploymentsAndVersions().catch(err => {
  console.error(`[Prune] Error: ${err.message}`);
  process.exit(1);
});
