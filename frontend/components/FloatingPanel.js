import { useState, useCallback, useRef } from 'react';

const PANEL_WIDTH = 420;
const MIN_Y = 0;
const MAX_Y = 240;

export default function FloatingPanel({ children, title, onToggleSettings, showSettings, onToggleSessions }) {
  const [position, setPosition] = useState({ x: 24, y: 60 });
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const onMouseDown = useCallback((e) => {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y };
  }, [position]);

  const onMouseMove = useCallback((e) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPosition({
      x: Math.max(0, dragRef.current.startPosX + dx),
      y: Math.max(MIN_Y, Math.min(MAX_Y, dragRef.current.startPosY + dy)),
    });
  }, [dragging]);

  const onMouseUp = useCallback(() => setDragging(false), []);

  return (
    <>
      <div
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: dragging ? 'auto' : 'none', zIndex: 999 }}
      >
        {!hidden && (
          <div
            style={{
              position: 'fixed',
              left: position.x,
              top: position.y,
              width: PANEL_WIDTH,
              height: 'calc(100vh - 120px)',
              background: '#ffffff',
              borderRadius: 20,
              boxShadow: '0 8px 40px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              pointerEvents: 'auto',
              cursor: dragging ? 'grabbing' : undefined,
            }}
          >
            <div
              onMouseDown={onMouseDown}
              style={{
                padding: '16px 20px',
                background: '#6c5ce7',
                color: '#fcf7ff',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'grab',
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                borderRadius: '20px 20px 0 0',
                flexShrink: 0,
                letterSpacing: '0.01em',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
              {title}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 2, alignItems: 'center' }}>
                {onToggleSessions && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={onToggleSessions}
                    style={{ background: 'none', border: 'none', color: '#fcf7ff', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, opacity: 0.8, fontSize: '0.75rem' }}
                    title="Sessions"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                    <span>Sessions</span>
                  </button>
                )}
                {onToggleSettings && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={onToggleSettings}
                    style={{ background: 'none', border: 'none', color: '#fcf7ff', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, opacity: 0.8, fontSize: '0.75rem' }}
                    title="Settings"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                    <span>Settings</span>
                  </button>
                )}
                <button
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={() => setHidden(true)}
                  style={{ background: 'none', border: 'none', color: '#fcf7ff', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, opacity: 0.8, fontSize: '0.75rem' }}
                  title="Hide panel"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  <span>Close</span>
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
              {children}
            </div>
          </div>
        )}
      </div>

      {hidden && (
        <button
          onClick={() => setHidden(false)}
          style={{
            position: 'fixed',
            left: 20,
            top: 80,
            padding: '10px 16px',
            borderRadius: 14,
            border: 'none',
            background: '#6c5ce7',
            color: '#fcf7ff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 1000,
            fontSize: '0.85rem',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
          title="Show panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <span>Chat</span>
        </button>
      )}
    </>
  );
}
