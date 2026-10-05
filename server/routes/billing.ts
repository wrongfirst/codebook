import { Hono } from 'hono';
import type { Env } from '../index';
import { verifyPaddleSignature } from '../billing/paddle';
import { getSessionIdFromCookie, validateSession } from '../auth/session';

const billing = new Hono<{ Bindings: Env }>();

// ----------------------------------------------------
// Public Checkout Configuration
// ----------------------------------------------------
billing.get('/config', (c) => {
  return c.json({
    clientToken: c.env.PADDLE_CLIENT_TOKEN || null,
    priceId: c.env.PADDLE_PRICE_ID || null,
    environment: c.env.PADDLE_ENV || 'sandbox',
  });
});

// ----------------------------------------------------
// Paddle Webhook Receiver
// ----------------------------------------------------
billing.post('/webhook', async (c) => {
  const db = c.env.DB;
  const webhookSecret = c.env.PADDLE_WEBHOOK_SECRET;

  if (!db || !webhookSecret) {
    return c.text('Billing webhook unconfigured', 500);
  }

  const signature = c.req.header('Paddle-Signature') || c.req.header('paddle-signature');
  const rawBody = await c.req.text();

  const isValid = await verifyPaddleSignature(signature, rawBody, webhookSecret);
  if (!isValid) {
    return c.text('Invalid Paddle signature', 400);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.text('Invalid JSON payload', 400);
  }

  const eventType = event.event_type;
  const data = event.data || {};
  const subscriptionId = data.id;
  const customerId = data.customer_id;
  const userId = data.custom_data?.user_id;
  const now = Date.now();

  if (eventType === 'subscription.activated' || eventType === 'subscription.resumed') {
    if (userId) {
      await db
        .prepare(`
          UPDATE users 
          SET tier = 'pro', paddle_customer_id = ?, paddle_subscription_id = ?, updated_at = ?
          WHERE id = ?
        `)
        .bind(customerId ?? null, subscriptionId ?? null, now, userId)
        .run();
    } else if (customerId) {
      await db
        .prepare(`
          UPDATE users 
          SET tier = 'pro', paddle_subscription_id = ?, updated_at = ?
          WHERE paddle_customer_id = ?
        `)
        .bind(subscriptionId ?? null, now, customerId)
        .run();
    }
  } else if (eventType === 'subscription.canceled' || eventType === 'subscription.past_due') {
    if (userId) {
      await db
        .prepare(`UPDATE users SET tier = 'free', updated_at = ? WHERE id = ?`)
        .bind(now, userId)
        .run();
    } else if (subscriptionId) {
      await db
        .prepare(`UPDATE users SET tier = 'free', updated_at = ? WHERE paddle_subscription_id = ?`)
        .bind(now, subscriptionId)
        .run();
    }
  } else if (eventType === 'subscription.updated') {
    const status = data.status;
    const tier = status === 'active' ? 'pro' : 'free';
    if (userId) {
      await db
        .prepare(`
          UPDATE users 
          SET tier = ?, paddle_customer_id = COALESCE(?, paddle_customer_id), paddle_subscription_id = COALESCE(?, paddle_subscription_id), updated_at = ?
          WHERE id = ?
        `)
        .bind(tier, customerId ?? null, subscriptionId ?? null, now, userId)
        .run();
    } else if (subscriptionId) {
      await db
        .prepare(`UPDATE users SET tier = ?, updated_at = ? WHERE paddle_subscription_id = ?`)
        .bind(tier, now, subscriptionId)
        .run();
    }
  }

  return c.json({ received: true });
});

// ----------------------------------------------------
// Customer Billing Portal
// ----------------------------------------------------
billing.post('/portal', async (c) => {
  const db = c.env.DB;
  if (!db) {
    return c.json({ error: 'Database unavailable' }, 500);
  }

  const sessionId = getSessionIdFromCookie(c);
  if (!sessionId) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const user = await validateSession(db, sessionId);
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  if (!user.paddleCustomerId) {
    return c.json({ error: 'No active subscription or customer record found' }, 400);
  }

  const apiKey = c.env.PADDLE_API_KEY;
  const isSandbox = (c.env.PADDLE_ENV || 'sandbox') === 'sandbox';

  if (apiKey) {
    try {
      const baseUrl = isSandbox ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com';
      const portalRes = await fetch(`${baseUrl}/customers/${user.paddleCustomerId}/portal-sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (portalRes.ok) {
        const portalData = await portalRes.json() as any;
        const portalUrl = portalData.data?.urls?.general?.overview;
        if (portalUrl) {
          return c.json({ url: portalUrl });
        }
      }
    } catch (err) {
      console.error('[Paddle Portal Error]:', err);
    }
  }

  // Fallback portal URL
  return c.json({
    url: isSandbox
      ? `https://sandbox-customer-portal.paddle.com?customer_id=${user.paddleCustomerId}`
      : `https://customer-portal.paddle.com?customer_id=${user.paddleCustomerId}`,
  });
});

export default billing;
