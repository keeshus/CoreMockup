import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve, join } from 'path';
import { promises as fs } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = resolve(__dirname, './cache/images');
const INDEX_FILE = resolve(__dirname, './cache/index.json');
const IMAGE_URL_BASE = process.env.BACKEND_PUBLIC_URL || 'http://localhost:3101';
const SWEEP_TTL_MS = 24 * 60 * 60 * 1000;

const MIME_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
};

let index = new Map();

async function persistIndex() {
  await fs.mkdir(dirname(INDEX_FILE), { recursive: true });
  await fs.writeFile(INDEX_FILE, JSON.stringify([...index.values()]), 'utf8');
}

export async function initImageCache() {
  try {
    const raw = await fs.readFile(INDEX_FILE, 'utf8');
    index = new Map(JSON.parse(raw).map(e => [e.id, e]));
  } catch {
    index = new Map();
  }
  await fs.mkdir(CACHE_DIR, { recursive: true });
}

export function imageUrl(id) {
  return `${IMAGE_URL_BASE}/api/images/${id}`;
}

export async function storeImage(buffer, mime, sessionId = null) {
  const id = createHash('sha256').update(buffer).digest('hex').slice(0, 32);
  if (!index.has(id)) {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    const ext = MIME_EXT[mime] || 'bin';
    await fs.writeFile(join(CACHE_DIR, `${id}.${ext}`), buffer);
    index.set(id, { id, mime, sessionId: sessionId ?? null, createdAt: Date.now() });
    await persistIndex();
  }
  return id;
}

export async function getImage(id) {
  const entry = index.get(id);
  if (entry) {
    const ext = MIME_EXT[entry.mime] || 'bin';
    try {
      const buffer = await fs.readFile(join(CACHE_DIR, `${id}.${ext}`));
      return { buffer, mime: entry.mime };
    } catch {}
  }
  let files;
  try {
    files = await fs.readdir(CACHE_DIR);
  } catch {
    return null;
  }
  const match = files.find(f => f.startsWith(`${id}.`));
  if (!match) return null;
  try {
    const buffer = await fs.readFile(join(CACHE_DIR, match));
    const ext = match.split('.').pop();
    const mime = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0] || 'application/octet-stream';
    return { buffer, mime };
  } catch {
    return null;
  }
}

export function getSessionImageIds(sessionId) {
  return [...index.values()].filter(e => e.sessionId === sessionId).map(e => e.id);
}

export async function deleteImagesByIds(ids) {
  let changed = false;
  for (const id of ids) {
    const entry = index.get(id);
    if (!entry) continue;
    const ext = MIME_EXT[entry.mime] || 'bin';
    try {
      await fs.unlink(join(CACHE_DIR, `${id}.${ext}`));
    } catch {}
    index.delete(id);
    changed = true;
  }
  if (changed) await persistIndex();
}

export async function deleteSessionImages(sessionId, otherSessionHtmls = []) {
  const removable = getSessionImageIds(sessionId).filter(
    id => !otherSessionHtmls.some(html => html.includes(`/api/images/${id}`)),
  );
  await deleteImagesByIds(removable);
}

export async function sweepImageCache(sessionHtmls = []) {
  const now = Date.now();
  const stale = [...index.values()]
    .filter(e => e.createdAt < now - SWEEP_TTL_MS && !sessionHtmls.some(html => html.includes(`/api/images/${e.id}`)))
    .map(e => e.id);
  await deleteImagesByIds(stale);
}
