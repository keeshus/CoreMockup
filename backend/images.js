import { loadPage } from './inspect.js';

const MAX_IMAGE_BYTES = 300000;
const MAX_CANDIDATES = 25;
const MIN_IMAGE_BYTES = 64;
const CSS_URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/gi;

function normalizeUrl(href, base) {
  try { return new URL(href, base).toString(); } catch { return null; }
}

function classify(filename, alt, className, role) {
  const text = `${filename} ${alt} ${className}`.toLowerCase();
  if (role === 'favicon') return 'logo';
  if (/logo|brand|mark|emblem/.test(text)) return 'logo';
  if (/icon|sprite/.test(text) || (filename.endsWith('.svg') && !/hero|banner|background/.test(text))) return 'icon';
  if (/hero|banner|cover|header|background|og-image|share/.test(text)) return 'hero';
  return 'content';
}

function imageType(filename) {
  const m = filename.toLowerCase().match(/\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/);
  return m ? m[1] : '';
}

function biggestSrcset(srcset) {
  let best = null;
  let bestSize = -1;
  for (const part of srcset.split(',')) {
    const [url, desc] = part.trim().split(/\s+/);
    if (!url) continue;
    let size = 0;
    if (desc?.endsWith('w')) size = parseInt(desc, 10) || 0;
    else if (desc?.endsWith('x')) size = (parseFloat(desc) || 1) * 1000;
    if (size >= bestSize) { bestSize = size; best = url; }
  }
  return best;
}

