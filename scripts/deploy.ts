#!/usr/bin/env node
import { execSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pruneDeployments } from './prune-deployments.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

function getWorkerName(): string {
  if (process.env.WORKER_NAME) return process.env.WORKER_NAME.trim();
  if (process.env.REPO_NAME) return process.env.REPO_NAME.trim();
  if (process.env.GITHUB_REPOSITORY) return process.env.GITHUB_REPOSITORY.split('/')[1].trim();

  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: ROOT_DIR,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();

    const match = remoteUrl.match(/[:/][^/:]+\/([^/:]+?)(?:\.git)?$/);
    if (match?.[1]) return match[1].trim();
  } catch {
    // fallback below
  }

  return path.basename(ROOT_DIR) || 'codebook';
}

async function main(): Promise<void> {
  const workerName = getWorkerName();
  console.log(`[deploy] Building and deploying Worker: ${workerName}`);

  // 1. Build project
  console.log('\n[deploy] Step 1: Building project...');
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT_DIR, stdio: 'inherit' });
  if (build.status !== 0) {
    process.exit(build.status ?? 1);
  }

  // 2. Deploy to Cloudflare Workers
  console.log(`\n[deploy] Step 2: Deploying to Cloudflare Workers with name '${workerName}'...`);
  const deploy = spawnSync('npx', ['wrangler', 'deploy', '--latest', `--name=${workerName}`], {
    cwd: ROOT_DIR,
    stdio: 'inherit',
  });
  if (deploy.status !== 0) {
    process.exit(deploy.status ?? 1);
  }

  // 3. Prune old deployments and versions
  console.log('\n[deploy] Step 3: Checking deployments for pruning (max 10 retained)...');
  try {
    await pruneDeployments(workerName);
  } catch (err: any) {
    console.warn(`[deploy] Warning: Pruning failed - ${err.message}`);
  }

  console.log('\n[deploy] Deployment completed successfully.');
}

main().catch(err => {
  console.error(`[deploy] Unexpected error: ${err.message}`);
  process.exit(1);
});
