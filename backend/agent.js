import { createMockupStore } from './mockup-store.js';
import { validateHtml } from './validate.js';
import { generateMockData } from './mockdata.js';
import { inspectPage } from './inspect.js';
import { listImages, grabImage } from './images.js';

const BUILTIN_TOOLS = [
  {
    name: 'read_mockup',
    description: 'Read the current mockup HTML code. Use this to see the existing code before making changes.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'search_code',
    description: 'Search the current mockup HTML for a string or pattern. Returns matching lines with surrounding context. Use this to find specific sections to edit.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'The text to search for (case-insensitive)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'edit_mockup',
    description: 'Replace one or more lines in the mockup by line number. This is the PREFERRED tool for most changes: use it whenever the change affects roughly half of the file or less. Use read_mockup first to see line numbers.',
    inputSchema: {
      type: 'object',
      properties: {
        start_line: { type: 'number', description: 'The starting line number to replace (1-indexed, inclusive)' },
        end_line: { type: 'number', description: 'The ending line number to replace (1-indexed, inclusive)' },
        new_content: { type: 'string', description: 'The replacement content (can span multiple lines)' },
        explanation: { type: 'string', description: 'Brief summary of what was changed' },
      },
      required: ['start_line', 'end_line', 'new_content'],
    },
  },
  {
    name: 'write_mockup',
    description: 'Replace the ENTIRE mockup with new HTML code. Use ONLY for complete redesigns that affect most of the file. For any localized change, use edit_mockup instead. Always provide the COMPLETE file.',
    inputSchema: {
      type: 'object',
      properties: {
        html: { type: 'string', description: 'The complete HTML code for the mockup' },
        explanation: { type: 'string', description: 'Brief summary of what was changed and why' },
      },
      required: ['html'],
    },
  },
  {
    name: 'undo_mockup',
    description: 'Restore the mockup to the version before the most recent edit_mockup or write_mockup call. Use this when a change made things worse and you want to backtrack.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'fetch_url',
    description: 'Fetch a web page and return its readable text content (title, headings, paragraphs, links). Use this when the user asks you to create a mockup "like" an existing site or page so you can replicate its structure, layout, and content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to fetch (http or https only)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'inspect_page',
    description: 'Analyze how a web page LOOKS: its color palette, fonts, sizes, border radius, shadows, breakpoints, layout structure, and components. Use this when the user wants a mockup that visually resembles a site (e.g. "make it look like example.com"). Combine with fetch_url to also get the page content.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The URL to inspect (http or https only)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_images',
    description: 'List the images used on a web page (logos, hero images, icons, photos) with their URLs, classified by role. Use this when building a mockup that reuses a site\'s actual images, e.g. its logo.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The page URL whose images to list (http or https only)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'grab_image',
    description: 'Fetch an image and cache it, returning a short URL (http://localhost:3101/api/images/<id>) that you embed directly in the mockup as <img src="...">. Images are cached on the server per session and cleaned up when the session is deleted, so never convert them to base64 yourself. Use this for logos, photos and icons from a reference site.',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'The image URL to embed (http or https only)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'validate_html',
    description: 'Check the current mockup for HTML errors: unclosed tags, duplicate ids, missing title, empty body. Call this before finishing a turn to catch problems the user would see in the preview.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'mock_data',
    description: 'Generate realistic placeholder data to fill mockups: users, products, chart series, paragraphs, or avatar images (returned as short URLs you can put directly in an <img src> tag). Use this so mockups look real instead of showing lorem ipsum everywhere.',
    inputSchema: {
      type: 'object',
      properties: {
        dataset: { type: 'string', enum: ['users', 'products', 'chart_series', 'paragraphs', 'avatars'], description: 'Which dataset to generate' },
        count: { type: 'number', description: 'How many items to generate (default 5, max 20)' },
      },
      required: ['dataset'],
    },
  },
  {
    name: 'check_console',
    description: 'Return JavaScript errors and warnings captured from the live preview of the mockup. Use this when the mockup contains scripts or the preview appears broken.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'respond',
    description: 'Call this at the END of every turn to provide your structured response. Never return plain text — always use this tool.',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Your message to the user explaining what you did' },
        action: { type: 'string', enum: ['updated', 'read', 'error', 'done'], description: 'What action was taken' },
      },
      required: ['message', 'action'],
    },
  },
];

export function getBuiltinTools() { return BUILTIN_TOOLS; }
export function getAllTools(mcpTools = []) { return [...BUILTIN_TOOLS, ...mcpTools]; }