function collectCandidates(page) {
  const { parsed, doc, css } = page;
  const candidates = [];
  const seen = new Set();

  function add(href, context, role) {
    const full = normalizeUrl(href, parsed);
    if (!full || seen.has(full)) return;
    if (full.startsWith('data:') || full.startsWith('blob:')) return;
    seen.add(full);
    const filename = full.split('?')[0].split('/').pop() || '';
    const type = imageType(filename);
    if (type === 'ico' && role !== 'favicon') return;
    candidates.push({
      url: full,
      filename,
      type,
      role: classify(filename, context.alt || '', context.className || '', role),
      context: [context.className, context.alt].filter(Boolean).join(' '),
    });
  }

  function walk(node) {
    if (!node || !node.childNodes) return;
    for (const child of node.childNodes) {
      if (child.tagName === 'img') {
        const attrs = {};
        for (const a of child.attrs || []) attrs[a.name] = a.value;
        const src = attrs.srcset ? biggestSrcset(attrs.srcset) : attrs.src;
        if (src) add(src, attrs, 'img');
      } else if (child.tagName === 'picture') {
        for (const s of child.childNodes || []) {
          if (s.tagName === 'source' && s.attrs) {
            const srcset = s.attrs.find(a => a.name === 'srcset')?.value;
            if (srcset) add(biggestSrcset(srcset), {}, 'picture');
          }
        }
      } else if (child.tagName === 'link') {
        const attrs = {};
        for (const a of child.attrs || []) attrs[a.name] = a.value;
        const rel = (attrs.rel || '').split(/\s+/);
        if (rel.includes('icon') || rel.includes('apple-touch-icon')) add(attrs.href, {}, 'favicon');
      } else if (child.tagName === 'meta') {
        const attrs = {};
        for (const a of child.attrs || []) attrs[a.name] = a.value;
        if ((attrs.property === 'og:image' || attrs.name === 'twitter:image') && attrs.content) add(attrs.content, {}, 'meta');
      }
      walk(child);
    }
  }
  walk(doc);

  for (const m of css.matchAll(CSS_URL_RE)) {
    const href = m[1].trim();
    if (!/^data:|^blob:|^#/i.test(href)) add(href, {}, 'css');
  }

  const rank = { logo: 0, hero: 1, icon: 2, content: 3 };
  candidates.sort((a, b) => (rank[a.role] ?? 4) - (rank[b.role] ?? 4) || a.filename.localeCompare(b.filename));
  return candidates;
}

export async function listImages(url) {
  let page;
  try {
    page = await loadPage(url);
  } catch (err) {
    return err.message;
  }
  const candidates = collectCandidates(page);
  if (candidates.length === 0) return 'No images found on the page.';

  const lines = [`Images found on ${page.title || page.parsed.hostname} (pass the URL to grab_image to embed one):`];
  for (const [i, c] of candidates.slice(0, MAX_CANDIDATES).entries()) {
    const type = c.type || '?';
    lines.push(`[${i + 1}] ${c.role} — ${c.filename || c.url} (${type}${c.context ? `, ${c.context}` : ''})`);
    lines.push(`    ${c.url}`);
  }
  lines.push('\nCall grab_image with the URL of an image you want, then put the returned URL directly in an <img src="..."> tag of the mockup.');
  return lines.join('\n');
}

function sniffImage(bytes, contentType) {
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    const w = bytes.readUInt32BE(16);
    const h = bytes.readUInt32BE(20);
    return { mime: 'image/png', width: w, height: h };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let off = 2;
    while (off + 9 < bytes.length) {
      if (bytes[off] !== 0xff) { off++; continue; }
      const marker = bytes[off + 1];
      if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
      const len = bytes.readUInt16BE(off + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        const h = bytes.readUInt16BE(off + 5);
        const w = bytes.readUInt16BE(off + 7);
        return { mime: 'image/jpeg', width: w, height: h };
      }
      off += 2 + len;
    }
    return { mime: 'image/jpeg', width: 0, height: 0 };
  }
  const gif = bytes.toString('latin1', 0, 6);
  if (gif.startsWith('GIF87a') || gif.startsWith('GIF89a')) {
    return { mime: 'image/gif', width: bytes.readUInt16LE(6), height: bytes.readUInt16LE(8) };
  }
  const head = bytes.toString('latin1', 0, 512);
  if (/<svg[\s>]/i.test(head) || contentType.includes('svg')) {
    const m = head.match(/viewBox\s*=\s*["']\s*[\d.]+\s+[\d.]+\s+([\d.]+)\s+([\d.]+)/i)
      || head.match(/width\s*=\s*["']([\d.]+)["'][^>]*height\s*=\s*["']([\d.]+)["']/i)
      || head.match(/width\s*=\s*["']([\d.]+)["']/i);
    const width = m ? parseFloat(m[1]) : 0;
    const height = m && m[2] ? parseFloat(m[2]) : 0;
    return { mime: 'image/svg+xml', width, height };
  }
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    return { mime: 'image/webp', width: 0, height: 0 };
  }
  return { mime: contentType || 'application/octet-stream', width: 0, height: 0 };
}

export async function grabImage(url, maxBytes = MAX_IMAGE_BYTES, sessionId = null, imageCache = null) {
  let parsed;
  try { parsed = new URL(url); } catch { return `Invalid URL: ${url}`; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return `Unsupported protocol "${parsed.protocol}". Only http(s) URLs are supported.`;

  let res;
  try {
    res = await fetch(parsed.toString(), { redirect: 'follow', signal: AbortSignal.timeout(15000) });
  } catch (err) {
    return `Failed to fetch image: ${err.message}`;
  }
  if (!res.ok) return `Image request failed with status ${res.status} ${res.statusText}`;

  const contentType = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const length = parseInt(res.headers.get('content-length') || '0', 10);
  if (length > maxBytes) return `Image is ${Math.round(length / 1024)} KB, which exceeds the ${Math.round(maxBytes / 1024)} KB limit. Pick a smaller image or skip it.`;

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > maxBytes) return `Image is ${Math.round(buf.length / 1024)} KB, which exceeds the ${Math.round(maxBytes / 1024)} KB limit. Pick a smaller image or skip it.`;
  if (buf.length < MIN_IMAGE_BYTES) return 'Image looks too small to be useful (possibly a tracking pixel).';

  const info = sniffImage(buf, contentType);
  if (!info.mime.startsWith('image/')) return `The URL returned ${contentType || 'an unknown type'}, not an image.`;
  if (info.width > 0 && info.width < 2 || info.height > 0 && info.height < 2) {
    return 'This is a tracking pixel (1×1 image). Skip it.';
  }

  const dims = info.width > 0 ? `${info.width}×${info.height}` : 'unknown dimensions';

  if (imageCache) {
    const id = await imageCache.storeImage(buf, info.mime, sessionId);
    const url = imageCache.imageUrl(id);
    return `IMAGE READY (${info.mime}, ${dims}, ${Math.round(buf.length / 1024)} KB). Use this URL as the src of your <img> tag (set width="${info.width || ''}" height="${info.height || ''}" alt="..."):\n${url}`;
  }

  const dataUri = `data:${info.mime};base64,${buf.toString('base64')}`;
  return `IMAGE READY (${info.mime}, ${dims}, ${Math.round(buf.length / 1024)} KB). Use this data URI as the src of your <img> tag (set width="${info.width || ''}" height="${info.height || ''}" alt="..."):\n${dataUri}`;
}
