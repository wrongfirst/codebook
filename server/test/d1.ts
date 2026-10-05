import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { D1Database, D1PreparedStatement } from '@cloudflare/workers-types';

export function createTestD1(): D1Database {
  const db = new DatabaseSync(':memory:');
  const migrationPath = resolve(process.cwd(), 'server/db/migrations/0001_initial.sql');
  const sql = readFileSync(migrationPath, 'utf8');
  db.exec(sql);

  function makePreparedStatement(query: string, boundValues: any[] = []): D1PreparedStatement {
    return {
      bind(...values: any[]) {
        return makePreparedStatement(query, values);
      },
      async first<T = unknown>(colName?: string): Promise<T | null> {
        const stmt = db.prepare(query);
        const row = stmt.get(...boundValues) as any;
        if (!row) return null;
        if (colName) return row[colName] ?? null;
        return row;
      },
      async all<T = unknown>(): Promise<{ results: T[]; success: boolean; meta: any }> {
        const stmt = db.prepare(query);
        const results = stmt.all(...boundValues) as T[];
        return { results, success: true, meta: {} };
      },
      async run<T = unknown>(): Promise<{ success: boolean; meta: any; results?: T[] }> {
        const stmt = db.prepare(query);
        const info = stmt.run(...boundValues);
        return { success: true, meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) } };
      },
      async raw<T = unknown>(): Promise<T[]> {
        const stmt = db.prepare(query);
        return stmt.all(...boundValues) as T[];
      },
    } as unknown as D1PreparedStatement;
  }

  return {
    prepare(query: string) {
      return makePreparedStatement(query);
    },
    async exec(query: string) {
      db.exec(query);
      return { count: 1, duration: 0 };
    },
    async batch(statements: D1PreparedStatement[]) {
      const results = [];
      for (const s of statements) {
        results.push(await s.run());
      }
      return results as any;
    },
    dump: async () => new ArrayBuffer(0),
  } as unknown as D1Database;
}
