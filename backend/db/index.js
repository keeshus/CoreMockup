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

export async function listSessions() {
  const result = await db.select({
    id: schema.sessions.id,
    name: schema.sessions.name,
    updatedAt: schema.sessions.updatedAt,
  })
    .from(schema.sessions)
    .orderBy(schema.sessions.updatedAt);
  return result;
}

export async function getSession(id) {
  const result = await db.select()
    .from(schema.sessions)
    .where(eq(schema.sessions.id, id));
  return result[0] || null;
}

export async function createSession({ name, thread, html }) {
  const result = await db.insert(schema.sessions).values({
    name: name || 'Untitled',
    thread: thread || [],
    html: html || '',
  }).returning();
  return result[0];
}

export async function updateSession(id, data) {
  const result = await db.update(schema.sessions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(schema.sessions.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteSession(id) {
  await db.delete(schema.sessions).where(eq(schema.sessions.id, id));
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
    systemPrompt: process.env.SYSTEM_PROMPT || 'You are a UI mockup generator. You build and refine HTML mockups that render in a live preview.\n\nTools:\n- read_mockup: Read the current mockup HTML (includes line numbers and total line count)\n- search_code(query): Find specific sections of the mockup\n- edit_mockup(start_line, end_line, new_content): Replace a range of lines by number — PREFERRED for all localized changes\n- write_mockup(html): Replace the ENTIRE mockup — use ONLY for complete redesigns affecting most of the file\n- undo_mockup: Restore the previous version after a bad change\n- fetch_url(url): Fetch a web page to use as a reference (e.g. "make it look like example.com")\n- inspect_page(url): Analyze how a web page LOOKS (colors, fonts, layout structure, components) so your mockup can visually resemble it\n- list_images(url): List the images on a web page (logos, heroes, icons) with their URLs\n- grab_image(url): Fetch an image and return it as a data URI to embed in the mockup (e.g. a site's logo)\n- validate_html: Check the mockup for HTML errors and duplicates\n- mock_data(dataset, count): Generate realistic placeholder data (users, products, chart_series, paragraphs, avatars)\n- check_console: Show JavaScript errors/warnings from the live preview\n\nWorkflow:\n1. Small changes (up to roughly half the file): read_mockup → edit_mockup. Avoid write_mockup unless the whole design must be replaced.\n2. Mimicking an existing site: call inspect_page (how it looks), fetch_url (its content), and list_images + grab_image (its logo and photos) first, then replicate all of it.\n3. Before finishing: run validate_html and fix reported issues; run check_console if the mockup contains scripts.\n4. Fill realistic content with mock_data instead of repeated placeholder text.\n5. ALWAYS end your turn by calling respond with a structured message.\n6. Never return plain text — always use respond as your final action',
    mcpServers: [],
  };
}
