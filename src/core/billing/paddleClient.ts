import { useAuthStore } from '../auth/authStore';

declare global {
  interface Window {
    Paddle?: any;
  }
}

interface BillingConfig {
  clientToken: string | null;
  priceId: string | null;
  environment: 'sandbox' | 'production';
}

let cachedConfig: BillingConfig | null = null;
let paddleInitialized = false;

export async function getBillingConfig(): Promise<BillingConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    const res = await fetch('/api/billing/config');
    if (res.ok) {
      cachedConfig = await res.json() as BillingConfig;
      return cachedConfig;
    }
  } catch (err) {
    console.warn('[Paddle] Failed to fetch billing config:', err);
  }
  return { clientToken: null, priceId: null, environment: 'sandbox' };
}

export async function loadPaddleScript(): Promise<boolean> {
  if (window.Paddle) return true;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.paddle.com/paddle/v2/paddle.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('[Paddle] Failed to load paddle.js');
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

export async function openPaddleCheckout(): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!user) {
    throw new Error('User must be signed in to upgrade');
  }

  const config = await getBillingConfig();
  if (!config.clientToken || !config.priceId) {
    throw new Error('Billing credentials are not configured yet on this instance.');
  }

  const scriptLoaded = await loadPaddleScript();
  if (!scriptLoaded || !window.Paddle) {
    throw new Error('Failed to initialize Paddle payment overlay.');
  }

  if (!paddleInitialized) {
    window.Paddle.Environment.set(config.environment);
    window.Paddle.Initialize({
      token: config.clientToken,
      eventCallback: (data: any) => {
        if (data.name === 'checkout.completed') {
          // Refresh session to pick up new Pro entitlement
          useAuthStore.getState().checkAuth();
        }
      },
    });
    paddleInitialized = true;
  }

  window.Paddle.Checkout.open({
    settings: {
      displayMode: 'overlay',
      theme: 'dark',
    },
    items: [
      {
        priceId: config.priceId,
        quantity: 1,
      },
    ],
    customer: {
      email: user.email,
    },
    customData: {
      user_id: user.id,
    },
  });
}

export async function openCustomerBillingPortal(): Promise<void> {
  try {
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    if (res.ok) {
      const data = await res.json() as { url?: string };
      if (data.url) {
        window.open(data.url, '_blank');
        return;
      }
    }
    const err = await res.json().catch(() => ({}));
    alert((err as any).error || 'Failed to open customer portal');
  } catch (err) {
    console.error('[Paddle] Error opening billing portal:', err);
    alert('Network error trying to open billing portal');
  }
}
