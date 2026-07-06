import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const connectionString = process.env.DATABASE_URL || 'postgres://core_mockup:core_mockup_dev@localhost:5433/core_mockup';

let db;

export async function initDb() {
  const client = postgres(connectionString, { max: 1 });
  db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: resolve(__dirname, './migrations') });

  const existing = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (existing.length === 0) {
    await db.insert(schema.settings).values({
      id: 1,
      data: getDefaultSettings(),
    });
  }

  return db;
}

export function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

export async function loadSettings() {
  const result = await db.select().from(schema.settings).where(eq(schema.settings.id, 1));
  if (result.length === 0) return getDefaultSettings();
  const saved = { ...getDefaultSettings(), ...result[0].data };
  if (typeof saved.openaiKey === 'string' && saved.openaiKey.startsWith('••••••')) {
    saved.openaiKey = process.env.OPENAI_API_KEY || '';
  }
  if (typeof saved.anthropicKey === 'string' && saved.anthropicKey.startsWith('••••••')) {
    saved.anthropicKey = process.env.ANTHROPIC_API_KEY || '';
  }
  return saved;
}

export async function saveSettings(data) {
  const current = await loadSettings();
  const merged = { ...current, ...data };
  await db
    .update(schema.settings)
    .set({ data: merged, updatedAt: new Date() })
    .where(eq(schema.settings.id, 1));
  return merged;
}

function getDefaultSettings() {
  return {
    provider: process.env.LLM_PROVIDER || 'mock',
    openaiKey: process.env.OPENAI_API_KEY || '',
    openaiBaseUrl: process.env.OPENAI_BASE_URL || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicBaseUrl: process.env.ANTHROPIC_BASE_URL || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
    litellmUrl: process.env.LITELLM_URL || 'http://localhost:4000',
    litellmModel: process.env.LITELLM_MODEL || 'gpt-4o',
    reasoningEffort: process.env.REASONING_EFFORT || 'medium',
    thinkingBudget: process.env.THINKING_BUDGET ? parseInt(process.env.THINKING_BUDGET) : 16000,
    systemPrompt: process.env.SYSTEM_PROMPT || 'You are a UI mockup generator.\n\nTools:\n- read_mockup: Read the current mockup HTML (includes line numbers)\n- search_code: Find specific text/code sections in the mockup\n- edit_mockup(start_line, end_line, new_content): Replace lines by number (for small, precise changes)\n- write_mockup: Replace the entire mockup (for big changes)\n\nWorkflow:\n1. For small iterations: read_mockup → search_code → edit_mockup\n2. For full rewrites: write_mockup\n3. ALWAYS end your turn by calling respond with a structured message\n4. Never return plain text — always use respond as your final action',
    mcpServers: [],
  };
}
