'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { GitFork, Sparkles, RefreshCw, Layers, ZoomIn, ZoomOut, Download, Maximize2, Trash2, AlertCircle } from 'lucide-react';
import mermaid from 'mermaid';
import jsPDF from 'jspdf';

// Unique counter to prevent ID collisions in Mermaid renders
let renderIdCounter = 0;

export const MindMapCanvas: React.FC = () => {
  const { 
    trustedSources, 
    apiKeys, 
    modelConfig,
    activeCenterTab,
    setActiveCenterTab,
    activeMode
  } = useWorkspace();
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeepLoading, setIsDeepLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [targetPdfId, setTargetPdfId] = useState<string>('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-select first trusted source if target is empty
  useEffect(() => {
    if ((!targetPdfId || targetPdfId === 'all') && trustedSources.length > 0) {
      setTargetPdfId(trustedSources[0].id);
    }
  }, [trustedSources, targetPdfId]);

  // Initialize Mermaid on mount
  useEffect(() => {
    try {
      const isLight = activeMode === 'light';
      mermaid.initialize({
        startOnLoad: false,
        theme: isLight ? 'default' : 'dark',
        securityLevel: 'loose',
        themeVariables: {
          background: isLight ? '#f8fafc' : '#0f172a',
          primaryColor: '#6366f1',
          primaryTextColor: isLight ? '#0f172a' : '#f8fafc',
          lineColor: isLight ? '#94a3b8' : '#64748b',
          fontSize: '13px'
        }
      });
    } catch (err) {
      console.error('Failed to initialize Mermaid:', err);
    }
  }, [activeMode]);

  // Render SVG when mermaidCode changes
  useEffect(() => {
    if (!mermaidCode || !canvasRef.current) return;

    let isMounted = true;
    const renderChart = async () => {
      renderIdCounter++;
      const uniqueId = `mermaid-render-${renderIdCounter}`;
      try {
        setError(null);
        
        // Clear previous content
        if (canvasRef.current) canvasRef.current.innerHTML = '';

        // Render to SVG
        const { svg } = await mermaid.render(uniqueId, mermaidCode);
        
        if (isMounted && canvasRef.current) {
          canvasRef.current.innerHTML = svg;
          
          // Style the generated SVG to fit nicely
          const svgEl = canvasRef.current.querySelector('svg');
          if (svgEl) {
            svgEl.style.width = '100%';
            svgEl.style.height = 'auto';
            svgEl.style.maxHeight = '100%';
            svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          }
        }
      } catch (err: any) {
        console.error('Mermaid render error:', err);
        // Clear out corrupt SVG tags
        const badEl = document.getElementById(`d${uniqueId}`);
        if (badEl) badEl.remove();

        if (isMounted) {
          setError('Failed to parse Mind Map structure. The AI generated an invalid syntax.');
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [mermaidCode]);


  const generateDeepMindMap = async () => {
    const sourcesToUse = targetPdfId === 'all' ? trustedSources : trustedSources.filter(s => s.id === targetPdfId);
    if (sourcesToUse.length === 0) return;
    setIsLoading(true);
    setIsDeepLoading(true);
    setError(null);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKeys.gemini) headers['x-gemini-key'] = apiKeys.gemini;
      if (apiKeys.claude) headers['x-anthropic-key'] = apiKeys.claude;
      if (apiKeys.openai) headers['x-openai-key'] = apiKeys.openai;

      // Fetch all chunks for all trusted sources
      let massiveContext = '';
      for (let i = 0; i < sourcesToUse.length; i++) {
        const doc = sourcesToUse[i];
        massiveContext += `\n\n--- PAPER [${i + 1}]: ${doc.title} ---\n`;
        const res = await fetch(`/api/chunks/${doc.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.chunks) {
            massiveContext += data.chunks.map((c: any) => c.content).join('\n\n');
          }
        }
      }

      const prompt = `You are an elite research visualization expert. You are being provided with the FULL TEXT chunks of multiple academic papers. Your task is to perform a deep synthesis and generate a highly meaningful, directional Flowchart (graph LR) connecting the most critical insights, methodologies, and conclusions across these papers.
The full text of the papers have already been provided to you below as plain text. Do not ask to read the PDF files or say you cannot access files. Read the text provided below.

Full Text Corpus:
${massiveContext}

CRITICAL INSTRUCTIONS:
1. Return the output strictly as Mermaid.js flowchart syntax starting with "graph LR".
2. DO NOT use "mindmap" syntax.
3. Create nodes that are descriptive, meaningful sentences or core findings (e.g., A["Helicopter parenting severely impacts autonomy"]). Do not use single-word meaningless nodes.
4. Connect the nodes with descriptive action verbs (e.g., A -->|Leads to| B).
5. Extract only the top 15-20 most critical, foundational relationships to keep the graph readable and profound.
6. Do not include extra comments, markdown formatting, or HTML tags inside the block.
7. Return ONLY the mermaid code block inside a \`\`\`mermaid codeblock.`;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [{ sender: 'user', content: prompt }],
          provider: modelConfig.provider,
          model: modelConfig.model
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to generate deep mind map.');

      const content = data.content;
      const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*graph\s*([\s\S]*?)\s*```/) ||
                           [null, content];
                           
      let extractedCode = mermaidMatch[1]?.trim() || content.trim();

      // Clean up extracted code
      extractedCode = extractedCode.replace(/```mermaid/gi, '').replace(/```graph/gi, '').replace(/```/g, '').trim();
      
      if (!extractedCode.startsWith('graph') && !extractedCode.startsWith('flowchart')) {
        extractedCode = `graph LR\n${extractedCode}`;
      }
      
      setMermaidCode(extractedCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to synthesize deep mind map. The model might have timed out or run out of context.');
    } finally {
      setIsLoading(false);
      setIsDeepLoading(false);
    }
  };

  const hasKeys = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDownloadPdf = () => {
    if (!canvasRef.current) return;
    const svgEl = canvasRef.current.querySelector('svg');
    if (!svgEl) return;
    
    const clone = svgEl.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('style');
    clone.removeAttribute('width');
    clone.removeAttribute('height');

    const svgData = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Use higher scale for crisp resolution
      const scale = 3;
      // Intrinsic width and height from SVG bounding box, or fallback
      const rect = svgEl.getBoundingClientRect();
      const baseWidth = clone.viewBox.baseVal.width || rect.width || 800;
      const baseHeight = clone.viewBox.baseVal.height || rect.height || 600;

      canvas.width = baseWidth * scale;
      canvas.height = baseHeight * scale;
      
      if (ctx) {
        ctx.scale(scale, scale);
        // Fill background to match the theme
        ctx.fillStyle = activeMode === 'light' ? '#f8fafc' : '#0f172a';
        ctx.fillRect(0, 0, baseWidth, baseHeight);
        ctx.drawImage(img, 0, 0, baseWidth, baseHeight);
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        const orientation = baseWidth > baseHeight ? 'l' : 'p';
        const pdf = new jsPDF({
          orientation: orientation,
          unit: 'px',
          format: [baseWidth, baseHeight]
        });
        
        pdf.addImage(imgData, 'PNG', 0, 0, baseWidth, baseHeight);
        pdf.save(`mindmap-${Date.now()}.pdf`);
      }
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="mindmap-container glass-panel">
      {/* 1. Header Row */}
      <div className="canvas-header border-bottom">
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
          <span className="header-tab-desc">
            {activeCenterTab === 'chat' && 'Grounded in notebook'}
            {activeCenterTab === 'canvas' && 'Visual concept map'}
            {activeCenterTab === 'viewer' && 'Split-screen PDF & chunks'}
          </span>
        </div>
        {trustedSources.length > 0 && hasKeys && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select 
              className="pdf-selector"
              value={targetPdfId} 
              onChange={(e) => setTargetPdfId(e.target.value)}
            >
              {trustedSources.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.title.length > 25 ? doc.title.substring(0, 25) + '...' : doc.title}
                </option>
              ))}
            </select>

            <button 
              className="btn-sync" 
              style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#fbbf24', borderColor: 'rgba(234, 179, 8, 0.3)' }}
              onClick={generateDeepMindMap} 
              disabled={isLoading}
              title="Generate a massive map using the full text of all papers (High Token)"
            >
              <AlertCircle size={13} />
              <span>Deep Synthesis (~30k tokens)</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Render Canvas Area */}
      <div className="canvas-area">
        {isLoading && (
          <div className="canvas-loading animate-fade-in">
            <div className="spinner"></div>
            <h3>{isDeepLoading ? 'Deep Synthesizing Full Text...' : 'Synthesizing Abstracts...'}</h3>
            <p className="hint">
              {isDeepLoading 
                ? 'This may take 10-15 seconds. Scanning thousands of tokens across all methodologies and findings.' 
                : 'Extracting topics, grouping methodologies, and formatting mind map nodes.'}
            </p>
          </div>
        )}

        {!isLoading && error && (
          <div className="canvas-error animate-fade-in">
            <p className="error-msg">{error}</p>
            <button className="btn-secondary" onClick={generateDeepMindMap}>Try Again</button>
          </div>
        )}

        {!isLoading && !error && !mermaidCode && (
          <div className="canvas-empty animate-fade-in">
            <div className="icon-glow">
              <GitFork size={24} className="empty-icon" />
            </div>
            <h3>Visual Concept Map</h3>
            <p className="desc">
              Generate a dynamic mind map that clusters key findings, datasets, and cross-references across all papers in your notebook.
            </p>
            {trustedSources.length === 0 ? (
              <span className="badge badge-muted">Upload papers to activate</span>
            ) : !hasKeys ? (
              <span className="badge badge-muted">Configure API Keys to activate</span>
            ) : (
              <button className="btn-primary" onClick={generateDeepMindMap}>
                <Sparkles size={13} />
                <span>Deep Synthesis</span>
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && mermaidCode && (
          <div 
            className="canvas-viewport"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {/* The Render Target */}
            <div 
              ref={canvasRef} 
              className="mermaid-render-target" 
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.15s ease-out',
                display: 'inline-block',
                margin: 'auto'
              }}
            />
            
            {/* Floating controls */}
            <div className="floating-canvas-controls">
              <button onClick={() => setZoomLevel(z => Math.min(z + 0.15, 2.5))} title="Zoom In">
                <ZoomIn size={14} />
              </button>
              <button onClick={() => setZoomLevel(z => Math.max(z - 0.15, 0.4))} title="Zoom Out">
                <ZoomOut size={14} />
              </button>
              <button onClick={() => { setZoomLevel(1); setPan({x:0, y:0}); }} title="Reset Zoom">
                <Maximize2 size={14} />
              </button>
              <button onClick={handleDownloadPdf} title="Download PDF">
                <Download size={14} />
              </button>
              <button onClick={() => setMermaidCode('')} title="Reset Canvas">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .mindmap-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
        }
        .canvas-header {
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--border-color);
        }
        .title-area {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fork-icon {
          color: var(--color-brand);
        }
        .title-area h2 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 700;
        }
        .btn-sync {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--text-primary);
          background: var(--color-brand-glow);
          border: 1px solid var(--border-color-glow);
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: var(--radius-sm);
        }
        .btn-sync:hover:not(:disabled) {
          background: rgba(var(--color-brand-rgb), 0.2);
          border-color: var(--color-brand);
        }
        
        .spin-anim {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .canvas-area {
          flex-grow: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          background: var(--bg-primary);
        }
        
        .canvas-loading {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 24px;
          color: var(--text-secondary);
        }
        .canvas-loading h3 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          margin-top: 12px;
          margin-bottom: 6px;
          color: var(--text-primary);
        }
        .canvas-loading .hint {
          font-size: 11px;
          color: var(--text-muted);
        }

        .canvas-error {
          padding: 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }
        .error-msg {
          font-size: 12px;
          color: var(--color-danger);
          line-height: 1.5;
        }

        .canvas-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          max-width: 260px;
          padding: 20px;
        }
        .icon-glow {
          width: 44px;
          height: 44px;
          background: rgba(148, 163, 184, 0.05);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 14px;
        }
        .empty-icon {
          color: var(--text-muted);
        }
        .canvas-empty h3 {
          font-family: var(--font-display);
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .canvas-empty .desc {
          font-size: 11px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 16px;
        }

        .canvas-viewport {
          width: 100%;
          height: 100%;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: auto;
          position: relative;
        }
        .mermaid-render-target {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
        }

        /* Tabs styling */
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
          color: var(--text-primary);
          font-weight: 600;
        }
        .header-tab-desc {
          font-size: 11px;
          color: var(--text-muted);
          font-weight: 500;
        }

        .floating-canvas-controls {
          position: absolute;
          bottom: 16px;
          right: 16px;
          display: flex;
          gap: 6px;
          background: var(--bg-glass);
          backdrop-filter: blur(8px);
          border: 1px solid var(--border-color);
          padding: 4px;
          border-radius: var(--radius-md);
        }
        .floating-canvas-controls button {
          color: var(--text-secondary);
          padding: 6px;
          border-radius: var(--radius-sm);
          display: flex;
        }
        .floating-canvas-controls button:hover {
          background: rgba(148, 163, 184, 0.1);
          color: var(--text-primary);
        }
      `}</style>
    </div>
  );
};
