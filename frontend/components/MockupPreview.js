import { useRef, useEffect, useState, useCallback } from 'react';
import html2canvas from 'html2canvas';

export default function MockupPreview({ html }) {
  const iframeRef = useRef(null);
  const containerRef = useRef(null);
  const [capturing, setCapturing] = useState(false);

  useEffect(() => {
    if (!iframeRef.current || !html) return;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    iframeRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [html]);

  const handleScreenshot = useCallback(async () => {
    if (!html) return;
    setCapturing(true);
    try {
      const temp = document.createElement('div');
      temp.innerHTML = html;
      temp.style.position = 'fixed';
      temp.style.left = '-9999px';
      temp.style.top = '0';
      temp.style.width = '1280px';
      document.body.appendChild(temp);

      await new Promise(r => setTimeout(r, 500));

      const canvas = await html2canvas(temp, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        width: temp.scrollWidth,
        height: temp.scrollHeight,
        onclone: () => {},
      });

      document.body.removeChild(temp);

      const link = document.createElement('a');
      link.download = `mockup-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Screenshot failed:', err);
    } finally {
      setCapturing(false);
    }
  }, [html]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', background: '#f1ecf5' }}>
      {html ? (
        <>
          <iframe
            ref={iframeRef}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Mockup Preview"
            sandbox="allow-scripts allow-same-origin"
          />
          <button
            onClick={handleScreenshot}
            disabled={capturing}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 18px',
              borderRadius: 12,
              border: 'none',
              background: 'rgba(255,255,255,0.95)',
              color: '#333138',
              fontSize: '0.85rem',
              fontWeight: 500,
              boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
              cursor: capturing ? 'default' : 'pointer',
              opacity: capturing ? 0.6 : 1,
              transition: 'all 0.15s',
              zIndex: 10,
              backdropFilter: 'blur(8px)',
            }}
            title="Download screenshot"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="12" y1="18" x2="12" y2="12" />
              <line x1="9" y1="15" x2="12" y2="12" />
              <line x1="15" y1="15" x2="12" y2="12" />
            </svg>
            {capturing ? 'Capturing...' : 'Screenshot'}
          </button>
        </>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#7c7981',
          gap: 16,
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.4}>
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
          </svg>
          <p style={{ fontSize: '1.1rem', fontWeight: 500 }}>Mockup Preview</p>
          <p style={{ fontSize: '0.875rem', maxWidth: 280, textAlign: 'center' }}>
            Send a prompt to generate your mockup. The result will appear here.
          </p>
        </div>
      )}
    </div>
  );
}
