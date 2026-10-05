import { useAuthStore, type User } from '../core/auth/authStore';
import { openAuthModal } from './authModal';
import { showPopup } from './popup';
import { ICONS } from './icons';
import { subscribeCloudSync, type CloudSyncStatus } from '../core/sync/cloudSync';

let widgetContainer: HTMLElement | null = null;
let dropdownOpen = false;
let syncUnsub: (() => void) | null = null;

export function initAuthWidget(): void {
  widgetContainer = document.getElementById('header-user-widget');
  if (!widgetContainer) return;

  // Check URL params for error feedback
  const params = new URLSearchParams(window.location.search);
  if (params.get('error') === 'invalid_token') {
    showPopup('Invalid or expired login link. Please request a new one.', 4000);
    params.delete('error');
    const newUrl = window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
    window.history.replaceState({}, '', newUrl);
  }

  // Subscribe to auth state updates
  useAuthStore.subscribe((state) => {
    renderWidget(state.user, state.isLoading);
  });

  // Global click listener to close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (dropdownOpen && widgetContainer && !widgetContainer.contains(e.target as Node)) {
      dropdownOpen = false;
      renderDropdown(useAuthStore.getState().user);
    }
  });

  // Check auth session on boot
  useAuthStore.getState().checkAuth();
}

function renderWidget(user: User | null, isLoading: boolean): void {
  if (!widgetContainer) return;

  if (isLoading) {
    widgetContainer.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-border-default/40 animate-pulse"></div>
    `;
    return;
  }

  if (!user) {
    widgetContainer.innerHTML = `
      <button 
        id="header-signin-btn" 
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border-default hover:bg-bg-app hover:border-fg-muted/40 transition-all text-fg-primary cursor-pointer shadow-sm"
      >
        <svg class="w-3.5 h-3.5 text-fg-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
        </svg>
        Sign In
      </button>
    `;

    widgetContainer.querySelector('#header-signin-btn')?.addEventListener('click', () => {
      openAuthModal();
    });
    return;
  }

  // User is authenticated
  if (syncUnsub) {
    syncUnsub();
    syncUnsub = null;
  }

  const isPro = user.tier === 'pro';
  const initial = (user.name || user.email || 'U')[0].toUpperCase();
  const avatarHtml = user.avatarUrl
    ? `<img src="${user.avatarUrl}" alt="${user.name || 'User'}" class="w-7 h-7 rounded-full object-cover ring-1 ring-border-default" />`
    : `<div class="w-7 h-7 rounded-full bg-brand/20 text-brand text-xs font-bold flex items-center justify-center ring-1 ring-border-default">${initial}</div>`;

  widgetContainer.innerHTML = `
    <div class="flex items-center gap-2">
      ${
        isPro
          ? `
        <div id="header-sync-indicator" class="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium text-fg-muted bg-bg-app border border-border-default select-none" title="Continuous Cloud Sync">
          <span class="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          <span>Synced</span>
        </div>
      `
          : ''
      }
      <div class="relative inline-block text-left">
        <button 
          id="user-profile-menu-btn" 
          class="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-full hover:bg-bg-app border border-border-default transition-all cursor-pointer select-none"
          title="${user.name || user.email}"
        >
          ${avatarHtml}
          ${isPro ? '<span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">PRO</span>' : ''}
          <svg class="w-3 h-3 text-fg-muted" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 4.5l3 3 3-3"/>
          </svg>
        </button>
        <div id="user-dropdown-menu" class="hidden absolute right-0 mt-2 w-56 rounded-xl bg-bg-surface border border-border-default shadow-xl py-1.5 z-50 text-xs">
        </div>
      </div>
    </div>
  `;

  if (isPro) {
    const syncEl = widgetContainer.querySelector('#header-sync-indicator') as HTMLElement;
    syncUnsub = subscribeCloudSync((state) => {
      if (!syncEl) return;
      if (state.status === 'syncing') {
        syncEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span><span>Syncing...</span>`;
      } else if (state.status === 'error') {
        syncEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-red-500"></span><span>Sync error</span>`;
      } else {
        syncEl.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-green-500"></span><span>Synced</span>`;
      }
    });
  }

  const menuBtn = widgetContainer.querySelector('#user-profile-menu-btn');
  menuBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownOpen = !dropdownOpen;
    renderDropdown(user);
  });

  renderDropdown(user);
}

function renderDropdown(user: User | null): void {
  if (!widgetContainer || !user) return;
  const menu = widgetContainer.querySelector('#user-dropdown-menu') as HTMLElement;
  if (!menu) return;

  if (!dropdownOpen) {
    menu.classList.add('hidden');
    return;
  }

  menu.classList.remove('hidden');
  const isPro = user.tier === 'pro';

  menu.innerHTML = `
    <div class="px-3 py-2 border-b border-border-default">
      <div class="font-semibold text-fg-primary truncate">${user.name || 'Learner'}</div>
      <div class="text-[11px] text-fg-muted truncate">${user.email}</div>
      <div class="mt-1.5 inline-flex items-center gap-1">
        <span class="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${isPro ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30' : 'bg-bg-app text-fg-muted border border-border-default'}">
          ${isPro ? 'Pro Member' : 'Free Tier'}
        </span>
      </div>
    </div>

    ${!isPro ? `
      <div class="py-1">
        <button id="dropdown-upgrade-btn" class="w-full text-left px-3 py-2 text-fg-primary hover:bg-brand/10 hover:text-brand font-medium flex items-center justify-between cursor-pointer">
          <span>Upgrade to Pro</span>
          <span class="text-[10px] bg-brand text-white font-bold px-1.5 py-0.5 rounded">NEW</span>
        </button>
      </div>
      <div class="border-t border-border-default"></div>
    ` : `
      <div class="py-1">
        <button id="dropdown-billing-btn" class="w-full text-left px-3 py-2 text-fg-muted hover:text-fg-primary hover:bg-bg-app font-medium flex items-center justify-between cursor-pointer">
          <span>Manage Billing</span>
        </button>
      </div>
      <div class="border-t border-border-default"></div>
    `}

    <div class="py-1">
      <button id="dropdown-logout-btn" class="w-full text-left px-3 py-2 text-red-500 hover:bg-red-500/10 font-medium flex items-center gap-2 cursor-pointer">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
        </svg>
        Sign Out
      </button>
    </div>
  `;

  menu.querySelector('#dropdown-logout-btn')?.addEventListener('click', () => {
    useAuthStore.getState().logout();
  });

  menu.querySelector('#dropdown-upgrade-btn')?.addEventListener('click', () => {
    dropdownOpen = false;
    renderDropdown(user);
    // Dispatches a global event for Paddle / Pro upgrade modal (handled in Ticket 04)
    window.dispatchEvent(new CustomEvent('codebook:open-upgrade-modal'));
  });

  menu.querySelector('#dropdown-billing-btn')?.addEventListener('click', () => {
    dropdownOpen = false;
    renderDropdown(user);
    window.dispatchEvent(new CustomEvent('codebook:open-billing-portal'));
  });
}
