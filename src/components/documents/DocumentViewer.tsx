'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getPdfFromLocal } from '@/lib/indexeddb';

interface Chunk {
  id: string | number;
  content: string;
}

export const DocumentViewer: React.FC = () => {
  const { trustedSources, selectedViewerDocId, setSelectedViewerDocId, activeCenterTab, setActiveCenterTab } = useWorkspace();
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Initialize selected doc if null
  useEffect(() => {
    if (!selectedViewerDocId && trustedSources.length > 0) {
      setSelectedViewerDocId(trustedSources[0].id);
    } else if (selectedViewerDocId && !trustedSources.find(d => d.id === selectedViewerDocId)) {
      setSelectedViewerDocId(trustedSources.length > 0 ? trustedSources[0].id : null);
    }
  }, [trustedSources, selectedViewerDocId, setSelectedViewerDocId]);

  // Fetch Chunks
  useEffect(() => {
    const fetchChunks = async () => {
      if (!selectedViewerDocId) {
        setChunks([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/chunks/${selectedViewerDocId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to fetch chunks');
        setChunks(data.chunks || []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchChunks();
  }, [selectedViewerDocId]);

  // Fetch Local PDF
  useEffect(() => {
    const fetchPdf = async () => {
      if (!selectedViewerDocId) {
        setPdfUrl(null);
        return;
      }
      const file = await getPdfFromLocal(selectedViewerDocId);
      if (file) {
        const url = URL.createObjectURL(file);
        setPdfUrl(url);
        return () => URL.revokeObjectURL(url);
      } else {
        setPdfUrl(null);
      }
    };
    fetchPdf();
  }, [selectedViewerDocId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header Row (reused classes from chat header for consistency) */}
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
            <button 
              className={`header-tab-btn ${activeCenterTab === 'viewer' ? 'active' : ''}`}
              onClick={() => setActiveCenterTab('viewer')}
            >
              Document Viewer
            </button>
          </div>
          <span className="header-tab-desc" style={{ fontWeight: 600, color: 'var(--color-brand)' }}>Split-Screen Document Viewer</span>
        </div>
        
        <div className="header-actions" style={{ flex: 1, justifyContent: 'flex-end', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <select 
            className="pdf-selector"
            value={selectedViewerDocId || ''} 
            onChange={(e) => setSelectedViewerDocId(e.target.value)}
            disabled={trustedSources.length === 0}
            style={{ maxWidth: '300px' }}
          >
            {trustedSources.length > 0 ? trustedSources.map(doc => (
              <option key={doc.id} value={doc.id}>{doc.title}</option>
            )) : (
              <option value="">No documents</option>
            )}
          </select>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {chunks.length} chunks
          </div>
        </div>
      </div>

      {/* Split Body */}
      {trustedSources.length === 0 ? (
        <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '100px' }}>
          No documents uploaded. Upload a PDF to view its contents.
        </div>
      ) : (
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        
        {/* Left Side: Visual PDF */}
        <div style={{ flex: 1, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: '#e2e8f0' }}>
          {pdfUrl ? (
            <iframe 
              src={`${pdfUrl}#view=FitH`} 
              width="100%" 
              height="100%" 
              style={{ border: 'none', flex: 1 }}
              title="PDF Viewer"
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b' }}>
              Original PDF file not found in local browser storage.
            </div>
          )}
        </div>

        {/* Right Side: Markdown Chunks */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: 'var(--bg-primary)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Extracted Vector Chunks
          </h3>
          
          {loading && <div style={{ color: 'var(--text-secondary)' }}>Loading chunks from database...</div>}
          {error && <div style={{ color: 'var(--color-brand)' }}>Error: {error}</div>}
          
          {!loading && !error && chunks.map((chunk, index) => (
            <div key={chunk.id} style={{
              background: 'var(--bg-glass)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '-10px',
                left: '16px',
                fontSize: '11px',
                fontWeight: 'bold',
                color: '#fff',
                background: 'var(--color-brand)',
                padding: '2px 8px',
                borderRadius: '10px'
              }}>
                Chunk {index + 1}
              </div>
              <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.6', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                {chunk.content}
              </p>
            </div>
          ))}
        </div>
      </div>
      )}

      <style jsx>{`
        .chat-header {
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }
        .header-tabs-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .header-tabs {
          display: flex;
          background: var(--bg-glass);
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
      `}</style>
    </div>
  );
};
