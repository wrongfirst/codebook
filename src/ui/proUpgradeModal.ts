import { useAuthStore } from '../core/auth/authStore';
import { openAuthModal } from './authModal';
import { openPaddleCheckout, openCustomerBillingPortal } from '../core/billing/paddleClient';
import { createModal, type ModalController } from './modal';

let upgradeModalEl: HTMLElement | null = null;
let upgradeModal: ModalController | null = null;

export function initProUpgradeModal(): void {
  window.addEventListener('wrongfirst:open-upgrade-modal', () => {
    openProUpgradeModal();
  });

  window.addEventListener('wrongfirst:open-billing-portal', () => {
    openCustomerBillingPortal();
  });
}

export function openProUpgradeModal(): void {
  const user = useAuthStore.getState().user;
  if (!user) {
    openAuthModal();
    return;
  }

  if (!upgradeModalEl) {
    createProUpgradeModal();
  }

  upgradeModal?.open();
}

export function closeProUpgradeModal(): void {
  upgradeModal?.close();
}

function createProUpgradeModal(): void {
  upgradeModalEl = document.createElement('div');
  upgradeModalEl.id = 'pro-upgrade-modal';
  upgradeModalEl.className = 'hidden fixed inset-0 z-100 items-center justify-center bg-black/60 backdrop-blur-sm p-4';

  upgradeModalEl.innerHTML = `
    <div class="bg-bg-surface border border-border-default rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-lg relative flex flex-col gap-5 text-fg-primary animate-in fade-in zoom-in-95 duration-150">
      <div class="flex items-start justify-between pb-3 border-b border-border-default">
        <div>
          <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 text-[11px] font-bold uppercase tracking-wider mb-2">
            wrongfirst Pro
          </div>
          <h2 class="text-xl font-bold text-fg-primary">Supercharge your learning journey</h2>
          <p class="text-xs text-fg-muted mt-1">Unlock cloud sync, managed AI tutoring, and early access.</p>
        </div>
        <button id="close-upgrade-modal-btn" class="text-fg-muted hover:text-fg-primary transition-colors p-1.5 rounded-md hover:bg-bg-app cursor-pointer" title="Close">
        </button>
      </div>

      <div class="space-y-3.5 text-xs">
        <div class="flex items-start gap-3 p-3 rounded-xl bg-bg-app border border-border-default/60">
          <div class="w-8 h-8 rounded-lg bg-brand/10 text-brand flex items-center justify-center shrink-0 text-base">
            ☁️
          </div>
          <div>
            <div class="font-semibold text-fg-primary text-sm">Automated Cloud Progress Sync</div>
            <div class="text-fg-muted mt-0.5 leading-relaxed">Continuous, background sync of all your code, notes, and solved exercises across every browser and device.</div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 rounded-xl bg-bg-app border border-border-default/60">
          <div class="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 text-base">
            🦆
          </div>
          <div>
            <div class="font-semibold text-fg-primary text-sm">Managed Rubber Duck AI</div>
            <div class="text-fg-muted mt-0.5 leading-relaxed">Direct access to state-of-the-art code tutoring powered by Qwen 2.5 Coder at the edge with zero API key configuration.</div>
          </div>
        </div>

        <div class="flex items-start gap-3 p-3 rounded-xl bg-bg-app border border-border-default/60">
          <div class="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 text-base">
            ⚡
          </div>
          <div>
            <div class="font-semibold text-fg-primary text-sm">Priority Runtime Access</div>
            <div class="text-fg-muted mt-0.5 leading-relaxed">First look at new language runtimes, upcoming exercise tracks, and exclusive sandbox tooling.</div>
          </div>
        </div>
      </div>

      <div class="pt-2 flex flex-col gap-2">
        <button 
          id="confirm-upgrade-btn" 
          class="w-full py-3 px-4 bg-brand hover:opacity-90 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Upgrade to Pro</span>
          <span class="opacity-80 font-normal text-xs">• $9 / month</span>
        </button>
        <div id="upgrade-error" class="hidden text-xs text-red-500 text-center font-medium"></div>
        <p class="text-[11px] text-fg-muted text-center">Billed monthly via Paddle. Cancel anytime with a single click.</p>
      </div>
    </div>
  `;

  document.body.appendChild(upgradeModalEl);

  upgradeModal = createModal({
    modal: upgradeModalEl,
    closeBtn: upgradeModalEl.querySelector<HTMLButtonElement>('#close-upgrade-modal-btn'),
    restoreFocus: true,
  });

  const upgradeBtn = upgradeModalEl.querySelector('#confirm-upgrade-btn') as HTMLButtonElement;
  const errorEl = upgradeModalEl.querySelector('#upgrade-error') as HTMLElement;

  upgradeBtn?.addEventListener('click', async () => {
    errorEl.classList.add('hidden');
    upgradeBtn.disabled = true;
    upgradeBtn.classList.add('opacity-50');

    try {
      await openPaddleCheckout();
      closeProUpgradeModal();
    } catch (err: any) {
      errorEl.textContent = err.message || 'Failed to launch checkout.';
      errorEl.classList.remove('hidden');
    } finally {
      upgradeBtn.disabled = false;
      upgradeBtn.classList.remove('opacity-50');
    }
  });
}
