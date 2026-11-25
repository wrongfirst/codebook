import { useAuthStore, type User } from '../core/auth/authStore';
import { openAuthModal } from './authModal';
import { showPopup } from './popup';
import { ICONS } from './icons';

let widgetContainer: HTMLElement | null = null;
let dropdownOpen = false;

export function initAuthWidget(): void {
  widgetContainer = document.getElementById('header-user-widget');
  if (!widgetContainer) return;

  widgetContainer.classList.remove('hidden');
  widgetContainer.classList.add('flex');

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
      <div class="inline-flex items-center justify-center w-[var(--ctrl-lg)] h-[var(--ctrl-lg)] -mr-1">
        <div class="w-6 h-6 rounded-full bg-border-default/40 animate-pulse"></div>
      </div>
    `;
    return;
  }

  if (!user) {
    widgetContainer.innerHTML = `
      <button 
        id="header-signin-btn" 
        class="btn btn--md btn--secondary btn--icon ml-1"
      >
        <svg class="text-fg-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"/>
        </svg>
        <span>Sign In</span>
      </button>
    `;

    widgetContainer.querySelector('#header-signin-btn')?.addEventListener('click', () => {
      openAuthModal();
    });
    return;
  }

  // User is authenticated
  const seed = encodeURIComponent(user.email || user.id || user.name || 'user');
  const lightAvatarSrc = `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=eff1f5&shapeColor=bcc0cc&eyesColor=4c4f69&mouthColor=4c4f69`;
  const darkAvatarSrc = `https://api.dicebear.com/9.x/thumbs/svg?seed=${seed}&backgroundColor=222231&shapeColor=45475a&eyesColor=cdd6f4&mouthColor=cdd6f4`;
  const avatarHtml = `
    <picture class="block w-6 h-6">
      <source media="(prefers-color-scheme: dark)" srcset="${darkAvatarSrc}" />
      <img src="${lightAvatarSrc}" alt="${user.name || 'User'}" class="w-6 h-6 rounded-full object-cover border border-border-default" />
    </picture>
  `;

  widgetContainer.innerHTML = `
    <div class="flex items-center gap-2">
      <div class="relative inline-block text-left">
        <button 
          id="user-profile-menu-btn" 
          class="inline-flex items-center justify-center w-[var(--ctrl-lg)] h-[var(--ctrl-lg)] -mr-1 rounded hover:bg-bg-app transition-colors cursor-pointer select-none"
          title="${user.name || user.email}"
        >
          ${avatarHtml}
        </button>
        <div id="user-dropdown-menu" class="hidden absolute right-0 mt-2 w-56 rounded-xl bg-bg-surface border border-border-default shadow-xl py-1.5 z-50 text-xs">
        </div>
      </div>
    </div>
  `;

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
      <div class="flex items-center justify-between gap-2">
        <div class="font-semibold text-fg-primary truncate">${user.name || 'Learner'}</div>
        <span class="shrink-0 text-[11px] font-medium px-1.5 py-0.5 rounded ${isPro ? 'bg-bg-app text-fg-primary border border-border-default' : 'text-fg-muted'}">
          ${isPro ? 'Pro' : 'Free'}
        </span>
      </div>
      <div class="text-[11px] text-fg-muted truncate mt-0.5">${user.email}</div>
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
