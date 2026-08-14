import { parse } from 'parse5';

const MAX_PAGE_BYTES = 1000000;
const MAX_STYLESHEETS = 5;
const MAX_CSS_BYTES = 300000;
const MAX_STRUCTURE_NODES = 80;

const COLOR_RE = /#[0-9a-f]{3,8}\b/gi;
const RGB_RE = /rgb(a)?\(\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*[, ]\s*\d{1,3}\s*(?:[,)]|(?:[,\s]\/?\s*[\d.]+\s*\)))/gi;
const DECL_RE = (prop) => new RegExp(`${prop}\\s*:\\s*([^;{}]+)`, 'gi');
const MEDIA_RE = /@media\s*([^{]+)/gi;

async function fetchText(url, maxBytes, timeoutMs = 10000) {
  const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Request failed with status ${res.status} ${res.statusText}`);
  const text = await res.text();
  if (text.length > maxBytes) throw new Error('Response too large');
  return text;
}

function rgbToHex(rgb) {
  const m = rgb.match(/(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})/);
  if (!m) return null;
  const hex = m.slice(1, 4).map(n => parseInt(n, 10).toString(16).padStart(2, '0')).join('');
  return `#${hex}`;
}

function topColors(css) {
  const counts = new Map();
  const addHex = (hex) => {
    if (hex.length === 4) hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    const rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    if (rgb.some(c => Number.isNaN(c))) return;
    const key = `#${rgb.map(c => Math.min(255, Math.round(c / 16) * 16).toString(16).padStart(2, '0')).join('')}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  };
  for (const m of css.matchAll(COLOR_RE)) addHex(m[0].toLowerCase());
  for (const m of css.matchAll(RGB_RE)) {
    const hex = rgbToHex(m[0]);
    if (hex) addHex(hex);
  }
  counts.delete('#000000');
  counts.delete('#ffffff');
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([color, n]) => `${color} (${n} uses)`);
}

function topValues(css, prop, limit) {
  const counts = new Map();
  for (const m of css.matchAll(DECL_RE(prop))) {
    const value = m[1].trim().toLowerCase().replace(/\s+/g, ' ').replace(/,\s*/g, ',');
    if (!value || value.includes('var(') || value.startsWith('inherit') || value.startsWith('initial')) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit).map(([value, n]) => n > 1 ? `${value} ×${n}` : value);
}

function breakpoints(css) {
  const set = new Set();
  for (const m of css.matchAll(MEDIA_RE)) {
    const inner = m[1];
    for (const bp of inner.matchAll(/(?:max|min)-width\s*:\s*(\d+)px/gi)) set.add(`${bp[1]}px`);
  }
  return [...set].sort((a, b) => parseInt(a, 10) - parseInt(b, 10)).slice(0, 8);
}

function collectCss(doc, baseUrl) {
  const parts = [];
  let external = [];

  function walk(node) {
    if (!node || !node.childNodes) return;
    for (const child of node.childNodes) {
      if (child.tagName === 'style') {
        for (const tc of child.childNodes || []) {
          if (tc.value) parts.push(tc.value);
        }
      }
      if (child.tagName === 'link') {
        const attrs = {};
        for (const a of child.attrs || []) attrs[a.name] = a.value;
        if ((attrs.rel || '').split(/\s+/).includes('stylesheet') && attrs.href) external.push(attrs.href);
      }
      if (child.attrs) {
        for (const a of child.attrs || []) {
          if (a.name === 'style') parts.push(a.value);
        }
      }
      walk(child);
    }
  }
  walk(doc);

  return { inline: parts.join('\n'), external };
}

function structureOutline(doc) {
  const lines = [];
  let nodes = 0;

  function describe(el) {
    const attrs = {};
    for (const a of el.attrs || []) attrs[a.name] = a.value;
    const id = attrs.id ? `#${attrs.id}` : '';
    const cls = (attrs.class || '').split(/\s+/).filter(Boolean).slice(0, 2).map(c => `.${c}`).join('');
    return `${el.tagName}${id}${cls}`;
  }

  function walk(el, depth) {
    if (nodes >= MAX_STRUCTURE_NODES) return;
    const children = (el.childNodes || []).filter(c => c.tagName);
    const grouped = new Map();
    for (const c of children) {
      const key = describe(c);
      grouped.set(key, (grouped.get(key) || 0) + 1);
    }
    const order = [...grouped.entries()].map(([key, count]) => count > 1 && depth < 4 ? `${key} ×${count}` : key).slice(0, 10);
    if (order.length > 0) {
      nodes++;
      lines.push(`${'  '.repeat(Math.min(depth, 6))}${describe(el)} > ${order.join(', ')}`);
    }
    for (const c of children) walk(c, depth + 1);
  }

  const body = doc.childNodes?.flatMap(n => n.tagName === 'html' ? (n.childNodes || []) : []).find(n => n.tagName === 'body');
  if (body) walk(body, 0);
  return lines.slice(0, 40);
}

function componentInventory(doc) {
  const tagCounts = new Map();
  const classHints = { card: 0, hero: 0, nav: 0, footer: 0, header: 0, sidebar: 0, badge: 0, avatar: 0, modal: 0, grid: 0, container: 0, btn: 0, banner: 0, tooltip: 0, carousel: 0, slider: 0, tab: 0, alert: 0, toast: 0 };
  const watched = new Set(['a', 'button', 'input', 'select', 'textarea', 'form', 'nav', 'footer', 'header', 'main', 'section', 'article', 'img', 'svg', 'video', 'table', 'ul', 'ol', 'h1', 'h2', 'h3', 'p']);

  function walk(node) {
    if (!node || !node.childNodes) return;
    for (const child of node.childNodes) {
      if (child.tagName && watched.has(child.tagName)) {
        tagCounts.set(child.tagName, (tagCounts.get(child.tagName) || 0) + 1);
      }
      for (const a of child.attrs || []) {
        if (a.name === 'class') {
          for (const cls of a.value.split(/\s+/)) {
            const key = cls.toLowerCase();
            if (key in classHints) classHints[key]++;
          }
        }
      }
      walk(child);
    }
  }
  walk(doc);

  const tags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  const classes = Object.entries(classHints).filter(([, n]) => n > 0).map(([k, n]) => n > 1 ? `${k} ×${n}` : k);
  return { tags, classes };
}

export async function loadPage(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error(`Invalid URL: ${url}`); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error(`Unsupported protocol "${parsed.protocol}". Only http(s) URLs are supported.`);

  let html;
  try {
    html = await fetchText(parsed.toString(), MAX_PAGE_BYTES);
  } catch (err) {
    throw new Error(`Failed to fetch page: ${err.message}`);
  }
  if (!/<!doctype\s+html|<html[\s>]/i.test(html)) throw new Error('The URL did not return an HTML page.');

  let doc;
  try { doc = parse(html); } catch { throw new Error('Failed to parse the page HTML.'); }

  const { inline, external } = collectCss(doc, parsed);
  const cssParts = [inline];
  const cssErrors = [];
  for (const href of external.slice(0, MAX_STYLESHEETS)) {
    try {
      const fullUrl = new URL(href, parsed);
      cssParts.push(await fetchText(fullUrl.toString(), MAX_CSS_BYTES));
    } catch (err) {
      cssErrors.push(`${href} (${err.message})`);
    }
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return {
    parsed,
    html,
    doc,
    css: cssParts.join('\n'),
    cssErrors,
    title: titleMatch ? titleMatch[1].trim() : '',
  };
}

export async function inspectPage(url) {
  let page;
  try {
    page = await loadPage(url);
  } catch (err) {
    return err.message;
  }
  const { parsed, doc, css, cssErrors, title } = page;

  const colors = topColors(css);
  const fonts = topValues(css, 'font-family', 8);
  const sizes = topValues(css, 'font-size', 6);
  const weights = topValues(css, 'font-weight', 5);
  const radii = topValues(css, 'border-radius', 5);
  const shadows = topValues(css, 'box-shadow', 3);
  const hasGradients = /(?:linear|radial|conic)-gradient/gi.test(css);
  const bps = breakpoints(css);
  const outline = structureOutline(doc);
  const { tags, classes } = componentInventory(doc);

  const lines = [];
  lines.push(`PAGE: ${title || parsed.hostname}`);
  lines.push('');
  lines.push('LAYOUT STRUCTURE:');
  if (outline.length === 0) lines.push('  (no elements detected)');
  else lines.push(...outline);
  lines.push('');
  lines.push('COMPONENTS:');
  lines.push(`  ${tags.map(([t, n]) => n > 1 ? `${t} ×${n}` : t).join(', ') || 'none'}`);
  if (classes.length > 0) lines.push(`  class hints: ${classes.join(', ')}`);
  lines.push('');
  lines.push('COLOR PALETTE:');
  if (colors.length === 0) lines.push('  (no colors found in CSS)');
  else lines.push(`  ${colors.join(', ')}`);
  lines.push('');
  if (fonts.length > 0) lines.push(`FONTS: ${fonts.join(', ')}`);
  if (sizes.length > 0) lines.push(`FONT SIZES: ${sizes.join(', ')}`);
  if (weights.length > 0) lines.push(`FONT WEIGHTS: ${weights.join(', ')}`);
  if (radii.length > 0) lines.push(`BORDER RADIUS: ${radii.join(', ')}`);
  if (shadows.length > 0) lines.push(`BOX SHADOWS: ${shadows.join(', ')}`);
  if (hasGradients) lines.push('GRADIENTS: yes');
  if (bps.length > 0) lines.push(`BREAKPOINTS: ${bps.join(', ')}`);
  if (cssErrors.length > 0) lines.push(`\nSTYLESHEETS NOT LOADED: ${cssErrors.join('; ')}`);

  return lines.join('\n');
}
