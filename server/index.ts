import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import authRoutes from './routes/auth';
import billingRoutes from './routes/billing';
import syncRoutes from './routes/sync';
import chatRoutes from './routes/chat';

export interface Env {
  DB?: D1Database;
  AI?: unknown;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  RESEND_API_KEY?: string;
  PADDLE_API_KEY?: string;
  PADDLE_WEBHOOK_SECRET?: string;
  PADDLE_CLIENT_TOKEN?: string;
  PADDLE_PRICE_ID?: string;
  PADDLE_ENV?: string;
  CF_AI_GATEWAY?: string;
}

const app = new Hono<{ Bindings: Env }>();

app.route('/api/auth', authRoutes);
app.route('/api/billing', billingRoutes);
app.route('/api/sync', syncRoutes);
app.route('/api/chat', chatRoutes);

app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'codebook',
    timestamp: Date.now(),
  });
});

export default app;
