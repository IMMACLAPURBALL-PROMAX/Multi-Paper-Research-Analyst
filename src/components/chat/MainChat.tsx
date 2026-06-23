'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Send, Sparkles, Trash2, ShieldAlert, Cpu, Layers, Paperclip, X, Image as ImageIcon, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export const MainChat: React.FC = () => {
  const { 
    mainChatHistory, 
    sendWorkspaceMessage, 
    isChatting, 
    chatError, 
    clearWorkspaceChat,
    trustedSources,
    apiKeys,
    modelConfig,
    activeCenterTab,
    setActiveCenterTab
  } = useWorkspace();

  const [input, setInput] = useState('');
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [activeLightboxImage, setActiveLightboxImage] = useState<string | null>(null);
  const [lightboxScale, setLightboxScale] = useState<number>(1);
  
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mainChatHistory, isChatting]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select a valid image file (PNG/JPG/WEBP).');
        return;
      }
      // Read file client-side as base64 Data URL
      const reader = new FileReader();
      reader.onload = () => {
        setAttachedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || isChatting) return;
    
    const textToSend = input;
    const imageToSend = attachedImage || undefined;
    
    setInput('');
    setAttachedImage(null);
    
    await sendWorkspaceMessage(textToSend, imageToSend);
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
        <div className="header-tabs-container">
          <div className="header-tabs">
            <button 
              className={`header-tab-btn ${activeCenterTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveCenterTab('chat')}
            >
              Analyst Chat
            </button>
            <button 
              className={`header-tab-btn ${activeCenterTab === 'canvas' ? 'active' : ''}`}
              onClick={() => setActiveCenterTab('canvas')}
            >
              Concept Canvas
            </button>
          </div>
          {activeCenterTab === 'chat' ? (
            <span className="header-tab-desc">Grounded in notebook</span>
          ) : (
            <span className="header-tab-desc">Visual concept map</span>
          )}
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
                  {msg.image && (
                    <div className="message-image-wrapper">
                      <img 
                        src={msg.image} 
                        className="message-image" 
                        alt="Attached diagram" 
                        onClick={() => {
                          setActiveLightboxImage(msg.image || null);
                          setLightboxScale(1);
                        }}
                        style={{ cursor: 'zoom-in' }}
                      />
                    </div>
                  )}
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
        {/* Attached image preview */}
        {attachedImage && (
          <div className="image-preview-bar animate-fade-in">
            <div className="preview-thumbnail-wrapper">
              <img src={attachedImage} className="preview-thumbnail" alt="Selected Attachment" />
              <button 
                type="button" 
                className="btn-remove-preview" 
                onClick={() => setAttachedImage(null)}
                title="Remove image"
              >
                <X size={12} />
              </button>
            </div>
            <span className="preview-filename">Image file attached</span>
          </div>
        )}

        <form onSubmit={handleSend} className="input-form">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageChange}
            style={{ display: 'none' }}
          />

          <button
            type="button"
            className="btn-attach"
            onClick={() => fileInputRef.current?.click()}
            disabled={isChatting || !hasKeys || trustedSources.length === 0}
            title="Attach image or chart"
          >
            <Paperclip size={16} />
          </button>

          <input
            type="text"
            placeholder={
              !hasKeys 
                ? "Please configure your API keys first..."
                : trustedSources.length === 0
                ? "Promote papers to your notebook to enable chat..."
                : "Ask about your papers (or charts)..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isChatting || !hasKeys || trustedSources.length === 0}
            style={{ paddingLeft: '44px' }}
          />
          <button 
            type="submit" 
            className="btn-send"
            disabled={(!input.trim() && !attachedImage) || isChatting || !hasKeys || trustedSources.length === 0}
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

      {/* Lightbox Overlay */}
      {activeLightboxImage && (
        <div 
          className="lightbox-overlay"
          onClick={() => setActiveLightboxImage(null)}
        >
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="lightbox-close-btn"
              onClick={() => setActiveLightboxImage(null)}
              title="Close image"
            >
              <X size={20} />
            </button>

            <div className="lightbox-viewport">
              <img 
                src={activeLightboxImage} 
                className="lightbox-image" 
                alt="Enlarged visualization"
                style={{ 
                  transform: `scale(${lightboxScale})`,
                  transition: 'transform 0.15s ease-out'
                }}
              />
            </div>

            <div className="lightbox-controls">
              <button 
                onClick={() => setLightboxScale(s => Math.min(s + 0.25, 4))}
                title="Zoom In"
              >
                <ZoomIn size={16} />
              </button>
              <button 
                onClick={() => setLightboxScale(s => Math.max(s - 0.25, 0.5))}
                title="Zoom Out"
              >
                <ZoomOut size={16} />
              </button>
              <button 
                onClick={() => setLightboxScale(1)}
                title="Reset Zoom"
              >
                <Maximize2 size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

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
          background: rgba(var(--color-brand-rgb), 0.08);
          border: 1px solid rgba(var(--color-brand-rgb), 0.2);
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
          box-shadow: 0 4px 10px rgba(var(--color-brand-rgb), 0.2);
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
          color: var(--color-brand);
          background: var(--color-brand-glow);
          border: 1px solid var(--border-color-glow);
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

        /* Image Attachment & Preview Styles */
        .image-preview-bar {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid var(--border-color);
          border-bottom: none;
          padding: 8px 12px;
          border-top-left-radius: var(--radius-md);
          border-top-right-radius: var(--radius-md);
        }
        .preview-thumbnail-wrapper {
          position: relative;
          width: 40px;
          height: 40px;
          border-radius: var(--radius-sm);
          border: 1px solid var(--border-color);
          overflow: hidden;
        }
        .preview-thumbnail {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .btn-remove-preview {
          position: absolute;
          top: 2px;
          right: 2px;
          width: 14px;
          height: 14px;
          background: rgba(0, 0, 0, 0.7);
          color: #fff;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          transition: background var(--transition-fast);
        }
        .btn-remove-preview:hover {
          background: var(--color-danger);
        }
        .preview-filename {
          font-size: 11px;
          color: var(--text-secondary);
          font-weight: 500;
        }
        .btn-attach {
          position: absolute;
          left: 10px;
          top: 10px;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          z-index: 5;
        }
        .btn-attach:hover:not(:disabled) {
          background: rgba(148, 163, 184, 0.08);
          color: var(--text-primary);
        }
        .btn-attach:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        
        .message-image-wrapper {
          margin-bottom: 8px;
          max-width: 320px;
          border-radius: var(--radius-md);
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .message-image {
          width: 100%;
          height: auto;
          display: block;
          max-height: 200px;
          object-fit: contain;
          background: #000;
        }

        /* Tabs styling */
        .header-tabs-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-tabs {
          display: flex;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--border-color);
          padding: 2px;
          border-radius: var(--radius-md);
        }
        .header-tab-btn {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 6px 14px;
          border-radius: calc(var(--radius-md) - 2px);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .header-tab-btn:hover {
          color: var(--text-primary);
        }
        .header-tab-btn.active {
          background: var(--color-brand-glow);
          border: 1px solid var(--border-color-glow);
          color: #fff;
          font-weight: 600;
        }
        .header-tab-desc {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }

        /* Lightbox styling */
        .lightbox-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(8, 12, 22, 0.9);
          backdrop-filter: blur(12px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: fadeIn var(--transition-fast) forwards;
        }
        .lightbox-content {
          position: relative;
          width: 90vw;
          height: 90vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .lightbox-close-btn {
          position: absolute;
          top: 0;
          right: 0;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all var(--transition-fast);
          z-index: 10001;
        }
        .lightbox-close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.4);
          color: #fca5a5;
        }
        .lightbox-viewport {
          flex-grow: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          padding: 20px;
        }
        .lightbox-image {
          max-width: 95%;
          max-height: 85vh;
          object-fit: contain;
          border-radius: var(--radius-sm);
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          user-select: none;
        }
        .lightbox-controls {
          margin-top: 16px;
          display: flex;
          gap: 8px;
          background: rgba(15, 23, 42, 0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--border-color);
          padding: 6px;
          border-radius: var(--radius-md);
          z-index: 10001;
        }
        .lightbox-controls button {
          color: var(--text-secondary);
          width: 30px;
          height: 30px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          background: transparent;
          border: none;
          cursor: pointer;
        }
        .lightbox-controls button:hover {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
