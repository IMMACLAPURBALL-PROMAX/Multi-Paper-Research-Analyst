'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Settings, X, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { getAvailableModels } from '@/lib/models';

interface KeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}



const THEMES = {
  purple: { label: 'Indigo', brand: '#6366f1' },
  coral: { label: 'Coral', brand: '#FF6B6B' },
  amber: { label: 'Amber', brand: '#FFC300' },
  teal: { label: 'Teal', brand: '#2EC4B6' },
  plains: { label: 'Plains', brand: '#A9DFBF' }
};

export const KeyConfigModal: React.FC<KeyConfigModalProps> = ({ isOpen, onClose }) => {
  const { 
    apiKeys, 
    modelConfig, 
    updateApiKeys, 
    updateModelConfig,
    activeTheme,
    updateTheme
  } = useWorkspace();
  
  const [geminiKey, setGeminiKey] = useState(apiKeys.gemini || '');
  const [claudeKey, setClaudeKey] = useState(apiKeys.claude || '');
  const [openaiKey, setOpenaiKey] = useState(apiKeys.openai || '');
  
  const [showGemini, setShowGemini] = useState(false);
  const [showClaude, setShowClaude] = useState(false);
  const [showOpenai, setShowOpenai] = useState(false);
  
  const [provider, setProvider] = useState(modelConfig.provider);
  const [model, setModel] = useState(modelConfig.model);
  const [temperature, setTemperature] = useState(modelConfig.temperature ?? 0.2);
  const [maxTokens, setMaxTokens] = useState(modelConfig.maxTokens ?? 2048);

  // Sync state with Context when open
  useEffect(() => {
    if (isOpen) {
      setGeminiKey(apiKeys.gemini || '');
      setClaudeKey(apiKeys.claude || '');
      setOpenaiKey(apiKeys.openai || '');
      setProvider(modelConfig.provider);
      setModel(modelConfig.model);
      setTemperature(modelConfig.temperature ?? 0.2);
      setMaxTokens(modelConfig.maxTokens ?? 2048);
    }
  }, [isOpen, apiKeys, modelConfig]);

  // Sync selected model with available models list
  useEffect(() => {
    const models = getAvailableModels({
      gemini: geminiKey,
      claude: claudeKey,
      openai: openaiKey
    });
    if (models.length > 0) {
      const exists = models.some(m => m.id === model && m.provider === provider);
      if (!exists) {
        setProvider(models[0].provider);
        setModel(models[0].id);
      }
    }
  }, [geminiKey, claudeKey, openaiKey, model, provider]);

  const handleModelSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [selectedProvider, selectedId] = e.target.value.split(':');
    if (selectedProvider && selectedId) {
      setProvider(selectedProvider as any);
      setModel(selectedId);
    }
  };

  const handleSave = () => {
    updateApiKeys({
      gemini: geminiKey.trim() || undefined,
      claude: claudeKey.trim() || undefined,
      openai: openaiKey.trim() || undefined,
      semanticScholar: apiKeys.semanticScholar
    });
    
    updateModelConfig({
      provider,
      model,
      temperature,
      maxTokens
    });
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card animate-fade-in glass-panel">
        <div className="modal-header">
          <div className="modal-title-area">
            <Settings className="settings-icon" size={20} />
            <h2>Workspace & API Key Config</h2>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body">
          <div className="security-notice">
            <ShieldCheck size={20} className="security-icon" />
            <p>
              <strong>Session Security:</strong> Your keys are stored locally in browser session memory. They are sent directly to AI providers via a secure backend proxy for completion, and are never saved to a database or server logs.
            </p>
          </div>

          <div className="form-group">
            <h3>1. Select Active AI Model</h3>
            <div className="model-selector-row">
              <div className="select-wrapper flex-grow">
                <label>Active Model</label>
                {getAvailableModels({ gemini: geminiKey, claude: claudeKey, openai: openaiKey }).length > 0 ? (
                  <select value={`${provider}:${model}`} onChange={handleModelSelectChange}>
                    {getAvailableModels({ gemini: geminiKey, claude: claudeKey, openai: openaiKey }).map((m) => (
                      <option key={`${m.provider}:${m.id}`} value={`${m.provider}:${m.id}`}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <select disabled>
                    <option value="">No keys configured (Setup keys below to unlock models)</option>
                  </select>
                )}
              </div>
            </div>

            <div className="params-row" style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
              <div className="select-wrapper flex-grow" style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label>Temperature: {temperature}</label>
                </div>
                <input
                  type="range"
                  min="0.0"
                  max="1.5"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  style={{ width: '100%', marginTop: '6px' }}
                />
              </div>
              
              <div className="select-wrapper" style={{ display: 'flex', flexDirection: 'column', width: '180px' }}>
                <label>Max Tokens</label>
                <select 
                  value={maxTokens} 
                  onChange={(e) => setMaxTokens(parseInt(e.target.value, 10))}
                  style={{ marginTop: '4px' }}
                >
                  <option value="256">256 (Very Short)</option>
                  <option value="512">512 (Short Summary)</option>
                  <option value="1024">1024 (Standard)</option>
                  <option value="2048">2048 (Long Response)</option>
                  <option value="4096">4096 (Maximum)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-group">
            <h3>2. Configure API Keys</h3>
            <p className="subtitle">Enter the key(s) for the providers you wish to use.</p>
            
            {/* Gemini key */}
            <div className="input-key-wrapper">
              <div className="key-header">
                <label>Google Gemini API Key</label>
                {geminiKey && <span className="key-indicator active">Configured</span>}
              </div>
              <div className="input-action-row">
                <input
                  type={showGemini ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button 
                  className="btn-eye" 
                  onClick={() => setShowGemini(!showGemini)}
                  title={showGemini ? "Hide Key" : "Show Key"}
                >
                  {showGemini ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Claude key */}
            <div className="input-key-wrapper">
              <div className="key-header">
                <label>Anthropic Claude API Key</label>
                {claudeKey && <span className="key-indicator active">Configured</span>}
              </div>
              <div className="input-action-row">
                <input
                  type={showClaude ? 'text' : 'password'}
                  placeholder="sk-ant-..."
                  value={claudeKey}
                  onChange={(e) => setClaudeKey(e.target.value)}
                />
                <button 
                  className="btn-eye" 
                  onClick={() => setShowClaude(!showClaude)}
                  title={showClaude ? "Hide Key" : "Show Key"}
                >
                  {showClaude ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* OpenAI key */}
            <div className="input-key-wrapper">
              <div className="key-header">
                <label>OpenAI API Key</label>
                {openaiKey && <span className="key-indicator active">Configured</span>}
              </div>
              <div className="input-action-row">
                <input
                  type={showOpenai ? 'text' : 'password'}
                  placeholder="sk-..."
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                />
                <button 
                  className="btn-eye" 
                  onClick={() => setShowOpenai(!showOpenai)}
                  title={showOpenai ? "Hide Key" : "Show Key"}
                >
                  {showOpenai ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

          </div> {/* Closes Configure API Keys form-group */}

          <div className="form-group">
            <h3>3. Accent Theme</h3>
            <p className="subtitle">Select your preferred accent color for the workspace.</p>
            <div className="theme-selectors-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '6px' }}>
              {Object.entries(THEMES).map(([name, themeInfo]) => (
                <button
                  key={name}
                  type="button"
                  className={`theme-dot-btn ${activeTheme === name ? 'active' : ''}`}
                  onClick={() => updateTheme(name as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: activeTheme === name ? '1px solid var(--color-brand)' : '1px solid var(--border-color)',
                    background: activeTheme === name ? 'var(--color-brand-glow)' : 'rgba(15, 23, 42, 0.4)',
                    color: activeTheme === name ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  <span style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: themeInfo.brand,
                    display: 'inline-block',
                    boxShadow: activeTheme === name ? `0 0 8px ${themeInfo.brand}` : 'none'
                  }} />
                  {themeInfo.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" onClick={handleSave}>
            Save Workspace Settings
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(4, 7, 15, 0.7);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .modal-card {
          width: 100%;
          max-width: 540px;
          border-radius: var(--radius-lg);
          display: flex;
          flex-direction: column;
          box-shadow: var(--shadow-lg), var(--shadow-glow);
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border-color);
        }
        .modal-title-area {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .settings-icon {
          color: var(--color-brand);
        }
        .modal-title-area h2 {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .btn-close {
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: var(--radius-sm);
        }
        .btn-close:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--color-danger);
        }
        .modal-body {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-height: 70vh;
          overflow-y: auto;
        }
        .security-notice {
          display: flex;
          gap: 12px;
          background: rgba(99, 102, 241, 0.08);
          border: 1px solid rgba(99, 102, 241, 0.2);
          padding: 14px 16px;
          border-radius: var(--radius-md);
        }
        .security-icon {
          color: var(--color-brand);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .security-notice p {
          font-size: 13px;
          line-height: 1.5;
          color: #c7d2fe;
        }
        .form-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .form-group h3 {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }
        .form-group .subtitle {
          font-size: 12px;
          color: var(--text-secondary);
          margin-top: -6px;
        }
        .model-selector-row {
          display: flex;
          gap: 16px;
        }
        .select-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .flex-grow {
          flex-grow: 1;
        }
        .select-wrapper label {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .select-wrapper select {
          width: 100%;
        }
        .input-key-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
          background: rgba(148, 163, 184, 0.03);
          border: 1px solid var(--border-color);
          padding: 12px;
          border-radius: var(--radius-md);
        }
        .key-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .key-header label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
        }
        .key-indicator {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          border-radius: var(--radius-full);
        }
        .key-indicator.active {
          background: rgba(16, 185, 129, 0.12);
          color: #a7f3d0;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .input-action-row {
          display: flex;
          gap: 8px;
        }
        .input-action-row input {
          flex-grow: 1;
          font-family: monospace;
        }
        .btn-eye {
          background: rgba(148, 163, 184, 0.08);
          border: 1px solid var(--border-color);
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          border-radius: var(--radius-md);
        }
        .btn-eye:hover {
          background: rgba(148, 163, 184, 0.15);
          color: var(--text-primary);
          border-color: var(--text-muted);
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 16px 24px;
          border-top: 1px solid var(--border-color);
          background: rgba(10, 15, 29, 0.5);
        }
      `}</style>
    </div>
  );
};
