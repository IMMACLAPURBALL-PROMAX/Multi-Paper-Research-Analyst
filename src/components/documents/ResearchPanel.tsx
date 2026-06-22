'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { DocumentSource } from '@/types';
import { Search, Flame, Calendar, BookCheck, Sparkles, Send, ArrowRight, Trash2, Globe, FileText, CheckCircle2, ChevronRight, X } from 'lucide-react';

export const ResearchPanel: React.FC = () => {
  const {
    stagedSources,
    searchPapers,
    isSearching,
    searchError,
    promotePaperToTrusted,
    discardStagedPaper,
    activeStagedPaper,
    setActiveStagedPaper,
    activeStagedChat,
    sendStagedPaperMessage,
    isChatting,
    apiKeys,
    modelConfig
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll staged chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeStagedChat, isChatting]);

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;
    await searchPapers(searchQuery);
  };

  const handleStagedChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !activeStagedPaper || isChatting) return;
    const text = chatInput;
    setChatInput('');
    await sendStagedPaperMessage(activeStagedPaper.id, text);
  };

  const hasKeys = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

  return (
    <div className="research-panel glass-panel">
      {/* 1. Panel Header & Search Form */}
      <div className="panel-header border-bottom">
        <div className="title-row">
          <Sparkles className="sparkle-icon" size={16} />
          <h2>Research Mode</h2>
        </div>
        <p className="subtitle">Search external databases & stage papers</p>
        
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="input-search-wrapper">
            <input
              type="text"
              placeholder="Topic, author, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
            />
            <button type="submit" className="btn-search-icon" disabled={isSearching || !searchQuery.trim()}>
              <Search size={16} />
            </button>
          </div>
        </form>
        {searchError && <p className="error-text">{searchError}</p>}
      </div>

      {/* 2. Staged Area List */}
      <div className="staged-area-container">
        <div className="area-title-row">
          <h3>Staging Area</h3>
          <span className="badge badge-staged">{stagedSources.length} Papers</span>
        </div>

        {isSearching && (
          <div className="search-loading-state">
            <div className="spinner"></div>
            <span>Querying arXiv & Semantic Scholar...</span>
          </div>
        )}

        {!isSearching && stagedSources.length === 0 ? (
          <div className="empty-staging-state">
            <Search size={24} className="empty-icon" />
            <p>Staging area is empty</p>
            <p className="hint">Run a search above to pull papers. They won't affect your notebook chat until promoted.</p>
          </div>
        ) : (
          <div className="staged-scroll-list">
            {stagedSources.map((paper) => (
              <div
                key={paper.id}
                className={`staged-card ${activeStagedPaper?.id === paper.id ? 'active' : ''}`}
                onClick={() => setActiveStagedPaper(paper)}
              >
                <div className="card-top-meta">
                  <span className="badge badge-muted">
                    {paper.id.startsWith('arxiv_') ? 'arXiv' : 'Semantic Scholar'}
                  </span>
                  {paper.metadata.citationCount !== undefined && paper.metadata.citationCount > 0 && (
                    <span className="citation-count">
                      <Flame size={11} className="flame-icon" />
                      {paper.metadata.citationCount} citations
                    </span>
                  )}
                </div>
                
                <h4 className="paper-title" title={paper.title}>{paper.title}</h4>
                <p className="paper-authors">{paper.authors.slice(0, 2).join(', ')} et al.</p>
                
                <div className="card-bottom-meta">
                  <span className="date-tag">
                    <Calendar size={11} />
                    {paper.metadata.publishedYear || 'Preprint'}
                  </span>
                  <ChevronRight size={14} className="arrow-icon" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Sliding Detail & Isolated Chat Drawer */}
      {activeStagedPaper && (
        <div className="preview-drawer animate-fade-in glass-panel">
          <div className="drawer-header">
            <div className="drawer-title-area">
              <span className="badge badge-staged">Previewing Staged Source</span>
              <h3 title={activeStagedPaper.title}>{activeStagedPaper.title}</h3>
            </div>
            <button className="btn-close-drawer" onClick={() => setActiveStagedPaper(null)}>
              <X size={16} />
            </button>
          </div>

          <div className="drawer-body">
            {/* Action Buttons */}
            <div className="drawer-actions">
              <button 
                className="btn-promote" 
                onClick={() => promotePaperToTrusted(activeStagedPaper.id)}
              >
                <BookCheck size={14} />
                <span>Promote to Notebook</span>
              </button>
              
              <button 
                className="btn-discard-staged" 
                onClick={() => discardStagedPaper(activeStagedPaper.id)}
                title="Discard from staging"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {/* Document Info */}
            <div className="paper-details-section">
              <p className="section-label">Authors</p>
              <p className="detail-value">{activeStagedPaper.authors.join(', ')}</p>
              
              <div className="grid-details-row">
                <div>
                  <p className="section-label">Venue / Venue Date</p>
                  <p className="detail-value">{activeStagedPaper.metadata.venue || 'ArXiv'}</p>
                </div>
                <div>
                  <p className="section-label">Citations</p>
                  <p className="detail-value">{activeStagedPaper.metadata.citationCount || 0} times</p>
                </div>
              </div>

              {activeStagedPaper.metadata.url && (
                <a href={activeStagedPaper.metadata.url} target="_blank" rel="noreferrer" className="paper-link">
                  <Globe size={12} />
                  <span>Open Publisher URL</span>
                </a>
              )}

              <p className="section-label">Abstract</p>
              <p className="abstract-text">{activeStagedPaper.abstract || 'No abstract available.'}</p>
            </div>

            {/* Isolated Staged RAG Chat */}
            <div className="isolated-chat-section">
              <h4>Ask this Staged Paper</h4>
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
                        <p>{m.content}</p>
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
        </div>
      )}

      <style jsx>{`
        .research-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          border-left: 1px solid var(--border-color);
          background: rgba(10, 15, 29, 0.4);
          position: relative;
        }
        .panel-header {
          padding: 20px 16px 16px;
        }
        .title-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .sparkle-icon {
          color: var(--color-brand);
        }
        .title-row h2 {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 700;
        }
        .panel-header .subtitle {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
          margin-bottom: 12px;
        }
        .search-form {
          width: 100%;
        }
        .input-search-wrapper {
          position: relative;
          display: flex;
          width: 100%;
        }
        .input-search-wrapper input {
          width: 100%;
          padding-right: 40px;
          height: 38px;
        }
        .btn-search-icon {
          position: absolute;
          right: 4px;
          top: 4px;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
        }
        .btn-search-icon:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.08);
          color: var(--text-primary);
        }
        .error-text {
          font-size: 11px;
          color: var(--color-danger);
          margin-top: 6px;
        }

        .staged-area-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 16px;
          overflow: hidden;
        }
        .area-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .area-title-row h3 {
          font-size: 12px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .search-loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 40px 20px;
          text-align: center;
          color: var(--text-secondary);
          font-size: 12px;
        }
        .empty-staging-state {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px;
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
          background: rgba(148, 163, 184, 0.01);
        }
        .empty-icon {
          color: var(--text-muted);
          opacity: 0.4;
          margin-bottom: 12px;
        }
        .empty-staging-state p {
          font-size: 12px;
          color: var(--text-secondary);
          font-weight: 500;
          margin-bottom: 4px;
        }
        .empty-staging-state .hint {
          font-size: 11px;
          color: var(--text-muted);
          line-height: 1.4;
        }

        .staged-scroll-list {
          flex-grow: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 2px;
        }
        .staged-card {
          background: rgba(15, 23, 42, 0.3);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .staged-card:hover {
          border-color: rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.01);
          transform: translateY(-1px);
        }
        .staged-card.active {
          border-color: var(--color-warning);
          background: rgba(245, 158, 11, 0.04);
          box-shadow: 0 0 10px rgba(245, 158, 11, 0.05);
        }
        .card-top-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .citation-count {
          font-size: 10px;
          font-weight: 600;
          color: #fef08a;
          display: flex;
          align-items: center;
          gap: 3px;
        }
        .flame-icon {
          color: var(--color-warning);
        }
        .paper-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.4;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .paper-authors {
          font-size: 11px;
          color: var(--text-secondary);
          margin-bottom: 6px;
        }
        .card-bottom-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
        }
        .date-tag {
          font-size: 10px;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .arrow-icon {
          color: var(--text-muted);
          transition: transform var(--transition-fast);
        }
        .staged-card:hover .arrow-icon {
          color: var(--color-warning);
          transform: translateX(2px);
        }

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
          font-size: 13px;
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
          background: rgba(15, 23, 42, 0.3);
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
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.5;
          max-height: 120px;
          overflow-y: auto;
          background: rgba(10, 15, 29, 0.4);
          padding: 8px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(148, 163, 184, 0.05);
        }
        .paper-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #a5b4fc;
          margin-bottom: 10px;
        }
        .paper-link:hover {
          text-decoration: underline;
        }

        .isolated-chat-section {
          background: rgba(148, 163, 184, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .isolated-chat-section h4 {
          font-size: 12px;
          font-weight: 600;
        }
        .chat-explanation {
          font-size: 9px;
          color: var(--text-muted);
        }
        .staged-chat-messages {
          height: 160px;
          overflow-y: auto;
          background: rgba(10, 15, 29, 0.5);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 8px;
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
          background: rgba(99, 102, 241, 0.15);
          color: #e0e7ff;
          align-self: flex-end;
          border: 1px solid rgba(99, 102, 241, 0.2);
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
      `}</style>
    </div>
  );
};