function extractText(response, provider) {
  if (provider === 'anthropic') {
    return (response.content || []).filter(c => c.type === 'text').map(t => t.text).join('\n');
  }
  return response.choices?.[0]?.message?.content || '';
}

function formatToolsForOpenAI(tools) {
  return tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
}
function formatToolsForAnthropic(tools) {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.inputSchema }));
}

function extractToolCalls(response, provider) {
  if (provider === 'anthropic') {
    if (!response.content) return [];
    return response.content.filter(c => c.type === 'tool_use').map(b => ({ id: b.id, name: b.name, arguments: b.input ?? null }));
  }
  const msg = response.choices[0]?.message;
  if (!msg?.tool_calls) return [];
  return msg.tool_calls.map(tc => {
    let args = null;
    try { args = JSON.parse(tc.function.arguments); } catch {}
    return { id: tc.id, name: tc.function.name, arguments: args };
  });
}

async function callOpenAI(messages, tools, settings, onStream) {
  const { default: OpenAI } = await import('openai');
  const openai = new OpenAI({
    apiKey: settings.openaiKey,
    ...(settings.openaiBaseUrl ? { baseURL: settings.openaiBaseUrl } : {}),
  });
  const body = {
    model: settings.openaiModel,
    messages,
    tools: tools.length > 0 ? formatToolsForOpenAI(tools) : undefined,
    tool_choice: 'auto',
    stream: true,
  };
  if (/^(o[1-9]|o3|o4|gpt-5)/i.test(settings.openaiModel)) body.max_completion_tokens = 64000;
  else body.max_tokens = 64000;
  if (settings.reasoningEffort && ['low', 'medium', 'high'].includes(settings.reasoningEffort)) body.reasoning_effort = settings.reasoningEffort;
  const res = await openai.chat.completions.create(body);
  const fullResponse = { choices: [{ message: { content: '', tool_calls: [] } }] };
  const toolCallMap = {};
  for await (const chunk of res) {
    const delta = chunk.choices?.[0]?.delta;
    if (chunk.choices?.[0]?.finish_reason === 'length') fullResponse._truncated = true;
    if (!delta) continue;
    if (delta.reasoning_content && onStream) onStream({ type: 'reasoning', text: delta.reasoning_content });
    if (delta.content) {
      fullResponse.choices[0].message.content += delta.content;
      if (onStream) onStream({ type: 'text_chunk', text: delta.content });
    }
    if (delta.tool_calls) {
      for (const tc of delta.tool_calls) {
        if (!toolCallMap[tc.index]) {
          toolCallMap[tc.index] = { id: tc.id, function: { name: '', arguments: '' } };
        }
        if (tc.id) toolCallMap[tc.index].id = tc.id;
        if (tc.function?.name) {
          const prev = toolCallMap[tc.index].function.name;
          toolCallMap[tc.index].function.name += tc.function.name;
          if (!prev && tc.function.name === 'write_mockup' && onStream) {
            onStream({ type: 'code_start' });
          }
        }
        if (tc.function?.arguments) {
          toolCallMap[tc.index].function.arguments += tc.function.arguments;
          const name = toolCallMap[tc.index].function.name;
          if (name === 'write_mockup' && onStream) {
            onStream({ type: 'code_chunk', text: tc.function.arguments });
          }
        }
      }
    }
  }
  fullResponse.choices[0].message.tool_calls = Object.values(toolCallMap).filter(t => t.function.name);
  return fullResponse;
}

