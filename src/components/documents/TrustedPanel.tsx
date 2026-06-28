'use client';

import React, { useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Upload, BookOpen, Trash2, FileText, Settings, KeyRound } from 'lucide-react';

interface TrustedPanelProps {
  onOpenSettings: () => void;
}

export const TrustedPanel: React.FC<TrustedPanelProps> = ({ onOpenSettings }) => {
  const { 
    trustedSources, 
    uploadPDF, 
    isUploading, 
    uploadProgress, 
    discardStagedPaper,
    apiKeys,
    modelConfig,
    activeStagedPaper,
    setActiveStagedPaper
  } = useWorkspace();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.type !== 'application/pdf') {
        alert('Please upload PDF files only.');
        return;
      }
      await uploadPDF(file);
      // Reset input value so same file can be uploaded again if deleted
      e.target.value = '';
    }
  };

  const triggerUploadClick = () => {
    fileInputRef.current?.click();
  };

  const isAnyKeyConfigured = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

  return (
    <div className="trusted-panel glass-panel">
      {/* 1. Header Section */}
      <div className="panel-header">
        <div className="brand-title">
          <BookOpen className="brand-icon" size={20} />
          <h1>Notebook Sources</h1>
        </div>
        <p className="subtitle">Your trusted research corpus</p>
      </div>

      {/* 2. Key Status Configuration Bar */}
      <div className="key-status-bar" onClick={onOpenSettings} title="Click to configure API Keys">
        <div className="status-label-row">
          <span className="label-text">
            <KeyRound size={12} className="key-icon" />
            BYOK Engine
          </span>
          {isAnyKeyConfigured ? (
            <span className="status-badge active">
              {modelConfig.provider.toUpperCase()}
            </span>
          ) : (
            <span className="status-badge inactive">No Key</span>
          )}
        </div>
        <div className="model-name-row">
          <span className="model-text">
            {isAnyKeyConfigured ? modelConfig.model : 'Configure keys to start'}
          </span>
          <Settings size={13} className="gear-icon" />
        </div>
      </div>

      {/* 3. Upload Zone */}
      <div className="upload-container">
        <input
          type="file"
          accept=".pdf"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        
        {isUploading ? (
          <div className="uploading-state">
            <div className="spinner"></div>
            <span>Extracting text...</span>
            {uploadProgress && (
              <span className="progress-percentage">{uploadProgress.processed}%</span>
            )}
          </div>
        ) : (
          <button className="upload-button" onClick={triggerUploadClick}>
            <Upload size={16} />
            <span>Upload PDF Paper</span>
          </button>
        )}
      </div>

      {/* 4. Trusted Documents List */}
      <div className="sources-list-container">
        <div className="list-title-row">
          <h2>Trusted Papers</h2>
          <span className="source-count">{trustedSources.length}</span>
        </div>
        
        {trustedSources.length === 0 ? (
          <div className="empty-sources-state">
            <FileText className="empty-icon" size={32} />
            <p>Your notebook is empty.</p>
            <p className="hint">Upload a local PDF or search papers in Research Mode and promote them here.</p>
          </div>
        ) : (
          <div className="sources-scroll">
            {trustedSources.map((doc) => (
              <div 
                key={doc.id} 
                className={`source-item animate-fade-in ${activeStagedPaper?.id === doc.id ? 'active' : ''}`}
                onClick={() => setActiveStagedPaper(doc)}
                style={{ cursor: 'pointer' }}
              >
                <div className="source-info">
                  <h3 className="source-title" title={doc.title}>
                    {doc.title}
                    {doc.hasNoText && (
                      <span className="scanned-badge" title="No selectable text layer found in this PDF">Scanned</span>
                    )}
                  </h3>
                  <p className="source-meta">
                    {doc.authors.slice(0, 2).join(', ')}
                    {doc.authors.length > 2 && ' et al.'}
                    {doc.metadata.publishedYear && ` • ${doc.metadata.publishedYear}`}
                  </p>
                  <p className="source-venue">{doc.metadata.venue || 'Local PDF'}</p>
                </div>
                <button 
                  className="btn-delete" 
                  onClick={(e) => {
                    e.stopPropagation();
                    discardStagedPaper(doc.id);
                  }} 
                  title="Remove from notebook"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .trusted-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
          border-right: 1px solid var(--border-color);
          background: rgba(10, 15, 29, 0.4);
        }
        .panel-header {
          padding: 20px 20px 14px;
        }
        .brand-title {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .brand-icon {
          color: var(--color-brand);
        }
        .brand-title h1 {
          font-family: var(--font-display);
          font-size: 17px;
          font-weight: 700;
          letter-spacing: -0.01em;
        }
        .panel-header .subtitle {
          font-size: 11px;
          color: var(--text-secondary);
          margin-top: 4px;
        }
        
        .key-status-bar {
          margin: 0 16px 14px;
          background: rgba(148, 163, 184, 0.04);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 10px 12px;
          cursor: pointer;
          transition: all var(--transition-fast);
        }
        .key-status-bar:hover {
          background: rgba(var(--color-brand-rgb), 0.06);
          border-color: var(--color-brand-glow);
          box-shadow: 0 0 10px 0 rgba(var(--color-brand-rgb), 0.05);
        }
        .status-label-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .label-text {
          font-size: 10px;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .key-icon {
          color: var(--color-brand);
        }
        .status-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 1px 5px;
          border-radius: var(--radius-sm);
        }
        .status-badge.active {
          background: rgba(16, 185, 129, 0.12);
          color: #10b981;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .status-badge.inactive {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }
        .model-name-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .model-text {
          font-size: 11px;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 85%;
        }
        .gear-icon {
          color: var(--text-muted);
        }
        .key-status-bar:hover .gear-icon {
          color: var(--color-brand);
          transform: rotate(30deg);
        }
        
        .upload-container {
          padding: 0 16px;
          margin-bottom: 20px;
        }
        .upload-button {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: var(--color-brand);
          color: #fff;
          font-weight: 500;
          font-size: 13px;
          border-radius: var(--radius-md);
          transition: all var(--transition-fast);
        }
        .upload-button:hover {
          background: var(--color-brand-hover);
          box-shadow: 0 4px 12px rgba(var(--color-brand-rgb), 0.25);
        }
        .uploading-state {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px;
          background: rgba(148, 163, 184, 0.05);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
          font-size: 12px;
          color: var(--text-secondary);
        }
        .spinner {
          width: 14px;
          height: 14px;
          border: 2px solid var(--border-color);
          border-top-color: var(--color-brand);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .progress-percentage {
          font-weight: 600;
          color: var(--color-brand);
        }
        
        .sources-list-container {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          padding: 0 16px 20px;
          overflow: hidden;
        }
        .list-title-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .list-title-row h2 {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .source-count {
          font-size: 10px;
          font-weight: 700;
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-primary);
          padding: 2px 7px;
          border-radius: var(--radius-full);
        }
        .empty-sources-state {
          flex-grow: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 20px;
          background: rgba(148, 163, 184, 0.02);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-lg);
          margin-bottom: 4px;
        }
        .empty-icon {
          color: var(--text-muted);
          margin-bottom: 12px;
          opacity: 0.5;
        }
        .empty-sources-state p {
          font-size: 12px;
          color: var(--text-secondary);
          margin-bottom: 4px;
          font-weight: 500;
        }
        .empty-sources-state .hint {
          font-size: 11px;
          color: var(--text-muted);
        }
        .sources-scroll {
          flex-grow: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding-right: 2px;
        }
        .source-item {
          background: var(--bg-glass);
          border: 1px solid var(--border-color);
          padding: 10px 12px;
          border-radius: var(--radius-md);
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          transition: all var(--transition-fast);
        }
        .source-item:hover {
          border-color: rgba(var(--color-brand-rgb), 0.2);
          background: rgba(var(--color-brand-rgb), 0.02);
        }
        .source-item.active {
          border-color: var(--color-brand);
          background: rgba(var(--color-brand-rgb), 0.08);
          box-shadow: 0 0 10px rgba(var(--color-brand-rgb), 0.05);
        }
        .source-info {
          flex-grow: 1;
          overflow: hidden;
        }
        .source-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
        }
        .scanned-badge {
          display: inline-block;
          font-size: 8px;
          font-weight: 700;
          color: #f59e0b;
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.2);
          padding: 1px 4px;
          border-radius: var(--radius-sm);
          margin-left: 6px;
          vertical-align: middle;
          flex-shrink: 0;
        }
        .source-meta {
          font-size: 11px;
          color: var(--text-secondary);
        }
        .source-venue {
          font-size: 10px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .btn-delete {
          color: var(--text-muted);
          padding: 6px;
          border-radius: var(--radius-sm);
          flex-shrink: 0;
        }
        .btn-delete:hover {
          background: rgba(239, 68, 68, 0.1);
          color: var(--color-danger);
        }
      `}</style>
    </div>
  );
};
