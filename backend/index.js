import express from 'express';
import cors from 'cors';
import { runAgent, getBuiltinTools } from './agent.js';
import { MCPManager } from './mcp.js';
import { createMockupStore } from './mockup-store.js';
import { initDb, loadSettings, saveSettings, listSessions, getSession, createSession, updateSession, deleteSession, listAllSessionHtmls } from './db/index.js';
import { initImageCache, getImage, deleteSessionImages, sweepImageCache, storeImage, imageUrl } from './image-cache.js';

const app = express();
const port = process.env.PORT || 3101;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const mcpManager = new MCPManager();
let settings = {};
const mockupStore = createMockupStore();
const consoleLog = [];

async function start() {
  const db = await initDb();
  settings = await loadSettings();
  await initImageCache();

  try {
    const sessions = await listAllSessionHtmls();
    await sweepImageCache(sessions.map(s => s.html));
  } catch (err) {
    console.error('Image cache sweep error:', err);
  }

  if (settings.mcpServers?.length > 0) {
    mcpManager.connectAll(settings.mcpServers).catch(err => {
      console.error('MCP initial connection error:', err);
    });
  }

  app.listen(port, () => {
    console.log(`Backend listening at http://localhost:${port}`);
  });
}

app.post('/api/chat', async (req, res) => {
  const { prompt, thread, sessionId } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  if (res.socket) res.socket.setNoDelay(true);

  try {
    const mcpToolDefs = mcpManager.getToolDefs();

    const result = await runAgent({
      prompt,
      thread: thread || [],
      mockupStore,
      consoleLog,
      settings,
      mcpTools: mcpToolDefs,
      mcpClient: {
        tools: mcpManager.tools,
        callTool: (name, args) => mcpManager.callTool(name, args),
      },
      sessionId: sessionId || null,
      imageCache: {
        storeImage,
        imageUrl,
      },
      onEvent: (event) => {
        if (event.type === 'html_updated') {
          mockupStore.set(event.html);
        }
        res.write(JSON.stringify(event) + '\n');
      },
    });

    if (result.error) {
      res.write(JSON.stringify({ type: 'error', error: result.error }) + '\n');
    }

    if (!result.events.some(e => e.type === 'done')) {
      res.write(JSON.stringify({ type: 'done', finalHtml: mockupStore.get() }) + '\n');
    }
  } catch (err) {
    console.error('Chat error:', err);
    res.write(JSON.stringify({ type: 'error', error: err.message }) + '\n');
  }

  res.end();
});

app.get('/api/settings', (req, res) => {
  const safe = { ...settings };
  if (safe.openaiKey) safe.openaiKey = safe.openaiKey ? '••••••' + safe.openaiKey.slice(-4) : '';
  if (safe.anthropicKey) safe.anthropicKey = safe.anthropicKey ? '••••••' + safe.anthropicKey.slice(-4) : '';
  safe.mcpStatus = mcpManager.getStatus();
  safe.mcpToolCount = mcpManager.getToolDefs().length;
  res.json(safe);
});

app.post('/api/settings', async (req, res) => {
  const allowed = ['provider', 'openaiKey', 'openaiBaseUrl', 'openaiModel', 'anthropicKey', 'anthropicBaseUrl', 'anthropicModel', 'litellmUrl', 'litellmModel', 'systemPrompt', 'reasoningEffort', 'thinkingBudget', 'mcpServers'];
  const oldMcpServers = JSON.stringify(settings.mcpServers);

  const updates = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  if (typeof updates.openaiKey === 'string' && updates.openaiKey.startsWith('••••••')) {
    delete updates.openaiKey;
  }
  if (typeof updates.anthropicKey === 'string' && updates.anthropicKey.startsWith('••••••')) {
    delete updates.anthropicKey;
  }

  settings = await saveSettings(updates);

  const newMcpServers = JSON.stringify(settings.mcpServers);
  if (newMcpServers !== oldMcpServers) {
    try {
      await mcpManager.connectAll(settings.mcpServers || []);
    } catch (err) {
      console.error('MCP connection error:', err);
    }
  }

  const safe = { ...settings };
  if (safe.openaiKey) safe.openaiKey = safe.openaiKey ? '••••••' + safe.openaiKey.slice(-4) : '';
  if (safe.anthropicKey) safe.anthropicKey = safe.anthropicKey ? '••••••' + safe.anthropicKey.slice(-4) : '';
  safe.mcpStatus = mcpManager.getStatus();
  safe.mcpToolCount = mcpManager.getToolDefs().length;
  res.json(safe);
});

app.get('/api/images/:id', async (req, res) => {
  const img = await getImage(req.params.id);
  if (!img) return res.status(404).json({ error: 'Image not found' });
  res.setHeader('Content-Type', img.mime);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(img.buffer);
});

app.post('/api/screenshot', (req, res) => {
  const { html } = req.body;
  if (!html) return res.status(400).json({ error: 'HTML is required' });
  const base64 = Buffer.from(html, 'utf-8').toString('base64');
  res.json({
    dataUri: `data:text/html;base64,${base64}`,
    message: 'Use this data URI to render the HTML in a browser and take a screenshot.',
  });
});

app.get('/api/mcp/status', (req, res) => {
  res.json({
    servers: mcpManager.getStatus(),
    tools: mcpManager.getToolDefs().map(t => ({ name: t.name, description: t.description })),
    builtinTools: getBuiltinTools().map(t => ({ name: t.name, description: t.description })),
  });
});

app.get('/api/sessions', async (req, res) => {
  try {
    const list = await listSessions();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/sessions/:id', async (req, res) => {
  try {
    const session = await getSession(parseInt(req.params.id));
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { name, thread, html } = req.body;
    const session = await createSession({ name, thread, html });
    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/sessions/:id', async (req, res) => {
  try {
    const { name, thread, html } = req.body;
    const session = await updateSession(parseInt(req.params.id), { name, thread, html });
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await deleteSession(id);
    const others = await listAllSessionHtmls();
    await deleteSessionImages(id, others.map(s => s.html));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/console', (req, res) => {
  res.json({ entries: consoleLog });
});

app.post('/api/console', (req, res) => {
  const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
  consoleLog.length = 0;
  for (const e of entries.slice(-50)) {
    if (e && typeof e.message === 'string') {
      consoleLog.push({ type: e.type || 'info', message: e.message, source: e.source || '', line: e.line || null });
    }
  }
  res.json({ ok: true, count: consoleLog.length });
});

app.post('/api/reset', (req, res) => {
  mockupStore.clear();
  consoleLog.length = 0;
  res.json({ ok: true, message: 'Mockup reset' });
});

app.put('/api/mockup', (req, res) => {
  const { html } = req.body;
  mockupStore.set(html || '');
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'Core Mockup' });
});

start();
