import { isJsonResponse } from '../core/features';
import { createModal, type ModalController } from './modal';

interface TurnstileApi {
  render(
    container: string | HTMLElement,
    options: {
      sitekey: string;
      action?: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ): string;
  reset(widgetId?: string): void;
  getResponse(widgetId?: string): string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SITEKEY = '0x4AAAAAAGRJSaBc3A9zSFEc';
const TURNSTILE_ACTION = 'login';

let modalEl: HTMLElement | null = null;
let authModal: ModalController | null = null;
let turnstileWidgetId: string | null = null;
let turnstileToken = '';
let turnstileRetryTimer: number | null = null;

function clearTurnstileRetryTimer(): void {
  if (turnstileRetryTimer !== null) {
    window.clearTimeout(turnstileRetryTimer);
    turnstileRetryTimer = null;
  }
}

function ensureTurnstileWidget(attemptsLeft = 50): void {
  if (!modalEl || turnstileWidgetId !== null) return;
  const container = modalEl.querySelector<HTMLElement>('#auth-turnstile-container');
  if (!container) return;

  if (window.turnstile) {
    clearTurnstileRetryTimer();
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITEKEY,
      action: TURNSTILE_ACTION,
      theme: 'auto',
      callback: (token: string) => {
        turnstileToken = token;
      },
      'expired-callback': () => {
        turnstileToken = '';
      },
      'error-callback': () => {
        turnstileToken = '';
      },
    });
    return;
  }

  if (attemptsLeft > 0) {
    clearTurnstileRetryTimer();
    turnstileRetryTimer = window.setTimeout(() => {
      turnstileRetryTimer = null;
      ensureTurnstileWidget(attemptsLeft - 1);
    }, 100);
  }
}

function resetTurnstileWidget(): void {
  turnstileToken = '';
  if (turnstileWidgetId !== null && window.turnstile) {
    window.turnstile.reset(turnstileWidgetId);
  }
}

