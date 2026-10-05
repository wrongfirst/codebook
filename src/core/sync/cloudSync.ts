import { store } from '../store';
import { useAuthStore } from '../auth/authStore';
import { buildManualExportPayload, parseManualImport } from '../backup/backupManager';
import { showPopup } from '../../ui/popup';

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'disabled';

interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncedAt: number | null;
  error: string | null;
}

let syncState: CloudSyncState = {
  status: 'disabled',
  lastSyncedAt: null,
  error: null,
};

const listeners = new Set<(state: CloudSyncState) => void>();

export function subscribeCloudSync(listener: (state: CloudSyncState) => void): () => void {
  listeners.add(listener);
  listener(syncState);
  return () => listeners.delete(listener);
}

function updateSyncState(patch: Partial<CloudSyncState>): void {
  syncState = { ...syncState, ...patch };
  listeners.forEach((l) => l(syncState));
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isHydrating = false;
let initialSyncDone = false;

/**
 * Loads the latest cloud snapshot from D1 and hydrates local store if newer.
 */
export async function pullCloudProgress(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user || user.tier !== 'pro') {
    updateSyncState({ status: 'disabled' });
    return;
  }

  updateSyncState({ status: 'syncing', error: null });

  try {
    const res = await fetch('/api/sync');
    if (res.status === 403) {
      updateSyncState({ status: 'disabled' });
      return;
    }
    if (!res.ok) {
      throw new Error(`Sync pull failed with HTTP ${res.status}`);
    }

    const body = await res.json() as { snapshot: any; updatedAt: number | null };
    if (body.snapshot) {
      isHydrating = true;
      try {
        const rawJson = typeof body.snapshot === 'string' ? body.snapshot : JSON.stringify(body.snapshot);
        const result = parseManualImport(rawJson, store.getState());
        if (result.success && result.data) {
          store.getState().restoreBackup(result.data);
          showPopup('Cloud progress restored from your account', 3000);
        }
      } finally {
        isHydrating = false;
      }
    }

    updateSyncState({
      status: 'synced',
      lastSyncedAt: body.updatedAt || Date.now(),
    });
  } catch (err: any) {
    console.error('[Cloud Sync Pull Error]:', err);
    updateSyncState({ status: 'error', error: err.message });
  }
}

/**
 * Pushes the current local progress to Cloudflare D1.
 */
export async function pushCloudProgress(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user || user.tier !== 'pro') {
    updateSyncState({ status: 'disabled' });
    return;
  }

  if (isHydrating) return;

  updateSyncState({ status: 'syncing', error: null });

  try {
    const payloadString = await buildManualExportPayload(store.getState());
    const snapshot = JSON.parse(payloadString);

    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshot, version: 1 }),
    });

    if (res.status === 403) {
      updateSyncState({ status: 'disabled' });
      return;
    }

    if (!res.ok) {
      throw new Error(`Sync push failed with HTTP ${res.status}`);
    }

    const body = await res.json() as { success: boolean; updatedAt: number };
    updateSyncState({
      status: 'synced',
      lastSyncedAt: body.updatedAt,
      error: null,
    });
  } catch (err: any) {
    console.error('[Cloud Sync Push Error]:', err);
    updateSyncState({ status: 'error', error: err.message });
  }
}

/**
 * Schedules a debounced cloud save when user progress changes.
 */
function scheduleDebouncedPush(): void {
  const user = useAuthStore.getState().user;
  if (!user || user.tier !== 'pro' || isHydrating) return;

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    pushCloudProgress();
  }, 2000);
}

/**
 * Initializes automatic Cloud Sync listener for Pro users.
 */
export function initCloudSync(): void {
  // Listen for user auth changes
  useAuthStore.subscribe((authState) => {
    const isPro = authState.user?.tier === 'pro';

    if (isPro) {
      if (!store.getState().chatSettings?.enabled) {
        store.getState().setChatSettings({ enabled: true });
      }
      if (!initialSyncDone) {
        initialSyncDone = true;
        pullCloudProgress();
      }
    } else if (!isPro) {
      initialSyncDone = false;
      updateSyncState({ status: 'disabled' });
    }
  });

  // Watch store mutations for progress changes
  store.subscribe((state, prevState) => {
    if (isHydrating) return;

    const codeChanged = state.userCode !== prevState.userCode;
    const completedChanged = state.completedSlugs !== prevState.completedSlugs;
    const chatChanged = state.chatConversations !== prevState.chatConversations;

    if (codeChanged || completedChanged || chatChanged) {
      scheduleDebouncedPush();
    }
  });
}
