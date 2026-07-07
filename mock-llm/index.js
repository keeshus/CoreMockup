import http from 'http';

const PORT = parseInt(process.env.PORT || '3099');

function generateMockHtml(prompt) {
  const p = prompt.toLowerCase();

  const colors = {
    red: '#e74c3c', blue: '#3498db', green: '#2ecc71', purple: '#9b59b6',
    orange: '#f39c12', pink: '#e91e63', teal: '#1abc9c', yellow: '#f1c40f',
    black: '#2c3e50', white: '#ffffff', gray: '#95a5a6',
  };

  let primary = '#6c5ce7';
  let bg = '#fdf8ff';
  let layout = 'card';

  for (const [key, val] of Object.entries(colors)) {
    if (p.includes(key)) { primary = val; break; }
  }

  if (p.includes('dark')) { bg = '#1a1a2e'; primary = '#e94560'; }
  if (p.includes('card')) layout = 'card';
  if (p.includes('hero')) layout = 'hero';
  if (p.includes('form')) layout = 'form';
  if (p.includes('landing')) layout = 'landing';

  const sections = {
    card: `<div class="card"><h1>Mockup</h1><p>Generated from your prompt.</p><span class="badge">Mock Mode</span></div>`,
    hero: `<section class="hero"><h1>Mockup</h1><p>Generated from your prompt.</p><button class="btn">Get Started</button></section>`,
    form: `<form class="form"><h1>Mockup</h1><input placeholder="Name"><input placeholder="Email" type="email"><button class="btn">Submit</button></form>`,
    landing: `<nav class="nav"><span class="logo">Logo</span><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav><section class="hero"><h1>Mockup</h1><p>Generated from your prompt.</p><button class="btn">Get Started</button></section><footer>&copy; 2026</footer>`,
  };

  const content = sections[layout] || sections.card;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Mockup</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${bg};color:#333;min-height:100vh;padding:2rem;display:flex;align-items:flex-start;justify-content:center}.card{background:white;border-radius:24px;padding:3rem;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;text-align:center}.hero{text-align:center;max-width:700px;padding:4rem 2rem}.form{background:white;border-radius:24px;padding:3rem;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:450px;width:100%;display:flex;flex-direction:column;gap:12px}.nav{display:flex;align-items:center;gap:20px;padding:1rem 2rem;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:2rem;width:100%}.nav .logo{font-weight:700;font-size:1.2rem;margin-right:auto}.nav a{color:#666;text-decoration:none;font-size:.9rem}footer{text-align:center;color:#999;font-size:.8rem;padding:2rem;margin-top:auto}h1{font-size:2rem;margin-bottom:1rem;color:${primary}}p{line-height:1.6;color:#666;margin-bottom:1rem;font-size:1rem}.badge{display:inline-block;background:${primary};color:white;padding:.4rem 1rem;border-radius:100px;font-size:.875rem;margin-top:1rem}.btn{display:inline-block;background:${primary};color:white;border:none;padding:.75rem 2rem;border-radius:12px;font-size:1rem;cursor:pointer;transition:opacity .15s}.btn:hover{opacity:.85}input{padding:10px 14px;border-radius:10px;border:1.5px solid #e6e1ea;font-size:.9rem;font-family:inherit;outline:none}input:focus{border-color:${primary}}</style></head><body>${content}</body></html>`;
}

function extractPrompt(messages) {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === 'user') {
      if (typeof m.content === 'string') return m.content;
      if (Array.isArray(m.content)) {
        const text = m.content.find(c => c.type === 'text');
        if (text) return text.text;
      }
    }
  }
  return '';
}

function lastMessageIsToolResult(messages) {
  const last = messages[messages.length - 1];
  return last?.role === 'tool';
}

function generateId() {
  return 'chatcmpl-mock_' + Math.random().toString(36).slice(2, 10);
}

function sendSSE(res, data) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function sendStreamChunk(res, id, created, delta, finishReason) {
  const chunk = {
    id,
    object: 'chat.completion.chunk',
    created,
    model: 'mock-llm',
    choices: [{ index: 0, delta, finish_reason: finishReason || null }],
  };
  sendSSE(res, chunk);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function streamToolCallResponse(res, id, created, toolName, args, delay) {
  sendStreamChunk(res, id, created, { role: 'assistant', content: null });
  await sleep(delay);

  const argsStr = JSON.stringify(args);
  const toolCallId = 'call_' + Math.random().toString(36).slice(2, 10);

  const firstDelta = {
    tool_calls: [{
      index: 0,
      id: toolCallId,
      type: 'function',
      function: { name: toolName, arguments: '' },
    }],
  };
  sendStreamChunk(res, id, created, firstDelta);
  await sleep(delay);

  for (let i = 0; i < argsStr.length; i += 5) {
    const partial = argsStr.slice(i, i + 5);
    sendStreamChunk(res, id, created, {
      tool_calls: [{ index: 0, function: { arguments: partial } }],
    });
    await sleep(Math.min(delay, 10));
  }

  sendStreamChunk(res, id, created, {}, 'tool_calls');
  sendSSE(res, '[DONE]');
}

async function streamTextResponse(res, id, created, text, delay) {
  sendStreamChunk(res, id, created, { role: 'assistant', content: '' });
  await sleep(delay);

  for (let i = 0; i < text.length; i += 3) {
    sendStreamChunk(res, id, created, { content: text.slice(i, i + 3) });
    await sleep(Math.min(delay, 8));
  }

  sendStreamChunk(res, id, created, {}, 'stop');
  sendSSE(res, '[DONE]');
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'mock-llm' }));
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        const messages = params.messages || [];
        const stream = params.stream !== false;
        const delay = parseInt(params.mock_delay || '20');

        const prompt = extractPrompt(messages);
        const isToolResult = lastMessageIsToolResult(messages);

        const id = generateId();
        const created = Math.floor(Date.now() / 1000);

        const respondMsg = 'Mock mockup generated. What would you like to change?';

        if (stream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'Access-Control-Allow-Origin': '*',
          });

          if (isToolResult) {
            await streamTextResponse(res, id, created, respondMsg, delay);
          } else {
            const html = generateMockHtml(prompt);
            await streamToolCallResponse(res, id, created, 'write_mockup', {
              html,
              explanation: 'Generated mockup based on your request.',
            }, delay);
          }

          res.end();
        } else {
          if (isToolResult) {
            const resp = {
              id,
              object: 'chat.completion',
              created,
              model: 'mock-llm',
              choices: [{
                index: 0,
                message: { role: 'assistant', content: respondMsg },
                finish_reason: 'stop',
              }],
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resp));
          } else {
            const html = generateMockHtml(prompt);
            const resp = {
              id,
              object: 'chat.completion',
              created,
              model: 'mock-llm',
              choices: [{
                index: 0,
                message: {
                  role: 'assistant',
                  content: null,
                  tool_calls: [{
                    id: 'call_' + Math.random().toString(36).slice(2, 10),
                    type: 'function',
                    function: {
                      name: 'write_mockup',
                      arguments: JSON.stringify({ html, explanation: 'Generated mockup based on your request.' }),
                    },
                  }],
                },
                finish_reason: 'tool_calls',
              }],
            };
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(resp));
          }
        }
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: { message: err.message, type: 'invalid_request_error' } }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Mock LLM listening on http://localhost:${PORT}`);
});
