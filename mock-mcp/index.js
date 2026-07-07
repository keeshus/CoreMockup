import http from 'http';
import crypto from 'crypto';

const PORT = parseInt(process.env.PORT || '3098');

const MOCK_TOOLS = [
  {
    name: 'create_button',
    description: 'Create a button component with label and optional color',
    inputSchema: {
      type: 'object',
      properties: {
        label: { type: 'string', description: 'Button label text' },
        color: { type: 'string', description: 'Button color (hex or name)', default: '#6c5ce7' },
      },
      required: ['label'],
    },
  },
  {
    name: 'set_primary_color',
    description: 'Set the primary color for the mockup',
    inputSchema: {
      type: 'object',
      properties: {
        color: { type: 'string', description: 'Primary color (hex or name)' },
      },
      required: ['color'],
    },
  },
  {
    name: 'add_font',
    description: 'Add a Google Font to the mockup',
    inputSchema: {
      type: 'object',
      properties: {
        family: { type: 'string', description: 'Font family name' },
      },
      required: ['family'],
    },
  },
];

function executeTool(name, args) {
  switch (name) {
    case 'create_button': {
      const label = args?.label || 'Button';
      const color = args?.color || '#6c5ce7';
      return {
        content: [{
          type: 'text',
          text: `<button style="background:${color};color:white;border:none;padding:10px 20px;border-radius:8px;font-size:1rem;cursor:pointer">${label}</button>`,
        }],
      };
    }
    case 'set_primary_color': {
      const color = args?.color || '#6c5ce7';
      return {
        content: [{
          type: 'text',
          text: `--primary-color: ${color};`,
        }],
      };
    }
    case 'add_font': {
      const family = args?.family || 'Roboto';
      const encoded = family.replace(/\s+/g, '+');
      return {
        content: [{
          type: 'text',
          text: `<link href="https://fonts.googleapis.com/css2?family=${encoded}" rel="stylesheet">`,
        }],
      };
    }
    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

const sessions = new Map();

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendEvent(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function jsonRpcError(id, code, message) {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

function jsonRpcResult(id, result) {
  return { jsonrpc: '2.0', id, result };
}

function handleJsonRpc(sessionId, body) {
  const { id, method, params } = body;
  const session = sessions.get(sessionId);
  if (!session) return;

  switch (method) {
    case 'initialize': {
      const result = {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'mock-mcp', version: '1.0.0' },
      };
      session.write(`event: message\ndata: ${JSON.stringify(jsonRpcResult(id, result))}\n\n`);
      break;
    }

    case 'notifications/initialized': {
      // No response needed for notifications
      break;
    }

    case 'tools/list': {
      const result = { tools: MOCK_TOOLS };
      session.write(`event: message\ndata: ${JSON.stringify(jsonRpcResult(id, result))}\n\n`);
      break;
    }

    case 'tools/call': {
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};
      const output = executeTool(toolName, toolArgs);
      session.write(`event: message\ndata: ${JSON.stringify(jsonRpcResult(id, output))}\n\n`);
      break;
    }

    default:
      session.write(`event: message\ndata: ${JSON.stringify(jsonRpcError(id, -32601, `Method not found: ${method}`))}\n\n`);
  }
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mock-mcp' }));
    return;
  }

  if (req.method === 'GET' && req.url === '/sse') {
    const sessionId = crypto.randomBytes(16).toString('hex');

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    res.write(`event: endpoint\ndata: /messages?sessionId=${sessionId}\n\n`);

    sessions.set(sessionId, res);

    req.on('close', () => {
      sessions.delete(sessionId);
    });

    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/messages')) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId || !sessions.has(sessionId)) {
      res.writeHead(404);
      res.end('Session not found');
      return;
    }

    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const json = JSON.parse(body);
        handleJsonRpc(sessionId, json);
        res.writeHead(202);
        res.end('Accepted');
      } catch (err) {
        res.writeHead(400);
        res.end('Invalid JSON');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Mock MCP listening on http://localhost:${PORT}`);
});