async function callAnthropic(messages, tools, settings, onStream) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const anthropic = new Anthropic({
    apiKey: settings.anthropicKey,
    ...(settings.anthropicBaseUrl ? { baseURL: settings.anthropicBaseUrl } : {}),
  });
  const systemMsg = messages.find(m => m.role === 'system');
  const userMessages = messages.filter(m => m.role !== 'system').map(m => {
    if (m.role === 'assistant' && m.tool_calls?.length > 0) {
      return {
        role: 'assistant',
        content: [
          ...(m.content ? [{ type: 'text', text: m.content }] : []),
          ...m.tool_calls.map(tc => {
            let name, input;
            if (tc.function) { name = tc.function.name; try { input = JSON.parse(tc.function.arguments || '{}'); } catch { input = {}; } }
            else { name = tc.name; input = typeof tc.arguments === 'string' ? (() => { try { return JSON.parse(tc.arguments); } catch { return {}; } })() : (tc.arguments || {}); }
            return { type: 'tool_use', id: tc.id, name, input };
          }),
        ],
      };
    }
    if (m.role === 'tool') {
      let inner = m.content;
      if (typeof inner === 'string') { try { const p = JSON.parse(inner); inner = p; } catch {} }
      if (typeof inner === 'string') inner = [{ type: 'text', text: inner }];
      if (!Array.isArray(inner)) inner = [{ type: 'text', text: JSON.stringify(inner) }];
      return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: inner }] };
    }
    if (m.role === 'user' && typeof m.content === 'string') return { role: 'user', content: m.content };
    if (m.role === 'assistant' && typeof m.content === 'string') return { role: 'assistant', content: [{ type: 'text', text: m.content }] };
    return m;
  });
  const body = {
    model: settings.anthropicModel,
    system: systemMsg?.content || 'You are a UI expert.',
    messages: userMessages,
    tools: tools.length > 0 ? formatToolsForAnthropic(tools) : undefined,
    max_tokens: 64000,
    stream: true,
  };
  if (settings.thinkingBudget && parseInt(settings.thinkingBudget) > 0) body.thinking = { type: 'enabled', budget_tokens: parseInt(settings.thinkingBudget) };
  const res = await anthropic.messages.create(body);
  const content = [];
  for await (const event of res) {
    if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') content._truncated = true;
    if (event.type === 'content_block_start' && event.content_block?.type === 'text' && onStream) onStream({ type: 'text_chunk', text: event.content_block.text });
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && onStream) onStream({ type: 'text_chunk', text: event.delta.text });
    if (event.type === 'content_block_delta' && event.delta?.type === 'thinking_delta' && onStream) onStream({ type: 'reasoning', text: event.delta.thinking });
    content.push(event);
  }
  const result = { content: [] };
  let currentBlock = null;
  for (const event of content) {
    if (event.type === 'content_block_start') currentBlock = { ...event.content_block, text: '', input: {} };
    if (event.type === 'content_block_delta' && currentBlock) {
      if (event.delta?.type === 'text_delta') currentBlock.text += event.delta.text;
      if (event.delta?.type === 'input_json_delta') currentBlock._inputDelta = (currentBlock._inputDelta || '') + event.delta.partial_json;
    }
    if (event.type === 'content_block_stop' && currentBlock) {
      if (currentBlock.type === 'tool_use' && currentBlock._inputDelta) {
        try { currentBlock.input = JSON.parse(currentBlock._inputDelta); }
        catch { currentBlock.input = content._truncated ? null : {}; }
      }
      result.content.push(currentBlock);
      currentBlock = null;
    }
  }
  if (content._truncated) result._truncated = true;
  return result;
}

