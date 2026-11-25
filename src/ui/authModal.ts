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
  remove?(widgetId?: string): void;
  getResponse(widgetId?: string): string | undefined;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SITEKEY =
  import.meta.env.VITE_TURNSTILE_SITEKEY || '0x4AAAAAAGRJSaBc3A9zSFEc';

type AuthMode = 'login' | 'signup';

let modalEl: HTMLElement | null = null;
let authModal: ModalController | null = null;
let authMode: AuthMode = 'login';
let turnstileWidgetId: string | null = null;
let turnstileToken = '';
let turnstileRetryTimer: number | null = null;

function clearTurnstileRetryTimer(): void {
  if (turnstileRetryTimer !== null) {
    window.clearTimeout(turnstileRetryTimer);
    turnstileRetryTimer = null;
  }
}

function removeTurnstileWidget(): void {
  clearTurnstileRetryTimer();
  turnstileToken = '';
  if (turnstileWidgetId !== null && window.turnstile?.remove) {
    window.turnstile.remove(turnstileWidgetId);
  } else if (modalEl) {
    const container = modalEl.querySelector<HTMLElement>('#auth-turnstile-container');
    if (container) container.innerHTML = '';
  }
  turnstileWidgetId = null;
}

function ensureTurnstileWidget(attemptsLeft = 50): void {
  if (!modalEl || turnstileWidgetId !== null) return;
  const container = modalEl.querySelector<HTMLElement>('#auth-turnstile-container');
  if (!container) return;

  if (window.turnstile) {
    clearTurnstileRetryTimer();
    turnstileWidgetId = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITEKEY,
      action: authMode,
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

export function openAuthModal(): void {
  if (!modalEl) {
    createAuthModal();
  }
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
          <h2 id="auth-modal-title" class="text-base font-bold text-fg-primary">Sign in to wrongfirst</h2>
          <p class="text-xs text-fg-muted mt-0.5">Sync progress across devices & unlock Pro</p>
        </div>
        <button id="close-auth-modal-btn" class="text-fg-muted hover:text-fg-primary transition-colors p-1.5 rounded-md hover:bg-bg-app cursor-pointer" title="Close">
        </button>
      </div>

      <form id="password-login-form" class="flex flex-col gap-2">
        <div id="auth-name-field" class="hidden flex-col gap-1.5">
          <label for="auth-name" class="text-xs text-fg-muted font-medium">Name</label>
          <input 
            type="text" 
            id="auth-name" 
            placeholder="Your name" 
            autocomplete="name"
            maxlength="80"
            class="w-full px-3 py-2 text-xs bg-bg-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-fg-primary"
          />
        </div>
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
          <p id="auth-password-hint" class="hidden text-[11px] text-fg-muted">At least 12 characters</p>
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
        <div class="text-center pt-1">
          <button
            type="button"
            id="auth-mode-toggle"
            class="text-xs text-fg-muted hover:text-fg-primary underline underline-offset-2 cursor-pointer"
          >
            Don't have an account? Create one
          </button>
        </div>
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
  const titleEl = modalEl.querySelector('#auth-modal-title') as HTMLElement;
  const nameFieldEl = modalEl.querySelector('#auth-name-field') as HTMLElement;
  const nameInput = modalEl.querySelector('#auth-name') as HTMLInputElement;
  const emailInput = modalEl.querySelector('#auth-email') as HTMLInputElement;
  const passwordInput = modalEl.querySelector('#auth-password') as HTMLInputElement;
  const passwordHintEl = modalEl.querySelector('#auth-password-hint') as HTMLElement;
  const submitBtn = modalEl.querySelector('#auth-submit-btn') as HTMLButtonElement;
  const statusEl = modalEl.querySelector('#auth-status') as HTMLElement;
  const modeToggleBtn = modalEl.querySelector('#auth-mode-toggle') as HTMLButtonElement;

  const setStatus = (text: string, tone: 'muted' | 'error' | 'success') => {
    statusEl.classList.remove('hidden', 'text-red-500', 'text-green-500', 'text-fg-muted');
    statusEl.classList.add(
      tone === 'error' ? 'text-red-500' : tone === 'success' ? 'text-green-500' : 'text-fg-muted'
    );
    statusEl.textContent = text;
  };

  const applyMode = (mode: AuthMode) => {
    authMode = mode;
    const isSignup = mode === 'signup';
    titleEl.textContent = isSignup ? 'Create your account' : 'Sign in to wrongfirst';
    submitBtn.textContent = isSignup ? 'Create account' : 'Sign in';
    nameFieldEl.classList.toggle('hidden', !isSignup);
    nameFieldEl.classList.toggle('flex', isSignup);
    nameInput.required = isSignup;
    passwordInput.autocomplete = isSignup ? 'new-password' : 'current-password';
    passwordHintEl.classList.toggle('hidden', !isSignup);
    modeToggleBtn.textContent = isSignup
      ? 'Already have an account? Sign in'
      : "Don't have an account? Create one";
    statusEl.classList.add('hidden');
    statusEl.textContent = '';
    removeTurnstileWidget();
    ensureTurnstileWidget();
  };

  modeToggleBtn?.addEventListener('click', () => {
    applyMode(authMode === 'login' ? 'signup' : 'login');
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameInput?.value.trim();
    const email = emailInput?.value.trim();
    const password = passwordInput?.value;
    if (!email || !password) return;

    const isSignup = authMode === 'signup';
    if (isSignup && !name) {
      setStatus('Please enter your name.', 'error');
      return;
    }
    if (isSignup && password.length < 12) {
      setStatus('Password must be at least 12 characters long.', 'error');
      return;
    }

    const cfTurnstileResponse =
      turnstileToken ||
      (turnstileWidgetId !== null ? window.turnstile?.getResponse(turnstileWidgetId) ?? '' : '');
    if (!cfTurnstileResponse) {
      setStatus('Please complete the verification check.', 'error');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    setStatus(isSignup ? 'Creating account...' : 'Signing in...', 'muted');

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login/password';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          ...(isSignup ? { name } : {}),
          'cf-turnstile-response': cfTurnstileResponse,
        }),
      });

      if (res.ok && isJsonResponse(res)) {
        if (isSignup) {
          const body = (await res.json().catch(() => ({}))) as { message?: string };
          setStatus(
            body.message || 'Verification email sent! Please check your inbox.',
            'success'
          );
          nameInput.value = '';
          passwordInput.value = '';
        } else {
          setStatus('Signed in! Reloading...', 'success');
          window.location.reload();
        }
      } else {
        const body = isJsonResponse(res) ? await res.json().catch(() => ({})) : {};
        setStatus(
          (body as any).error ||
            (isSignup ? 'Could not create account.' : 'Invalid email or password.'),
          'error'
        );
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
