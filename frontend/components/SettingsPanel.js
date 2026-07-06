import { useState, useEffect } from 'react';

const PROVIDERS = [
  { value: 'mock', label: 'Mock (no API key needed)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'litellm', label: 'LiteLLM' },
];

function MCPRow({ server, index, onChange, onUpdate, onRemove }) {
  const transport = server.transport || 'stdio';
  return (
    <div style={{
      padding: 12,
      borderRadius: 10,
      background: '#f7f2fb',
      border: '1px solid #e6e1ea',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ flex: 1 }}>
          <input
            placeholder="Server name"
            value={server.name || ''}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          onClick={() => onRemove(index)}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            border: '1px solid #ffcdcd',
            background: '#fff0f0',
            color: '#af302f',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
          title="Remove server"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={() => onUpdate(index, { transport: 'stdio', url: undefined, command: server.command || '', args: server.args || [] })}
          style={{
            flex: 1,
            padding: '6px 0',
            borderRadius: 8,
            border: 'none',
            background: transport === 'stdio' ? '#6c5ce7' : '#e6e1ea',
            color: transport === 'stdio' ? '#fcf7ff' : '#605e66',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          stdio
        </button>
        <button
          onClick={() => onUpdate(index, { transport: 'sse', url: server.url || '', command: undefined, args: [] })}
          style={{
            flex: 1,
            padding: '6px 0',
            borderRadius: 8,
            border: 'none',
            background: transport === 'sse' ? '#6c5ce7' : '#e6e1ea',
            color: transport === 'sse' ? '#fcf7ff' : '#605e66',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          SSE (HTTP)
        </button>
      </div>
      {transport === 'stdio' ? (
        <>
          <input
            placeholder="Command (e.g. node, npx, python)"
            value={server.command || ''}
            onChange={(e) => onChange(index, 'command', e.target.value)}
            style={inputStyle}
          />
          <input
            placeholder="Args (comma-separated, e.g. server/index.js,--watch)"
            value={(server.args || []).join(',')}
            onChange={(e) => onChange(index, 'args', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            style={inputStyle}
          />
        </>
      ) : (
        <input
          placeholder="URL (e.g. http://localhost:8080/sse)"
          value={server.url || ''}
          onChange={(e) => onChange(index, 'url', e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 10,
  border: '1.5px solid #e6e1ea',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
  outline: 'none',
  color: '#333138',
  background: '#ffffff',
  transition: 'border-color 0.15s',
};

const labelStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  color: '#605e66',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

export default function SettingsPanel({ settings, onSave, mcpStatus }) {
  const [local, setLocal] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('llm');

  useEffect(() => { setLocal(settings); }, [settings]);

  const handleChange = (key, value) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const handleMcpChange = (index, key, value) => {
    setLocal(prev => {
      const servers = [...(prev.mcpServers || [])];
      servers[index] = { ...servers[index], [key]: value };
      return { ...prev, mcpServers: servers };
    });
  };

  const handleMcpUpdate = (index, updates) => {
    setLocal(prev => {
      const servers = [...(prev.mcpServers || [])];
      servers[index] = { ...servers[index], ...updates };
      return { ...prev, mcpServers: servers };
    });
  };

  const handleMcpRemove = (index) => {
    setLocal(prev => {
      const servers = [...(prev.mcpServers || [])];
      servers.splice(index, 1);
      return { ...prev, mcpServers: servers };
    });
  };

  const handleMcpAdd = () => {
    const servers = [...(local.mcpServers || []), { name: '', transport: 'stdio', command: '', args: [] }];
    handleChange('mcpServers', servers);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(local);
    } finally {
      setSaving(false);
    }
  };

  const st = (base) => ({
    ...base,
    ...inputStyle,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4, background: '#f7f2fb', borderRadius: 10, padding: 3 }}>
        <button
          onClick={() => setActiveTab('llm')}
          style={{
            flex: 1,
            padding: '7px 0',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'llm' ? '#ffffff' : 'transparent',
            color: activeTab === 'llm' ? '#5948d3' : '#605e66',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: activeTab === 'llm' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          LLM
        </button>
        <button
          onClick={() => setActiveTab('mcp')}
          style={{
            flex: 1,
            padding: '7px 0',
            borderRadius: 8,
            border: 'none',
            background: activeTab === 'mcp' ? '#ffffff' : 'transparent',
            color: activeTab === 'mcp' ? '#5948d3' : '#605e66',
            fontSize: '0.78rem',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: activeTab === 'mcp' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          MCP {mcpStatus ? `(${mcpStatus})` : ''}
        </button>
      </div>

      {activeTab === 'llm' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Provider</label>
            <select
              value={local.provider || 'mock'}
              onChange={(e) => handleChange('provider', e.target.value)}
              style={st()}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {local.provider === 'openai' && (
            <>
              <div>
                <label style={labelStyle}>API Key</label>
                <input type="password" value={local.openaiKey || ''} onChange={(e) => handleChange('openaiKey', e.target.value)} placeholder="sk-..." style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Base URL</label>
                <input value={local.openaiBaseUrl || ''} onChange={(e) => handleChange('openaiBaseUrl', e.target.value)} placeholder="https://api.openai.com/v1" style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={local.openaiModel || 'gpt-4o'} onChange={(e) => handleChange('openaiModel', e.target.value)} style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Reasoning Effort</label>
                <select value={local.reasoningEffort || 'medium'} onChange={(e) => handleChange('reasoningEffort', e.target.value)} style={st()}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </>
          )}

          {local.provider === 'anthropic' && (
            <>
              <div>
                <label style={labelStyle}>API Key</label>
                <input type="password" value={local.anthropicKey || ''} onChange={(e) => handleChange('anthropicKey', e.target.value)} placeholder="sk-ant-..." style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Base URL</label>
                <input value={local.anthropicBaseUrl || ''} onChange={(e) => handleChange('anthropicBaseUrl', e.target.value)} placeholder="https://api.anthropic.com" style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={local.anthropicModel || 'claude-sonnet-4-20250514'} onChange={(e) => handleChange('anthropicModel', e.target.value)} style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Thinking Budget (tokens)</label>
                <input type="number" value={local.thinkingBudget || 16000} onChange={(e) => handleChange('thinkingBudget', parseInt(e.target.value) || 0)} style={st()} />
              </div>
            </>
          )}

          {local.provider === 'litellm' && (
            <>
              <div>
                <label style={labelStyle}>LiteLLM URL</label>
                <input value={local.litellmUrl || 'http://localhost:4000'} onChange={(e) => handleChange('litellmUrl', e.target.value)} style={st()} />
              </div>
              <div>
                <label style={labelStyle}>Model</label>
                <input value={local.litellmModel || 'gpt-4o'} onChange={(e) => handleChange('litellmModel', e.target.value)} style={st()} />
              </div>
            </>
          )}

          <div>
            <label style={labelStyle}>System Prompt</label>
            <textarea value={local.systemPrompt || ''} onChange={(e) => handleChange('systemPrompt', e.target.value)} rows={3} style={{ ...st(), resize: 'vertical' }} />
          </div>
        </div>
      )}

      {activeTab === 'mcp' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: '0.78rem', color: '#605e66', lineHeight: 1.5 }}>
            Connect MCP servers to give the agent access to design system tools, component libraries, and more.
          </p>

          {(local.mcpServers || []).map((server, i) => (
            <MCPRow key={i} server={server} index={i} onChange={handleMcpChange} onUpdate={handleMcpUpdate} onRemove={handleMcpRemove} />
          ))}

          <button
            onClick={handleMcpAdd}
            style={{
              padding: '8px 16px',
              borderRadius: 10,
              border: '1.5px dashed #b4b0b9',
              background: 'transparent',
              color: '#605e66',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            + Add MCP Server
          </button>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: '10px 20px',
          borderRadius: 12,
          border: 'none',
          background: '#6c5ce7',
          color: '#fcf7ff',
          fontSize: '0.85rem',
          fontWeight: 600,
          cursor: saving ? 'default' : 'pointer',
          opacity: saving ? 0.6 : 1,
          transition: 'opacity 0.15s',
          marginTop: 4,
        }}
      >
        {saving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