function getCurrentReturnTo(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function updateOAuthLinks(): void {
  if (!modalEl) return;
  const returnToParam = encodeURIComponent(getCurrentReturnTo());
  const githubLink = modalEl.querySelector<HTMLAnchorElement>('#auth-github-link');
  const googleLink = modalEl.querySelector<HTMLAnchorElement>('#auth-google-link');
  if (githubLink) {
    githubLink.href = `/api/auth/login/github?returnTo=${returnToParam}`;
  }
  if (googleLink) {
    googleLink.href = `/api/auth/login/google?returnTo=${returnToParam}`;
  }
}

export function openAuthModal(): void {
  if (!modalEl) {
    createAuthModal();
  }
  updateOAuthLinks();
  authModal?.open();
}

export function closeAuthModal(): void {
  authModal?.close();
}

function createAuthModal(): void {
  modalEl = document.createElement('div');
  modalEl.id = 'auth-modal';
  modalEl.className = 'hidden fixed inset-0 z-100 items-center justify-center bg-black/60 backdrop-blur-sm p-4';

  modalEl.innerHTML = `
    <div class="bg-bg-surface border border-border-default rounded-xl shadow-2xl p-6 w-full max-w-sm relative flex flex-col gap-4 text-fg-primary animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-center justify-between pb-2 border-b border-border-default">
        <div>
          <h2 class="text-base font-bold text-fg-primary">Sign in to Codebook</h2>
          <p class="text-xs text-fg-muted mt-0.5">Sync progress across devices & unlock Pro</p>
        </div>
        <button id="close-auth-modal-btn" class="text-fg-muted hover:text-fg-primary transition-colors p-1.5 rounded-md hover:bg-bg-app cursor-pointer" title="Close">
        </button>
      </div>

      <div class="flex flex-col gap-2.5 pt-1">
        <a id="auth-github-link" href="/api/auth/login/github" class="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 bg-[#24292F] hover:bg-[#1a1e22] text-white font-medium text-xs rounded-lg transition-colors shadow-sm">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Continue with GitHub
        </a>

        <a id="auth-google-link" href="/api/auth/login/google" class="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 bg-bg-app hover:bg-border-default/50 text-fg-primary border border-border-default font-medium text-xs rounded-lg transition-colors shadow-sm">
          <svg class="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
            <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"/>
            <path fill="#FBBC05" d="M5.28 14.27a7.17 7.17 0 0 1 0-4.54V6.58H1.25a11.96 11.96 0 0 0 0 10.84l4.03-3.15z"/>
            <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
          </svg>
          Continue with Google
        </a>
      </div>

      <div class="relative flex items-center justify-center my-1">
        <div class="border-t border-border-default w-full"></div>
        <span class="bg-bg-surface px-2 text-[11px] text-fg-muted uppercase tracking-wider absolute">or</span>
      </div>

      <form id="password-login-form" class="flex flex-col gap-2">
        <label for="auth-email" class="text-xs text-fg-muted font-medium">Email address</label>
        <input 
          type="email" 
          id="auth-email" 
          placeholder="you@example.com" 
          autocomplete="email"
          required 
          class="w-full px-3 py-2 text-xs bg-bg-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-fg-primary"
        />
        <div class="flex flex-col gap-1.5">
          <label for="auth-password" class="text-xs text-fg-muted font-medium">Password</label>
          <input 
            type="password" 
            id="auth-password" 
            placeholder="••••••••" 
            autocomplete="current-password"
            required 
            class="w-full px-3 py-2 text-xs bg-bg-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-fg-primary"
          />
        </div>
        <div id="auth-turnstile-container" class="flex justify-center pt-1"></div>
        <button 
          type="submit" 
          id="auth-submit-btn" 
          class="w-full py-2 px-4 bg-brand hover:opacity-90 text-white font-medium text-xs rounded-lg transition-all shadow-sm cursor-pointer mt-1"
        >
          Sign in
        </button>
        <div id="auth-status" class="hidden text-xs text-center py-1 font-medium"></div>
      </form>
    </div>
  `;

  document.body.appendChild(modalEl);

  authModal = createModal({
    modal: modalEl,
    closeBtn: modalEl.querySelector<HTMLButtonElement>('#close-auth-modal-btn'),
    restoreFocus: true,
    onOpen: () => {
      ensureTurnstileWidget();
      const input = modalEl?.querySelector<HTMLInputElement>('#auth-email');
      if (input) {
        setTimeout(() => input.focus(), 50);
      }
    },
  });

  const form = modalEl.querySelector('#password-login-form') as HTMLFormElement;
  const emailInput = modalEl.querySelector('#auth-email') as HTMLInputElement;
  const passwordInput = modalEl.querySelector('#auth-password') as HTMLInputElement;
  const submitBtn = modalEl.querySelector('#auth-submit-btn') as HTMLButtonElement;
  const statusEl = modalEl.querySelector('#auth-status') as HTMLElement;

  const setStatus = (text: string, tone: 'muted' | 'error' | 'success') => {
    statusEl.classList.remove('hidden', 'text-red-500', 'text-green-500', 'text-fg-muted');
    statusEl.classList.add(
      tone === 'error' ? 'text-red-500' : tone === 'success' ? 'text-green-500' : 'text-fg-muted'
    );
    statusEl.textContent = text;
  };

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    if (!email || !password) return;

    const cfTurnstileResponse =
      turnstileToken ||
      (turnstileWidgetId !== null ? window.turnstile?.getResponse(turnstileWidgetId) ?? '' : '');
    if (!cfTurnstileResponse) {
      setStatus('Please complete the verification check.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    setStatus('Signing in...', 'muted');

    try {
      const res = await fetch('/api/auth/login/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          'cf-turnstile-response': cfTurnstileResponse,
        }),
      });

      if (res.ok && isJsonResponse(res)) {
        setStatus('Signed in! Reloading...', 'success');
        window.location.reload();
      } else {
        const body = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        setStatus((body as any).error || 'Invalid email or password.', 'error');
      }
    } catch {
      setStatus('Network error. Please try again.', 'error');
    } finally {
      resetTurnstileWidget();
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
}
