import { useRef, useEffect, useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function ToolCallBlock({ tool, args, result, autoExpand, onFork }) {
  const [expanded, setExpanded] = useState(autoExpand || false);
  const [forking, setForking] = useState(false);
  const [forkName, setForkName] = useState('');
  const forkInputRef = useRef(null);

  useEffect(() => {
    if (forking && forkInputRef.current) forkInputRef.current.focus();
  }, [forking]);

  const handleFork = () => {
    const trimmed = forkName.trim();
    if (!trimmed || !onFork) return;
    onFork(trimmed);
    setForkName('');
    setForking(false);
  };

  return (
    <div data-testid={`tool-call-${tool}`} style={{
      borderRadius: 10,
      background: '#f7f2fb',
      border: '1px solid #e6e1ea',
      overflow: 'hidden',
      fontSize: '0.78rem',
    }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${tool} tool call`}
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6c5ce7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7" />
        </svg>
        <span style={{ fontWeight: 600, color: '#5948d3' }}>{tool}</span>
        {tool === 'write_mockup' && args?.explanation && (
          <span style={{ color: '#605e66', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            — {args.explanation}
          </span>
        )}
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7c7981" strokeWidth="2"
          style={{ marginLeft: 'auto', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <div style={{ padding: '8px 12px 12px', borderTop: '1px solid #e6e1ea' }}>
          {args && (
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, color: '#605e66', marginBottom: 4, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Arguments
              </div>
              <pre style={{
                background: '#ffffff',
                borderRadius: 6,
                padding: 8,
                fontSize: '0.72rem',
                overflow: 'auto',
                maxHeight: 200,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                margin: 0,
              }}>
                {JSON.stringify(args, null, 2)}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <div style={{ fontWeight: 600, color: '#605e66', marginBottom: 4, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Result
              </div>
              <div style={{
                background: '#ffffff',
                borderRadius: 6,
                padding: 8,
                fontSize: '0.72rem',
                color: '#006c56',
              }}>
                {typeof result === 'string' ? result.slice(0, 500) : JSON.stringify(result).slice(0, 500)}
                {(typeof result === 'string' ? result : JSON.stringify(result)).length > 500 && '...'}
              </div>
            </div>
          )}
        </div>
      )}
      {tool === 'write_mockup' && onFork && (
        <div style={{ borderTop: '1px solid #e6e1ea', padding: '6px 12px' }}>
          {forking ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={forkInputRef}
                placeholder="Fork session name..."
                value={forkName}
                onChange={(e) => setForkName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleFork(); if (e.key === 'Escape') { setForking(false); setForkName(''); } }}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: 6,
                  border: '1.5px solid #e6e1ea',
                  fontSize: '0.75rem',
                  fontFamily: 'inherit',
                  outline: 'none',
                  color: '#333138',
                  background: '#ffffff',
                }}
              />
              <button
                data-testid="fork-confirm"
                onClick={handleFork}
                disabled={!forkName.trim()}
                style={{
                  padding: '6px 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: forkName.trim() ? '#6c5ce7' : '#e6e1ea',
                  color: forkName.trim() ? '#fcf7ff' : '#b4b0b9',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  cursor: forkName.trim() ? 'pointer' : 'default',
                }}
              >
                Fork
              </button>
              <button
                onClick={() => { setForking(false); setForkName(''); }}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: '1px solid #e6e1ea',
                  background: 'transparent',
                  color: '#605e66',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              data-testid="fork-btn"
              onClick={(e) => { e.stopPropagation(); setForking(true); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid #e0d4f5',
                background: '#f0ebf8',
                color: '#5948d3',
                fontSize: '0.72rem',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Fork
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const md = {
  p: ({ children }) => <p style={{ margin: '4px 0', lineHeight: 1.6 }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: 20 }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
  code: ({ inline, children }) =>
    inline ? (
      <code style={{
        background: '#e6e1ea',
        padding: '1px 5px',
        borderRadius: 4,
        fontSize: '0.78rem',
      }}>{children}</code>
    ) : (
      <pre style={{
        background: '#1e1e2e',
        color: '#cdd6f4',
        borderRadius: 8,
        padding: 12,
        overflow: 'auto',
        fontSize: '0.75rem',
        lineHeight: 1.5,
        margin: '8px 0',
      }}><code>{children}</code></pre>
    ),
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#6c5ce7' }}>{children}</a>
  ),
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  h1: ({ children }) => <h1 style={{ fontSize: '1.1rem', margin: '8px 0 4px' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontSize: '1rem', margin: '8px 0 4px' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: '0.9rem', margin: '8px 0 4px' }}>{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: '3px solid #6c5ce7',
      margin: '8px 0',
      padding: '4px 12px',
      color: '#605e66',
      background: '#f7f2fb',
      borderRadius: '0 8px 8px 0',
    }}>{children}</blockquote>
  ),
  table: ({ children }) => (
    <div style={{ overflow: 'auto', margin: '8px 0' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.78rem', width: '100%' }}>{children}</table>
    </div>
  ),
  th: ({ children }) => <th style={{ border: '1px solid #e6e1ea', padding: '6px 10px', background: '#f1ecf5', textAlign: 'left' }}>{children}</th>,
  td: ({ children }) => <td style={{ border: '1px solid #e6e1ea', padding: '6px 10px' }}>{children}</td>,
  hr: () => <hr style={{ border: 'none', borderTop: '1px solid #e6e1ea', margin: '12px 0' }} />,
};

function MarkdownContent({ text, role }) {
  if (role === 'user') {
    return <span>{text}</span>;
  }
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
      {text || ''}
    </ReactMarkdown>
  );
}

function CodeBlock({ code, streaming }) {
  const preRef = useRef(null);

  useEffect(() => {
    if (streaming && preRef.current) {
      preRef.current.scrollTop = preRef.current.scrollHeight;
    }
  }, [code, streaming]);

  return (
    <div style={{
      marginBottom: 6,
      borderRadius: 10,
      border: '1px solid #e6e1ea',
      overflow: 'hidden',
      fontSize: '0.75rem',
    }}>
      <div style={{
        padding: '6px 12px',
        background: '#f1ecf5',
        fontSize: '0.7rem',
        fontWeight: 600,
        color: '#605e66',
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}>
        Generated Code
      </div>
      <pre
        ref={preRef}
        data-testid="code-block"
        style={{
          margin: 0,
          padding: 12,
          background: '#1e1e2e',
          color: '#cdd6f4',
          overflow: 'auto',
          maxHeight: 300,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        <code>{code}</code>
      </pre>
    </div>
  );
}

function Message({ msg, onFork }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{
      padding: isUser ? '10px 14px' : 0,
      borderRadius: isUser ? 12 : 0,
      background: isUser ? '#6c5ce7' : 'transparent',
      color: isUser ? '#fcf7ff' : '#333138',
      fontSize: '0.82rem',
      lineHeight: 1.5,
      width: '100%',
      alignSelf: isUser ? 'flex-end' : 'stretch',
      borderBottomRightRadius: isUser ? 4 : 0,
      borderBottomLeftRadius: isUser ? 12 : 0,
    }}>
      {msg.reasoning && <ReasoningBlock text={msg.reasoning} />}
      {msg.code && <CodeBlock code={msg.code} />}
      {!isUser && msg.text && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: '#f7f2fb',
          borderBottomLeftRadius: 4,
          overflow: 'hidden',
        }}>
          <MarkdownContent text={msg.text} role={msg.role} />
        </div>
      )}
      {isUser && msg.text && <MarkdownContent text={msg.text} role={msg.role} />}
      {msg.toolCalls?.map((tc, i) => (
        <div key={i} style={{ marginTop: 6 }}>
          <ToolCallBlock tool={tc.tool} args={tc.args} result={tc.result} onFork={tc.tool === 'write_mockup' ? (name) => onFork?.(name, tc.args?.html) : undefined} />
        </div>
      ))}
    </div>
  );
}

function ReasoningBlock({ text, autoExpand }) {
  const [expanded, setExpanded] = useState(autoExpand || false);
  return (
    <div style={{
      borderRadius: 10,
      background: '#fff8e7',
      border: '1px solid #f0dca0',
      overflow: 'hidden',
      fontSize: '0.78rem',
      marginBottom: 8,
    }}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label="Reasoning"
        onClick={() => setExpanded(!expanded)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpanded(!expanded); }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8b6914" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" />
        </svg>
        <span style={{ fontWeight: 600, color: '#8b6914' }}>Reasoning</span>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#8b6914" strokeWidth="2"
          style={{ marginLeft: 'auto', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {expanded && (
        <div style={{
          padding: '8px 12px 12px',
          borderTop: '1px solid #f0dca0',
          fontSize: '0.75rem',
          color: '#8b6914',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}>
          {text}
        </div>
      )}
    </div>
  );
}

function StreamingMessage({ text, toolCalls, reasoning, status, code }) {
  const hasToolCalls = toolCalls?.length > 0;
  const hasReasoning = !!reasoning;
  const hasText = !!text;

  return (
    <div style={{
      padding: 0,
      borderRadius: 0,
      color: '#333138',
      fontSize: '0.82rem',
      lineHeight: 1.5,
      width: '100%',
      alignSelf: 'stretch',
    }}>
      {hasReasoning && <ReasoningBlock text={reasoning} autoExpand={!hasText && !hasToolCalls} />}

      {hasToolCalls && toolCalls.map((tc, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <ToolCallBlock tool={tc.tool} args={tc.args} result={tc.result} autoExpand={!hasText && i < 2} />
        </div>
      ))}

      {code && <CodeBlock code={code} streaming />}

      {!hasText && !hasToolCalls && !hasReasoning && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: '#f7f2fb',
          borderBottomLeftRadius: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: '0.82rem',
          color: '#605e66',
        }}>
          <div style={{ display: 'flex', gap: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6c5ce7', animation: 'bounce 1.2s infinite' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6c5ce7', animation: 'bounce 1.2s 0.2s infinite' }} />
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6c5ce7', animation: 'bounce 1.2s 0.4s infinite' }} />
          </div>
          {status || 'Thinking...'}
          <style>{`@keyframes bounce { 0%,80%,100% { transform: scale(0.6) } 40% { transform: scale(1) } }`}</style>
        </div>
      )}

      {hasText && (
        <div style={{
          padding: '10px 14px',
          borderRadius: 12,
          background: '#f7f2fb',
          borderBottomLeftRadius: 4,
        }}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={md}>
            {text}
          </ReactMarkdown>
          <span style={{ display: 'inline-block', width: 6, height: 14, background: '#6c5ce7', marginLeft: 2, animation: 'blink 1s step-end infinite' }} />
          <style>{`@keyframes blink { 50% { opacity: 0 } }`}</style>
        </div>
      )}
    </div>
  );
}

export default function ChatView({ thread, streaming, streamingText, streamingToolCalls, streamingReasoning, streamingStatus, streamingCode, onFork }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread, streamingText, streamingToolCalls, streamingCode]);

  return (
    <div data-testid="chat-view" style={{
      flex: 1,
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      minHeight: 0,
    }}>
      {thread.length === 0 && !streaming && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: '#7c7981',
          gap: 12,
          padding: '20px 0',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.3}>
            <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>Start prompting</p>
          <p style={{ fontSize: '0.78rem', textAlign: 'center', maxWidth: 240 }}>
            Describe what you want the mockup to look like. The agent can read, write, and screenshot the mockup.
          </p>
        </div>
      )}

      {thread.map((msg, i) => (
        <Message key={i} msg={msg} onFork={(name, html) => onFork?.(name, html, i)} />
      ))}

      {streaming && (
        <StreamingMessage text={streamingText} toolCalls={streamingToolCalls} reasoning={streamingReasoning} status={streamingStatus} code={streamingCode} />
      )}

      <div ref={bottomRef} />
    </div>
  );
}