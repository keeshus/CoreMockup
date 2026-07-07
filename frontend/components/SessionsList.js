import { useState, useEffect, useCallback, useRef } from 'react';

export default function SessionsList({ onLoadSession, onNew }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sessions');
      const list = await res.json();
      setSessions(list);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleDelete = async (id) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      await fetchSessions();
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const openSession = async (session) => {
    const res = await fetch(`/api/sessions/${session.id}`);
    const full = await res.json();
    onLoadSession(full);
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onNew(trimmed);
    setName('');
    setCreating(false);
  };

  const formatDate = (d) => {
    const date = new Date(d);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      {creating ? (
        <div style={{
          padding: 12,
          borderRadius: 10,
          background: '#f7f2fb',
          border: '1px solid #e6e1ea',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          <input
            ref={inputRef}
            placeholder="Session name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setCreating(false); setName(''); } }}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 8,
              border: '1.5px solid #e6e1ea',
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              outline: 'none',
              color: '#333138',
              background: '#ffffff',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleCreate}
              disabled={!name.trim()}
              style={{
                flex: 1,
                padding: '7px 12px',
                borderRadius: 8,
                border: 'none',
                background: name.trim() ? '#6c5ce7' : '#e6e1ea',
                color: name.trim() ? '#fcf7ff' : '#b4b0b9',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: name.trim() ? 'pointer' : 'default',
              }}
            >
              Create
            </button>
            <button
              onClick={() => { setCreating(false); setName(''); }}
              style={{
                padding: '7px 12px',
                borderRadius: 8,
                border: '1px solid #e6e1ea',
                background: 'transparent',
                color: '#605e66',
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setCreating(true)}
          style={{
            width: '100%',
            padding: '10px 16px',
            borderRadius: 10,
            border: 'none',
            background: '#6c5ce7',
            color: '#fcf7ff',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Session
        </button>
      )}

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loading && sessions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7c7981', fontSize: '0.82rem', padding: 20 }}>
            Loading...
          </div>
        )}

        {!loading && sessions.length === 0 && (
          <div style={{ textAlign: 'center', color: '#7c7981', fontSize: '0.82rem', padding: 20 }}>
            No saved sessions yet.
          </div>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              background: '#f7f2fb',
              border: '1px solid #e6e1ea',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'background 0.1s',
            }}
            onClick={() => openSession(s)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#333138', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {s.name}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#7c7981', marginTop: 2 }}>
                {formatDate(s.updatedAt)}
              </div>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}
              style={{
                padding: '5px 8px',
                borderRadius: 6,
                border: 'none',
                background: 'transparent',
                color: '#b4b0b9',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                flexShrink: 0,
                fontSize: '0.72rem',
              }}
              title="Delete session"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}