export async function runAgent({ prompt, thread, mockupHtml, mockupStore, consoleLog, settings, mcpTools, mcpClient, onEvent, sessionId = null, imageCache = null }) {
  const events = [];
  const emit = (event) => { events.push(event); if (onEvent) onEvent(event); };

  emit({ type: 'status', text: 'Starting...' });

  const tools = getAllTools(mcpTools || []);
  const store = mockupStore || createMockupStore(mockupHtml || '');
  const getHtml = () => store.get();
  const messages = [];
  if (settings.systemPrompt) messages.push({ role: 'system', content: settings.systemPrompt });
  if (thread?.length > 0) { for (const msg of thread) messages.push({ role: msg.role, content: msg.content || '' }); }
  messages.push({ role: 'user', content: prompt });

  const provider = settings.provider || 'mock';

  async function llmCall() {
    if (provider === 'mock') return await callMock(messages, settings, emit);
    if (provider === 'openai') return await callOpenAI(messages, tools, settings, emit);
    if (provider === 'anthropic') return await callAnthropic(messages, tools, settings, emit);
    if (provider === 'litellm') return await callOpenAI(messages, tools, { ...settings, openaiKey: 'sk-lite', openaiBaseUrl: settings.litellmUrl, openaiModel: settings.litellmModel }, emit);
    throw new Error(`Unknown provider: ${provider}`);
  }

  let response;
  emit({ type: 'status', text: 'Contacting LLM...' });
  try {
    response = await llmCall();
  } catch (err) {
    console.error('[Agent] Error:', err.message);
    emit({ type: 'error', error: err.message });
    return { events, finalHtml: getHtml(), error: err.message };
  }

  for (let round = 0; ; round++) {
    const toolCalls = extractToolCalls(response, provider);
    const truncatedCall = toolCalls.find(tc => tc.arguments === null);
    const respondCall = toolCalls.find(tc => tc.name === 'respond');
    const otherCalls = toolCalls.filter(tc => tc.name !== 'respond');

    if (truncatedCall) {
      const msg = `The model's response was cut off mid-call (tool: ${truncatedCall.name}, token limit reached). The mockup is unchanged — try again, or ask for a smaller mockup.`;
      console.error('[Agent] Truncated response:', msg);
      emit({ type: 'error', error: msg });
      emit({ type: 'done', finalHtml: getHtml() });
      return { events, finalHtml: getHtml(), error: msg };
    }

    if (respondCall) {
      emit({ type: 'text', text: respondCall.arguments.message || '' });
      emit({ type: 'done', finalHtml: getHtml() });
      return { events, finalHtml: getHtml() };
    }

    if (otherCalls.length === 0) {
      const text = extractText(response, provider);
      if (text) emit({ type: 'text', text });
      emit({ type: 'done', finalHtml: getHtml() });
      return { events, finalHtml: getHtml() };
    }

    const text = extractText(response, provider);
    messages.push({
      role: 'assistant',
      content: text || null,
      tool_calls: otherCalls.map(tc => ({
        id: tc.id, type: 'function',
        function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
      })),
    });

    for (const tc of otherCalls) {
      emit({ type: 'tool_call', tool: tc.name, args: tc.arguments });
      let result;
      try {
        if (tc.name === 'read_mockup') {
          if (!getHtml()) result = 'No mockup exists yet. Use write_mockup to create one.';
          else {
            const lines = getHtml().split('\n');
            result = lines.map((l, i) => `${i + 1}: ${l}`).join('\n') + `\n\n(FILE: ${lines.length} lines)`;
          }
        } else if (tc.name === 'search_code') {
          const q = (tc.arguments.query || '').toLowerCase();
          if (!q) result = 'Please provide a search query.';
          else if (!getHtml()) result = 'No mockup to search.';
          else {
            const lines = getHtml().split('\n');
            const matches = [];
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].toLowerCase().includes(q)) {
                const start = Math.max(0, i - 1);
                const end = Math.min(lines.length, i + 2);
                const snippet = lines.slice(start, end).map((l, j) => `${start + j + 1}: ${l}`).join('\n');
                matches.push(`Line ${i + 1}:\n${snippet}`);
              }
            }
            result = matches.length > 0 ? matches.join('\n---\n') : `No matches found for "${tc.arguments.query}".`;
          }
        } else if (tc.name === 'edit_mockup') {
          if (!getHtml()) throw new Error('No mockup exists yet.');
          const { start_line, end_line, new_content } = tc.arguments;
          if (!start_line || !end_line) throw new Error('start_line and end_line are required');
          const lines = getHtml().split('\n');
          const start = Math.max(1, Math.min(lines.length, start_line)) - 1;
          const end = Math.max(start, Math.min(lines.length, end_line));
          const before = lines.slice(0, start).join('\n');
          const after = lines.slice(end).join('\n');
          store.set(before + (before && new_content ? '\n' : '') + (new_content || '') + (after && new_content ? '\n' : '') + after);
          emit({ type: 'html_updated', html: getHtml(), explanation: tc.arguments.explanation || '' });
          result = `Lines ${start_line}-${end_line} replaced. ${tc.arguments.explanation || ''}`;
        } else if (tc.name === 'write_mockup') {
          if (!tc.arguments.html) throw new Error('html is required');
          store.set(tc.arguments.html);
          emit({ type: 'html_updated', html: getHtml(), explanation: tc.arguments.explanation || '' });
          result = `Mockup replaced. ${tc.arguments.explanation || ''}`;
        } else if (tc.name === 'undo_mockup') {
          const previous = store.undo();
          if (previous === null) result = 'No previous version to restore. The mockup is unchanged.';
          else {
            emit({ type: 'html_updated', html: getHtml(), explanation: 'Restored previous version' });
            result = 'Restored the mockup to the previous version.';
          }
        } else if (tc.name === 'fetch_url') {
          result = await fetchUrl(tc.arguments.url || '');
        } else if (tc.name === 'inspect_page') {
          result = await inspectPage(tc.arguments.url || '');
        } else if (tc.name === 'list_images') {
          result = await listImages(tc.arguments.url || '');
        } else if (tc.name === 'grab_image') {
          result = await grabImage(tc.arguments.url || '', undefined, sessionId, imageCache);
        } else if (tc.name === 'validate_html') {
          const issues = validateHtml(getHtml());
          if (issues.length === 0) result = 'No HTML issues found. The mockup is valid.';
          else {
            const summary = issues.map(i => `[${i.severity}] ${i.message}`).join('\n');
            result = `${issues.length} issue(s) found:\n${summary}`;
          }
        } else if (tc.name === 'mock_data') {
          result = await generateMockData(tc.arguments.dataset || 'users', tc.arguments.count, sessionId, imageCache);
        } else if (tc.name === 'check_console') {
          result = formatConsoleLog(consoleLog);
        } else if (mcpClient && mcpClient.tools?.has(tc.name)) {
          result = await mcpClient.callTool(tc.name, tc.arguments);
        } else { result = `Tool ${tc.name} executed`; }
      } catch (err) { result = `Error: ${err.message}`; }
      emit({ type: 'tool_result', tool: tc.name, result });
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result });
    }

    emit({ type: 'status', text: `Processing (round ${round + 2})...` });
    try {
      response = await llmCall();
    } catch (err) {
      console.error('[Agent] Error:', err.message);
      emit({ type: 'error', error: err.message });
      return { events, finalHtml: getHtml(), error: err.message };
    }
  }
}

