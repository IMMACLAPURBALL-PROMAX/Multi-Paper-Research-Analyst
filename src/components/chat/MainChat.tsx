'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Send, Sparkles, Trash2, ShieldAlert, Cpu, Layers } from 'lucide-react';

export const MainChat: React.FC = () => {
  const { 
    mainChatHistory, 
    sendWorkspaceMessage, 
    isChatting, 
    chatError, 
    clearWorkspaceChat,
    trustedSources,
    apiKeys,
    modelConfig
  } = useWorkspace();

  const [input, setInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mainChatHistory, isChatting]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isChatting) return;
    const textToSend = input;
    setInput('');
    await sendWorkspaceMessage(textToSend);
  };

  // Estimate total tokens in active workspace (Sources content + Chat history)
  const calculateEstimatedTokens = () => {
    let totalChars = 0;
    
    // Abstract & Full text of trusted sources
    trustedSources.forEach(doc => {
      totalChars += (doc.fullTextContent || doc.abstract || '').length;
    });

    // Chat history
    mainChatHistory.forEach(msg => {
      totalChars += msg.content.length;
    });

    // Heuristic: ~4 characters per token
    return Math.round(totalChars / 4);
  };

  const estimatedTokens = calculateEstimatedTokens();
  const hasKeys = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

  return (
    <div className="main-chat-container">
      {/* 1. Header Row */}
      <div className="chat-header border-bottom">
        <div className="header-info">
          <h2>Workspace Analyst Chat</h2>
          <p className="subtitle">Answers are strictly grounded in your promoted papers</p>
        </div>
        
        <div className="header-actions">
          {/* Token count indicator */}
          <div className="token-counter" title="Estimated tokens loaded in memory">
            <Layers size={12} className="token-icon" />
            <span>{estimatedTokens.toLocaleString()} tokens</span>
          </div>
          
          <button 
            className="btn-clear-chat" 
            onClick={clearWorkspaceChat}
            disabled={mainChatHistory.length === 0}
            title="Clear Chat History"
          >
            <Trash2 size={15} />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* 2. Message History Area */}
      <div className="messages-area">
        {mainChatHistory.length === 0 ? (
          <div className="empty-chat-state animate-fade-in">
            <div className="glow-brand-icon">
              <Sparkles size={28} className="sparkle-icon" />
            </div>
            <h3>Grounded Intelligence Chat</h3>
            <p className="description">
              Upload papers or search academic databases, promote them to the notebook, and ask questions. The AI will synthesize answers drawing <strong>only</strong> from your trusted sources.
            </p>
            {trustedSources.length === 0 && (
              <div className="warning-card">
                <ShieldAlert size={16} className="warning-icon" />
                <span>Add papers to your notebook to begin chatting.</span>
              </div>
            )}
          </div>
        ) : (
          <div className="messages-list">
            {mainChatHistory.map((msg) => (
              <div 
                key={msg.id} 
                className={`message-bubble-wrapper ${msg.sender === 'user' ? 'user-wrapper' : 'assistant-wrapper'}`}
              >
                <div className="message-sender-tag">
                  {msg.sender === 'user' ? 'You' : `${modelConfig.provider.toUpperCase()} Assistant`}
                </div>
                <div className="message-bubble">
                  <p className="message-content">{msg.content}</p>
                  
                  {/* Grounded references list */}
                  {msg.sender === 'assistant' && msg.sources && msg.sources.length > 0 && (
                    <div className="message-grounding">
                      <span className="grounding-title">Grounded in:</span>
                      <div className="grounding-chips">
                        {msg.sources.map((s, idx) => (
                          <span key={s.id} className="grounding-chip" title={s.title}>
                            [{idx + 1}] {s.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Thinking loading state */}
            {isChatting && (
              <div className="message-bubble-wrapper assistant-wrapper thinking-wrapper">
                <div className="message-sender-tag">
                  {modelConfig.provider.toUpperCase()} Assistant
                </div>
                <div className="message-bubble thinking-bubble">
                  <span className="dot"></span>
                  <span className="dot"></span>
                  <span className="dot"></span>
                </div>
              </div>
            )}
            
            <div ref={chatBottomRef} />
          </div>
        )}
      </div>

      {/* 3. Error Banner */}
      {chatError && (
        <div className="error-banner">
          <ShieldAlert size={14} />
          <span>{chatError}</span>
        </div>
      )}

      {/* 4. Input Area */}
      <div className="input-area">
        <form onSubmit={handleSend} className="input-form">
          <input
            type="text"
            placeholder={
              !hasKeys 
                ? "Please configure your API keys first..."
                : trustedSources.length === 0
                ? "Promote papers to your notebook to enable chat..."
                : "Ask about your papers..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isChatting || !hasKeys || trustedSources.length === 0}
          />
          <button 
            type="submit" 
            className="btn-send"
            disabled={!input.trim() || isChatting || !hasKeys || trustedSources.length === 0}
          >
            <Send size={15} />
          </button>
        </form>
        
        {/* Helper footer */}
        <div className="input-footer">
          <span className="ai-model-tag">
            <Cpu size={11} />
            {modelConfig.model}
          </span>
          <span>Only trusted sources are used for generating answers.</span>
        </div>
      </div>

      <style jsx>{`
        .main-chat-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-secondary);
        }
        .chat-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }
        .header-info h2 {
          font-family: var(--font-display);
          font-size: 15px;
          font-weight: 600;
        }
        .header-info .subtitle {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 2px;
        }
        
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .token-counter {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(148, 163, 184, 0.05);
          border: 1px solid var(--border-color);
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          color: var(--text-secondary);
        }
        .token-icon {
          color: var(--color-brand);
        }
        .btn-clear-chat {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-secondary);
          padding: 5px 10px;
          border-radius: var(--radius-sm);
          font-size: 11px;
          font-weight: 500;
        }
        .btn-clear-chat:hover:not(:disabled) {
          background: rgba(239, 68, 68, 0.08);
          color: #fca5a5;
        }
        .btn-clear-chat:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
        
        .messages-area {
          flex-grow: 1;
          overflow-y: auto;
          padding: 24px;
        }
        .empty-chat-state {
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: 440px;
          margin: 0 auto;
        }
        .glow-brand-icon {
          width: 56px;
          height: 56px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          border-radius: var(--radius-lg);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
          box-shadow: var(--shadow-glow);
          animation: pulseGlow 3s infinite ease-in-out;
        }
        .sparkle-icon {
          color: var(--color-brand);
        }
        .empty-chat-state h3 {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .empty-chat-state .description {
          font-size: 12px;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 20px;
        }
        .warning-card {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.2);
          padding: 10px 14px;
          border-radius: var(--radius-md);
          font-size: 11px;
          color: #fef08a;
        }
        .warning-icon {
          color: var(--color-warning);
        }
        
        .messages-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .message-bubble-wrapper {
          display: flex;
          flex-direction: column;
          max-width: 85%;
        }
        .user-wrapper {
          align-self: flex-end;
          align-items: flex-end;
        }
        .assistant-wrapper {
          align-self: flex-start;
          align-items: flex-start;
        }
        .message-sender-tag {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.03em;
          color: var(--text-muted);
          margin-bottom: 4px;
          margin-left: 2px;
        }
        .user-wrapper .message-sender-tag {
          margin-right: 2px;
          margin-left: 0;
        }
        .message-bubble {
          padding: 12px 16px;
          border-radius: var(--radius-lg);
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }
        .user-wrapper .message-bubble {
          background: var(--color-brand);
          color: #fff;
          border-bottom-right-radius: 4px;
          box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
        }
        .assistant-wrapper .message-bubble {
          background: var(--bg-surface);
          color: var(--text-primary);
          border-bottom-left-radius: 4px;
          border: 1px solid var(--border-color);
        }
        
        .message-grounding {
          margin-top: 10px;
          border-top: 1px solid var(--border-color);
          padding-top: 8px;
        }
        .grounding-title {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          display: block;
          margin-bottom: 4px;
        }
        .grounding-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .grounding-chip {
          font-size: 10px;
          font-weight: 500;
          color: #a5b4fc;
          background: rgba(99, 102, 241, 0.1);
          border: 1px solid rgba(99, 102, 241, 0.15);
          padding: 2px 6px;
          border-radius: var(--radius-sm);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 180px;
        }
        
        .thinking-bubble {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 12px 18px;
        }
        .thinking-bubble .dot {
          width: 6px;
          height: 6px;
          background: var(--text-secondary);
          border-radius: 50%;
          animation: bounce 1.4s infinite ease-in-out both;
        }
        .thinking-bubble .dot:nth-child(1) { animation-delay: -0.32s; }
        .thinking-bubble .dot:nth-child(2) { animation-delay: -0.16s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
        
        .error-banner {
          background: rgba(239, 68, 68, 0.1);
          border-top: 1px solid rgba(239, 68, 68, 0.2);
          border-bottom: 1px solid rgba(239, 68, 68, 0.2);
          padding: 8px 20px;
          font-size: 11px;
          color: #fca5a5;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .input-area {
          padding: 16px 20px 20px;
          border-top: 1px solid var(--border-color);
          background: rgba(10, 15, 29, 0.3);
        }
        .input-form {
          display: flex;
          gap: 10px;
          position: relative;
        }
        .input-form input {
          flex-grow: 1;
          padding-right: 48px;
          height: 44px;
        }
        .btn-send {
          position: absolute;
          right: 8px;
          top: 8px;
          width: 28px;
          height: 28px;
          background: var(--color-brand);
          color: #fff;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-send:hover:not(:disabled) {
          background: var(--color-brand-hover);
        }
        .btn-send:disabled {
          opacity: 0.3;
          cursor: not-allowed;
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-muted);
        }
        .input-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
          font-size: 10px;
          color: var(--text-muted);
        }
        .ai-model-tag {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 600;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  );
};
