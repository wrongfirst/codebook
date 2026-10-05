import { ICONS } from './icons';

let modalEl: HTMLElement | null = null;

export function openAuthModal(): void {
  if (!modalEl) {
    createAuthModal();
  }
  if (modalEl) {
    modalEl.classList.remove('hidden');
    modalEl.classList.add('flex');
    const input = modalEl.querySelector<HTMLInputElement>('#magic-link-email');
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }
}

export function closeAuthModal(): void {
  if (modalEl) {
    modalEl.classList.add('hidden');
    modalEl.classList.remove('flex');
  }
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
          ${ICONS.CLOSE}
        </button>
      </div>

      <div class="flex flex-col gap-2.5 pt-1">
        <a href="/api/auth/login/github" class="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 bg-[#24292F] hover:bg-[#1a1e22] text-white font-medium text-xs rounded-lg transition-colors shadow-sm">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path fill-rule="evenodd" clip-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Continue with GitHub
        </a>

        <a href="/api/auth/login/google" class="flex items-center justify-center gap-2.5 w-full py-2.5 px-4 bg-bg-app hover:bg-border-default/50 text-fg-primary border border-border-default font-medium text-xs rounded-lg transition-colors shadow-sm">
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

      <form id="magic-link-form" class="flex flex-col gap-2">
        <label for="magic-link-email" class="text-xs text-fg-muted font-medium">Email address</label>
        <input 
          type="email" 
          id="magic-link-email" 
          placeholder="you@example.com" 
          required 
          class="w-full px-3 py-2 text-xs bg-bg-app border border-border-default rounded-lg focus:outline-none focus:border-brand text-fg-primary"
        />
        <button 
          type="submit" 
          id="magic-link-submit-btn" 
          class="w-full py-2 px-4 bg-brand hover:opacity-90 text-white font-medium text-xs rounded-lg transition-all shadow-sm cursor-pointer"
        >
          Send Magic Link
        </button>
        <div id="magic-link-status" class="hidden text-xs text-center py-1 font-medium"></div>
      </form>
    </div>
  `;

  document.body.appendChild(modalEl);

  // Close actions
  modalEl.querySelector('#close-auth-modal-btn')?.addEventListener('click', closeAuthModal);
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeAuthModal();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.classList.contains('hidden')) {
      closeAuthModal();
    }
  });

  // Placeholder form submit for magic link
  const form = modalEl.querySelector('#magic-link-form') as HTMLFormElement;
  const statusEl = modalEl.querySelector('#magic-link-status') as HTMLElement;
  const submitBtn = modalEl.querySelector('#magic-link-submit-btn') as HTMLButtonElement;

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = modalEl?.querySelector('#magic-link-email') as HTMLInputElement;
    const email = emailInput?.value.trim();
    if (!email) return;

    submitBtn.disabled = true;
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    statusEl.classList.remove('hidden', 'text-red-500', 'text-green-500');
    statusEl.classList.add('text-fg-muted');
    statusEl.textContent = 'Sending magic link...';

    try {
      const res = await fetch('/api/auth/magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        statusEl.classList.remove('text-fg-muted');
        statusEl.classList.add('text-green-500');
        statusEl.textContent = 'Check your inbox for your login link!';
        emailInput.value = '';
      } else {
        const body = await res.json().catch(() => ({}));
        statusEl.classList.remove('text-fg-muted');
        statusEl.classList.add('text-red-500');
        statusEl.textContent = (body as any).error || 'Failed to send magic link. Try again.';
      }
    } catch {
      statusEl.classList.remove('text-fg-muted');
      statusEl.classList.add('text-red-500');
      statusEl.textContent = 'Network error. Please try again.';
    } finally {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  });
}
