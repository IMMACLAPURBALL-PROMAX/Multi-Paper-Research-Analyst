'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Flame, Calendar, BookCheck, Send, Trash2, Globe, FileText, X } from 'lucide-react';
import { renderMarkdown } from '@/lib/markdown';

export const PreviewDrawer: React.FC = () => {
  const {
    activeStagedPaper,
    setActiveStagedPaper,
    promotePaperToTrusted,
    discardStagedPaper,
    activeStagedChat,
    sendStagedPaperMessage,
    isChatting,
    apiKeys,
    modelConfig
  } = useWorkspace();

  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll staged chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeStagedChat, isChatting]);

  if (!activeStagedPaper) return null;

  const paper = activeStagedPaper;
  const isPromoted = paper.status === 'promoted';

  const handleStagedChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || isChatting) return;
    const text = chatInput;
    setChatInput('');
    await sendStagedPaperMessage(paper.id, text);
  };

  const hasKeys = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

  return (
    <div className="preview-drawer animate-fade-in glass-panel">
      <div className="drawer-header">
        <div className="drawer-title-area">
          <span className={`badge ${isPromoted ? 'badge-brand' : 'badge-staged'}`}>
            {isPromoted ? 'Notebook Source' : 'Staged Source'}
          </span>
          <h3 title={paper.title}>{paper.title}</h3>
        </div>
        <button className="btn-close-drawer" onClick={() => setActiveStagedPaper(null)}>
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        {/* Scanned Document Warning */}
        {paper.hasNoText && (
          <div className="scanned-warning-banner">
            <span className="warning-icon">⚠️</span>
            <div className="warning-text">
              <strong>Scanned PDF / Image-only Document</strong>
              <p>No selectable text layer was detected. Context queries and mind maps will only utilize this document's title and metadata.</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="drawer-actions">
          {isPromoted ? (
            <div className="promoted-badge-box">
              <BookCheck size={14} className="check-icon" />
              <span>Promoted to Notebook</span>
            </div>
          ) : (
            <button 
              className="btn-promote" 
              onClick={() => promotePaperToTrusted(paper.id)}
            >
              <BookCheck size={14} />
              <span>Promote to Notebook</span>
            </button>
          )}
          
          <button 
            className="btn-discard-staged" 
            onClick={() => discardStagedPaper(paper.id)}
            title={isPromoted ? "Delete from notebook" : "Discard from staging"}
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Document Info */}
        <div className="paper-details-section">
          <p className="section-label">Authors</p>
          <p className="detail-value">{paper.authors.join(', ')}</p>
          
          <div className="grid-details-row">
            <div>
              <p className="section-label">Venue / Year</p>
              <p className="detail-value">{paper.metadata.venue || 'ArXiv'}</p>
            </div>
            <div>
              <p className="section-label">Citations</p>
              <p className="detail-value">{paper.metadata.citationCount || 0} times</p>
            </div>
          </div>

          {paper.metadata.url && (
            <a href={paper.metadata.url} target="_blank" rel="noreferrer" className="paper-link">
              <Globe size={12} />
              <span>Open Publisher URL</span>
            </a>
          )}

          <p className="section-label">Abstract</p>
          <p className="abstract-text">{paper.abstract || 'No abstract available.'}</p>
        </div>

        {/* Isolated Staged RAG Chat */}
        <div className="isolated-chat-section">
          <h4>Ask this {isPromoted ? 'Notebook' : 'Staged'} Paper</h4>
          <p className="chat-explanation">Answers draw only from this specific paper's abstract/content.</p>
          
          <div className="staged-chat-messages">
            {activeStagedChat.length === 0 ? (
              <div className="staged-chat-empty">
                <FileText size={20} className="chat-icon" />
                <span>No messages yet. Ask "What is the key finding?"</span>
              </div>
            ) : (
              <div className="staged-messages-list">
                {activeStagedChat.map((m) => (
                  <div key={m.id} className={`staged-msg ${m.sender === 'user' ? 'user-msg' : 'ai-msg'}`}>
                    <div className="msg-header">
                      {m.sender === 'user' ? 'You' : `${modelConfig.provider.toUpperCase()}`}
                    </div>
                    <div className="staged-msg-content">{renderMarkdown(m.content)}</div>
                  </div>
                ))}
                {isChatting && (
                  <div className="staged-msg ai-msg thinking">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>
            )}
          </div>

          <form onSubmit={handleStagedChatSend} className="staged-chat-form">
            <input
              type="text"
              placeholder={hasKeys ? "Ask about this paper..." : "Set API Keys to chat..."}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              disabled={isChatting || !hasKeys}
            />
            <button type="submit" disabled={isChatting || !chatInput.trim() || !hasKeys}>
              <Send size={12} />
            </button>
          </form>
        </div>
      </div>

      <style jsx>{`
        /* Detail Drawer Styles */
        .preview-drawer {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 10;
          display: flex;
          flex-direction: column;
          background: #0f1626;
          border-left: 1px solid var(--border-color);
          box-shadow: -4px 0 20px rgba(0, 0, 0, 0.4);
          animation: slideInRight var(--transition-normal);
        }
        .drawer-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 1px solid var(--border-color);
          gap: 12px;
        }
        .drawer-title-area {
          display: flex;
          flex-direction: column;
          gap: 6px;
          max-width: 85%;
        }
        .drawer-title-area h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
        }
        .btn-close-drawer {
          color: var(--text-secondary);
          padding: 4px;
          border-radius: var(--radius-sm);
        }
        .btn-close-drawer:hover {
          background: rgba(148, 163, 184, 0.08);
          color: var(--text-primary);
        }
        
        .drawer-body {
          flex-grow: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .drawer-actions {
          display: flex;
          gap: 8px;
        }
        .btn-promote {
          flex-grow: 1;
          background: var(--color-brand);
          color: #fff;
          font-size: 12px;
          font-weight: 600;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .btn-promote:hover {
          background: var(--color-brand-hover);
        }
        .btn-discard-staged {
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fca5a5;
          width: 36px;
          height: 36px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-discard-staged:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: var(--color-danger);
        }

        .paper-details-section {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px;
        }
        .section-label {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          letter-spacing: 0.05em;
          margin-bottom: 2px;
        }
        .detail-value {
          font-size: 11px;
          color: var(--text-primary);
          margin-bottom: 10px;
        }
        .grid-details-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .abstract-text {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.6;
          background: rgba(10, 15, 29, 0.4);
          padding: 12px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(148, 163, 184, 0.05);
        }
        .paper-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--color-brand);
          margin-bottom: 10px;
        }
        .paper-link:hover {
          text-decoration: underline;
        }

        .isolated-chat-section {
          background: rgba(148, 163, 184, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          flex-grow: 1;
        }
        .isolated-chat-section h4 {
          font-size: 14px;
          font-weight: 600;
        }
        .chat-explanation {
          font-size: 9px;
          color: var(--text-muted);
        }
        .staged-chat-messages {
          flex-grow: 1;
          min-height: 200px;
          overflow-y: auto;
          background: rgba(10, 15, 29, 0.5);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 12px;
        }
        .staged-chat-empty {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 10px;
          text-align: center;
          gap: 4px;
        }
        .staged-messages-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .staged-msg {
          padding: 6px 10px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          line-height: 1.4;
        }
        .staged-msg .msg-header {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          color: var(--text-muted);
          margin-bottom: 2px;
        }
        .staged-msg.user-msg {
          background: var(--color-brand-glow);
          color: #e0e7ff;
          align-self: flex-end;
          border: 1px solid var(--border-color-glow);
        }
        .staged-msg.ai-msg {
          background: rgba(148, 163, 184, 0.08);
          color: var(--text-primary);
          align-self: flex-start;
          border: 1px solid var(--border-color);
        }
        
        .thinking {
          display: flex;
          gap: 3px;
          align-items: center;
          padding: 8px;
        }
        .thinking .dot {
          width: 4px;
          height: 4px;
          background: var(--text-muted);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .thinking .dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking .dot:nth-child(2) { animation-delay: -0.16s; }

        .staged-chat-form {
          display: flex;
          gap: 6px;
          position: relative;
        }
        .staged-chat-form input {
          flex-grow: 1;
          height: 32px;
          font-size: 11px;
          padding-right: 32px;
        }
        .staged-chat-form button {
          position: absolute;
          right: 4px;
          top: 4px;
          width: 24px;
          height: 24px;
          background: var(--color-brand);
          color: #fff;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Promoted badge styling */
        .promoted-badge-box {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          height: 36px;
          border-radius: var(--radius-md);
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #10b981;
          font-size: 11px;
          font-weight: 700;
        }

        /* Scanned warning banner styling */
        .scanned-warning-banner {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.25);
          border-radius: var(--radius-md);
          margin-bottom: 12px;
          color: #f59e0b;
        }
        .scanned-warning-banner .warning-icon {
          font-size: 16px;
          margin-top: 1px;
        }
        .scanned-warning-banner .warning-text strong {
          display: block;
          font-size: 11px;
          font-weight: 700;
          margin-bottom: 2px;
        }
        .scanned-warning-banner .warning-text p {
          margin: 0;
          font-size: 10px;
          line-height: 1.4;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
