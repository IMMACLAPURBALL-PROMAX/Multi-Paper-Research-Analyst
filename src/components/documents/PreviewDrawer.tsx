'use client';

import React from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { Flame, Calendar, BookCheck, Trash2, Globe, X } from 'lucide-react';

export const PreviewDrawer: React.FC = () => {
  const {
    activeStagedPaper,
    setActiveStagedPaper,
    promotePaperToTrusted,
    discardStagedPaper,
  } = useWorkspace();

  if (!activeStagedPaper) return null;

  const paper = activeStagedPaper;
  const isPromoted = paper.status === 'promoted';


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
          color: var(--color-brand);
          margin-bottom: 10px;
        }
        .paper-link:hover {
          text-decoration: underline;
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