function generateMockHtml(prompt) {
  const p = prompt.toLowerCase();

  const colors = {
    red: '#e74c3c', blue: '#3498db', green: '#2ecc71', purple: '#9b59b6',
    orange: '#f39c12', pink: '#e91e63', teal: '#1abc9c', yellow: '#f1c40f',
    black: '#2c3e50', white: '#ffffff', gray: '#95a5a6',
  };

  let primary = '#6c5ce7';
  let bg = '#fdf8ff';
  let title = 'Mockup';
  let subtitle = 'Generated from your prompt.';
  let layout = 'center';

  for (const [key, val] of Object.entries(colors)) {
    if (p.includes(key)) { primary = val; break; }
  }

  if (p.includes('dark')) { bg = '#1a1a2e'; primary = '#e94560'; }
  if (p.includes('card')) layout = 'card';
  if (p.includes('hero')) layout = 'hero';
  if (p.includes('form')) layout = 'form';
  if (p.includes('landing')) layout = 'landing';

  const sections = {
    card: `<div class="card"><h1>${title}</h1><p>${subtitle}</p><span class="badge">Mock Mode</span></div>`,
    hero: `<section class="hero"><h1>${title}</h1><p>${subtitle}</p><button class="btn">Get Started</button></section>`,
    form: `<form class="form"><h1>${title}</h1><input placeholder="Name"><input placeholder="Email" type="email"><button class="btn">Submit</button></form>`,
    landing: `<nav class="nav"><span class="logo">Logo</span><a href="#">Home</a><a href="#">About</a><a href="#">Contact</a></nav><section class="hero"><h1>${title}</h1><p>${subtitle}</p><button class="btn">Get Started</button></section><footer>&copy; 2026</footer>`,
  };

  const content = sections[layout] || sections.card;

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Mockup</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:${bg};color:#333;min-height:100vh;padding:2rem;display:flex;align-items:flex-start;justify-content:center}.card{background:white;border-radius:24px;padding:3rem;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:600px;text-align:center}.hero{text-align:center;max-width:700px;padding:4rem 2rem}.form{background:white;border-radius:24px;padding:3rem;box-shadow:0 4px 24px rgba(0,0,0,.08);max-width:450px;width:100%;display:flex;flex-direction:column;gap:12px}.nav{display:flex;align-items:center;gap:20px;padding:1rem 2rem;background:white;border-radius:16px;box-shadow:0 2px 12px rgba(0,0,0,.06);margin-bottom:2rem;width:100%}.nav .logo{font-weight:700;font-size:1.2rem;margin-right:auto}.nav a{color:#666;text-decoration:none;font-size:.9rem}footer{text-align:center;color:#999;font-size:.8rem;padding:2rem;margin-top:auto}h1{font-size:2rem;margin-bottom:1rem;color:${primary}}p{line-height:1.6;color:#666;margin-bottom:1rem;font-size:1rem}.badge{display:inline-block;background:${primary};color:white;padding:.4rem 1rem;border-radius:100px;font-size:.875rem;margin-top:1rem}.btn{display:inline-block;background:${primary};color:white;border:none;padding:.75rem 2rem;border-radius:12px;font-size:1rem;cursor:pointer;transition:opacity .15s}.btn:hover{opacity:.85}input{padding:10px 14px;border-radius:10px;border:1.5px solid #e6e1ea;font-size:.9rem;font-family:inherit;outline:none}input:focus{border-color:${primary}}</style></head><body>${content}</body></html>`;
}

