import { Hono } from 'hono';
import type { Env } from '../index';
import { getSessionIdFromCookie, validateSession } from '../auth/session';

const chat = new Hono<{ Bindings: Env }>();

chat.post('/', async (c) => {
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

  if (user.tier !== 'pro') {
    return c.json({ error: 'Pro subscription required for managed AI tutoring' }, 403);
  }

  // Enforce daily rate limit (100 queries/day)
  const dateKey = new Date().toISOString().slice(0, 10);
  const usage = await db
    .prepare('SELECT request_count FROM ai_usage WHERE user_id = ? AND date_key = ?')
    .bind(user.id, dateKey)
    .first<{ request_count: number }>();

  const currentCount = usage?.request_count ?? 0;
  if (currentCount >= 100) {
    return c.json(
      { error: 'Daily AI limit reached (100 queries/day). Resets at midnight UTC.' },
      429
    );
  }

  let body: { messages?: Array<{ role: string; content: string }> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON payload' }, 400);
  }

  if (!body.messages || !Array.isArray(body.messages)) {
    return c.json({ error: 'Missing messages array' }, 400);
  }

  // Increment usage count
  await db
    .prepare(`
      INSERT INTO ai_usage (user_id, date_key, request_count)
      VALUES (?, ?, 1)
      ON CONFLICT(user_id, date_key) DO UPDATE SET request_count = request_count + 1
    `)
    .bind(user.id, dateKey)
    .run();

  const ai = c.env.AI as any;
  if (!ai) {
    return c.json({ error: 'Workers AI binding unavailable' }, 500);
  }

  try {
    const aiStream: ReadableStream = await ai.run('@cf/qwen/qwen2.5-coder-32b-instruct', {
      messages: body.messages,
      stream: true,
      gateway: (c.env as any).CF_AI_GATEWAY ? { id: (c.env as any).CF_AI_GATEWAY } : undefined,
    });

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;

          const dataStr = trimmed.slice(5).trim();
          if (dataStr === '[DONE]') {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continue;
          }

          try {
            const parsed = JSON.parse(dataStr);
            const token = parsed.response ?? parsed.choices?.[0]?.delta?.content ?? '';
            if (token) {
              const openAiChunk = JSON.stringify({
                choices: [{ delta: { content: token } }],
              });
              controller.enqueue(encoder.encode(`data: ${openAiChunk}\n\n`));
            }
          } catch {
            // Passthrough if already valid or unparseable
          }
        }
      },
      flush(controller) {
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      },
    });

    const readable = aiStream.pipeThrough(transformStream);

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: any) {
    console.error('[Workers AI Error]:', err);
    return c.json({ error: err.message || 'Workers AI request failed' }, 500);
  }
});

export default chat;
