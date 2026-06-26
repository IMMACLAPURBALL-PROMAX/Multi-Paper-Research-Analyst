'use client';

import React, { useState, useEffect } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { getPdfFromLocal } from '@/lib/indexeddb';
import { BookOpen } from 'lucide-react';

export const InlinePdfViewer: React.FC = () => {
  const { trustedSources, selectedViewerDocId, setSelectedViewerDocId } = useWorkspace();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Initialize selected doc if null
  useEffect(() => {
    if (!selectedViewerDocId && trustedSources.length > 0) {
      setSelectedViewerDocId(trustedSources[0].id);
    } else if (selectedViewerDocId && !trustedSources.find(d => d.id === selectedViewerDocId)) {
      setSelectedViewerDocId(trustedSources.length > 0 ? trustedSources[0].id : null);
    }
  }, [trustedSources, selectedViewerDocId, setSelectedViewerDocId]);

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

  if (trustedSources.length === 0) {
    return (
      <div style={{ padding: '20px', color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px', fontSize: '13px' }}>
        No documents uploaded.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#e2e8f0' }}>
      {/* Small Header for Dropdown */}
      <div style={{ 
        padding: '6px 12px', 
        background: 'var(--bg-secondary)', 
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <BookOpen size={14} style={{ color: 'var(--color-brand)' }} />
        <select 
          value={selectedViewerDocId || ''} 
          onChange={(e) => setSelectedViewerDocId(e.target.value)}
          style={{
            padding: '4px 8px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)',
            outline: 'none',
            flex: 1,
            fontSize: '12px'
          }}
        >
          {trustedSources.map(doc => (
            <option key={doc.id} value={doc.id}>{doc.title}</option>
          ))}
        </select>
      </div>

      {/* PDF Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {pdfUrl ? (
          <iframe 
            src={`${pdfUrl}#view=FitH`} 
            width="100%" 
            height="100%" 
            style={{ border: 'none', display: 'block' }}
            title="PDF Viewer"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#64748b', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
            Original PDF file not found in local storage.
          </div>
        )}
      </div>
    </div>
  );
};
