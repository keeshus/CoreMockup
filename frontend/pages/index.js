import { useState, useEffect, useCallback, useRef } from 'react';
import FloatingPanel from '../components/FloatingPanel';
import MockupPreview from '../components/MockupPreview';
import PromptInput from '../components/PromptInput';
import SettingsPanel from '../components/SettingsPanel';
import ChatView from '../components/ChatView';
import SessionsList from '../components/SessionsList';

export default function Home() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({ provider: 'mock', mcpServers: [] });
  const [panelMode, setPanelMode] = useState('sessions');
  const [error, setError] = useState('');
  const [thread, setThread] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState([]);
  const [streamingReasoning, setStreamingReasoning] = useState('');
  const [streamingCode, setStreamingCode] = useState('');
  const [streamingStatus, setStreamingStatus] = useState('');
  const abortRef = useRef(null);
  const [mcpStatus, setMcpStatus] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const currentSessionIdRef = useRef(null);

  useEffect(() => {
    fetch('/api/settings')
      .then(r => r.json())
      .then(s => {
        setSettings(s);
        const mcpCount = s.mcpToolCount || 0;
        setMcpStatus(mcpCount > 0 ? `${mcpCount}` : '0');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const autoSaveSession = useCallback(async (sid, data) => {
    if (!sid) return;
    try {
      await fetch(`/api/sessions/${sid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch {}
  }, []);

  const handleSend = useCallback(async (prompt) => {
    if (loading) return;
    if (abortRef.current) abortRef.current.abort();

    const userMsg = { role: 'user', text: prompt };
    setThread(prev => [...prev, userMsg]);
    setLoading(true);
    setError('');
    let reasoningText = '';
    let codeText = '';
    setStreaming(true);
    setStreamingText('');
    setStreamingToolCalls([]);
    setStreamingReasoning('');
    setStreamingCode('');
    setStreamingStatus('Starting...');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          thread: thread.map(m => {
            const entry = { role: m.role, content: m.text };
            const tcs = m.toolCalls?.map(tc => ({
              id: tc.id || `${tc.tool}-${Date.now()}`,
              name: tc.tool,
              arguments: tc.args,
            }));
            if (tcs?.length > 0) entry.tool_calls = tcs;
            return entry;
          }),
        }),
        signal: controller.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentToolCalls = [];
      let assistantText = '';
      let reasoningText = '';
      let finalHtml = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line);
            switch (event.type) {
              case 'text_chunk':
                assistantText += event.text;
                setStreamingText(assistantText);
                break;

              case 'text':
                if (!assistantText) {
                  assistantText = event.text;
                  setStreamingText(assistantText);
                }
                break;

              case 'code_start':
                codeText = '';
                setStreamingCode('');
                break;

              case 'code_chunk':
                codeText += (event.text || '');
                setStreamingCode(codeText);
                break;

              case 'status':
                setStreamingStatus(event.text || '');
                break;

              case 'reasoning':
                reasoningText += (event.text || '');
                setStreamingReasoning(reasoningText);
                break;

              case 'tool_call':
                currentToolCalls.push({
                  tool: event.tool,
                  args: event.args,
                  id: `${event.tool}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                });
                setStreamingToolCalls([...currentToolCalls]);
                break;

              case 'tool_result':
                const tc = currentToolCalls.find(t => t.tool === event.tool);
                if (tc) tc.result = event.result;
                setStreamingToolCalls([...currentToolCalls]);
                break;

              case 'html_updated':
                if (event.html) {
                  finalHtml = event.html;
                  setHtml(event.html);
                  autoSaveSession(currentSessionIdRef.current, { html: event.html });
                }
                break;

              case 'error':
                setError(event.error);
                break;

              case 'done':
                if (event.finalHtml) finalHtml = event.finalHtml;
                if (finalHtml) setHtml(finalHtml);
                break;
            }
          } catch {
            // skip malformed lines
          }
        }
      }

      if (finalHtml) setHtml(finalHtml);

      const assistantMsg = {
        role: 'assistant',
        text: assistantText,
        toolCalls: currentToolCalls,
        reasoning: reasoningText,
        code: codeText,
      };
      setThread(prev => [...prev, assistantMsg]);

      const fullThread = [...thread, userMsg, assistantMsg];
      autoSaveSession(currentSessionIdRef.current, { thread: fullThread, html: finalHtml || html });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      setStreaming(false);
      setStreamingText('');
      setStreamingToolCalls([]);
      setStreamingReasoning('');
      setStreamingCode('');
      abortRef.current = null;
    }
  }, [thread, loading, html, autoSaveSession]);

  const handleSaveSettings = useCallback(async (newSettings) => {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSettings),
    });
    const data = await res.json();
    setSettings(data);
    const mcpCount = data.mcpToolCount || 0;
    setMcpStatus(mcpCount > 0 ? `${mcpCount}` : '0');
  }, []);

  const handleLoadSession = useCallback((session) => {
    setThread(session.thread || []);
    setHtml(session.html || '');
    setCurrentSessionId(session.id);
    currentSessionIdRef.current = session.id;
    setPanelMode('chat');
  }, []);

  const handleNewSession = useCallback(async (name) => {
    await fetch('/api/reset', { method: 'POST' }).catch(() => {});
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name || 'Untitled',
          thread: [],
          html: '',
        }),
      });
      const session = await res.json();
      setCurrentSessionId(session.id);
      currentSessionIdRef.current = session.id;
    } catch {}
    setThread([]);
    setHtml('');
    setError('');
    setPanelMode('chat');
  }, []);

  const handleFork = useCallback(async (name, html, msgIndex) => {
    const forkedThread = thread.slice(0, msgIndex + 1);
    await fetch('/api/reset', { method: 'POST' }).catch(() => {});
    await fetch('/api/mockup', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: html || '' }),
    }).catch(() => {});
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, thread: forkedThread, html: html || '' }),
      });
      const session = await res.json();
      setThread(forkedThread);
      setHtml(html || '');
      setCurrentSessionId(session.id);
      currentSessionIdRef.current = session.id;
    } catch {}
  }, [thread]);

  const handleReset = useCallback(async () => {
    await fetch('/api/reset', { method: 'POST' }).catch(() => {});
    setThread([]);
    setHtml('');
    setError('');
    setCurrentSessionId(null);
    currentSessionIdRef.current = null;
    setPanelMode('sessions');
  }, []);

  const panelTitle = panelMode === 'sessions' ? 'Sessions' : panelMode === 'settings' ? 'Settings' : 'Agent Chat';

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MockupPreview html={html} />
      </div>

      <FloatingPanel
        title={panelTitle}
        showSettings={panelMode === 'settings'}
        onToggleSettings={() => setPanelMode(m => m === 'settings' ? (currentSessionId ? 'chat' : 'sessions') : 'settings')}
        onToggleSessions={() => setPanelMode('sessions')}
      >
        {panelMode === 'settings' ? (
          <SettingsPanel settings={settings} onSave={handleSaveSettings} mcpStatus={mcpStatus} />
        ) : panelMode === 'sessions' ? (
          <SessionsList onLoadSession={handleLoadSession} onNew={handleNewSession} />
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
            {currentSessionId && (
              <div style={{ fontSize: '0.75rem', color: '#7c7981', flexShrink: 0 }}>
                Session #{currentSessionId}
              </div>
            )}
            <ChatView
              thread={thread}
              streaming={streaming}
              streamingText={streamingText}
              streamingToolCalls={streamingToolCalls}
              streamingReasoning={streamingReasoning}
              streamingStatus={streamingStatus}
              streamingCode={streamingCode}
              onFork={handleFork}
            />

            {error && (
              <div style={{
                padding: '8px 12px',
                borderRadius: 10,
                background: '#fff0f0',
                color: '#af302f',
                fontSize: '0.8rem',
                border: '1px solid #ffcdcd',
              }}>
                {error}
              </div>
            )}

            {loading ? (
              <button
                onClick={() => { if (abortRef.current) abortRef.current.abort(); }}
                style={{
                  width: '100%',
                  padding: '10px 20px',
                  borderRadius: 12,
                  border: 'none',
                  background: '#af302f',
                  color: '#fff',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                Stop Generating
              </button>
            ) : (
              <PromptInput onSend={handleSend} loading={loading} />
            )}
          </div>
        )}
      </FloatingPanel>
    </div>
  );
}