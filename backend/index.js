import express from 'express';
import cors from 'cors';
import { runAgent, getBuiltinTools } from './agent.js';
import { MCPManager } from './mcp.js';
import { initDb, loadSettings, saveSettings, listSessions, getSession, createSession, updateSession, deleteSession } from './db/index.js';

const app = express();
const port = process.env.PORT || 3101;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const mcpManager = new MCPManager();
let settings = {};
let currentMockupHtml = '';

async function start() {
  const db = await initDb();
  settings = await loadSettings();

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
  const { prompt, thread } = req.body;
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
      mockupHtml: currentMockupHtml,
      settings,
      mcpTools: mcpToolDefs,
      mcpClient: {
        tools: mcpManager.tools,
        callTool: (name, args) => mcpManager.callTool(name, args),
      },
      onEvent: (event) => {
        if (event.type === 'html_updated') {
          currentMockupHtml = event.html;
        }
        res.write(JSON.stringify(event) + '\n');
      },
    });

    if (result.error) {
      res.write(JSON.stringify({ type: 'error', error: result.error }) + '\n');
    }

    if (!result.events.some(e => e.type === 'done')) {
      res.write(JSON.stringify({ type: 'done', finalHtml: currentMockupHtml }) + '\n');
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
    await deleteSession(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/reset', (req, res) => {
  currentMockupHtml = '';
  res.json({ ok: true, message: 'Mockup reset' });
});

app.put('/api/mockup', (req, res) => {
  const { html } = req.body;
  currentMockupHtml = html || '';
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', project: 'Core Mockup' });
});

start();
