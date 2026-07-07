import { useState, useRef, useEffect } from 'react';

export default function PromptInput({ onSend, loading }) {
  const [value, setValue] = useState('');
  const textareaRef = useRef(null);

  useEffect(() => {
    if (!loading && textareaRef.current) textareaRef.current.focus();
  }, [loading]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your mockup..."
          rows={3}
          disabled={loading}
          style={{
            flex: 1,
            resize: 'none',
            padding: '10px 14px',
            borderRadius: 12,
            border: '1.5px solid #e6e1ea',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            lineHeight: 1.5,
            outline: 'none',
            color: '#333138',
            background: '#f7f2fb',
            transition: 'border-color 0.15s',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#6c5ce7'; }}
          onBlur={(e) => { e.target.style.borderColor = '#e6e1ea'; }}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 12,
            border: 'none',
            background: value.trim() && !loading ? '#6c5ce7' : '#e6e1ea',
            color: value.trim() && !loading ? '#fcf7ff' : '#b4b0b9',
            cursor: value.trim() && !loading ? 'pointer' : 'default',
            transition: 'all 0.15s',
            flexShrink: 0,
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" /><path d="M22 2L15 22l-4-9-9-4 20-7z" />
          </svg>
          <span>Send</span>
        </button>
      </div>
      <div style={{ fontSize: '0.75rem', color: '#7c7981', textAlign: 'right' }}>
        {loading ? 'Generating...' : 'Enter to send · Shift+Enter for new line'}
      </div>
    </div>
  );
}