async function callMock(messages, settings, onStream) {
  const lastMsg = messages[messages.length - 1];

  if (lastMsg?.role === 'tool') {
    if (onStream) onStream({ type: 'text_chunk', text: 'Mock mockup generated. What would you like to change?' });
    return {
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'mock_respond',
            type: 'function',
            function: {
              name: 'respond',
              arguments: JSON.stringify({ message: 'Mock mockup generated. What would you like to change?', action: 'updated' }),
            },
          }],
        },
      }],
    };
  }

  if (lastMsg?.role === 'user') {
    const prompt = lastMsg.content || '';
    if (onStream) onStream({ type: 'reasoning', text: 'Analyzing your request and generating mockup...' });
    const html = generateMockHtml(prompt);
    if (onStream) {
      onStream({ type: 'text_chunk', text: 'Generating HTML mockup...' });
      onStream({ type: 'code_start' });
      onStream({ type: 'code_chunk', text: JSON.stringify({ html: html.substring(0, 200) }) });
    }
    return {
      choices: [{
        message: {
          content: null,
          tool_calls: [{
            id: 'mock_write',
            type: 'function',
            function: {
              name: 'write_mockup',
              arguments: JSON.stringify({ html, explanation: 'Generated mockup based on your request.' }),
            },
          }],
        },
      }],
    };
  }

  return {
    choices: [{
      message: {
        content: null,
        tool_calls: [{
          id: 'mock_respond',
          type: 'function',
          function: {
            name: 'respond',
            arguments: JSON.stringify({ message: 'Done.', action: 'done' }),
          },
        }],
      },
    }],
  };
}

const FETCH_MAX_CHARS = 30000;

export async function fetchUrl(url) {  if (!url) return 'Please provide a URL.';
  let parsed;
  try { parsed = new URL(url); } catch { return `Invalid URL: ${url}`; }
  if (!['http:', 'https:'].includes(parsed.protocol)) return `Unsupported protocol "${parsed.protocol}". Only http(s) URLs are supported.`;

  let res;
  try {
    res = await fetch(parsed.toString(), { redirect: 'follow', signal: AbortSignal.timeout(10000) });
  } catch (err) {
    return `Failed to fetch URL: ${err.message}`;
  }
  if (!res.ok) return `Request failed with status ${res.status} ${res.statusText}`;

  const contentType = res.headers.get('content-type') || '';
  let body;
  try { body = await res.text(); } catch (err) { return `Failed to read response: ${err.message}`; }

  if (contentType.includes('application/json')) {
    try {
      const pretty = JSON.stringify(JSON.parse(body), null, 2);
      return `JSON response (${body.length} bytes):\n${truncate(pretty, FETCH_MAX_CHARS)}`;
    } catch { return truncate(body, FETCH_MAX_CHARS); }
  }
  if (contentType.includes('html') || /<!doctype\s+html|<html[\s>]/i.test(body)) {
    return htmlToText(body);
  }
  return truncate(body, FETCH_MAX_CHARS);
}

function truncate(text, max) {
  return text.length > max ? text.slice(0, max) + `\n... [truncated, total ${text.length} chars]` : text;
}

function htmlToText(html) {
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : '';

  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();

  const links = [];
  const linkRegex = /<a[^>]+href="([^"]+)"/gi;
  let m;
  while ((m = linkRegex.exec(html)) && links.length < 20) links.push(m[1]);

  const parts = [];
  if (title) parts.push(`TITLE: ${title}`);
  parts.push(text);
  if (links.length > 0) parts.push(`LINKS:\n${links.join('\n')}`);
  return truncate(parts.join('\n\n'), FETCH_MAX_CHARS);
}

function formatConsoleLog(consoleLog) {
  const entries = consoleLog || [];
  if (entries.length === 0) return 'No console messages captured yet.';
  const lines = entries.map(e => {
    const loc = e.source ? ` (${e.source}${e.line ? `:${e.line}` : ''})` : '';
    return `[${e.type}] ${e.message}${loc}`;
  });
  return `Console log (${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}, oldest first):\n${lines.join('\n')}`;
}
