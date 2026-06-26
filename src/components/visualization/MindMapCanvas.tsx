'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { GitFork, Sparkles, RefreshCw, Layers, ZoomIn, ZoomOut, Download, Maximize2, Trash2 } from 'lucide-react';
import mermaid from 'mermaid';

// Unique counter to prevent ID collisions in Mermaid renders
let renderIdCounter = 0;

export const MindMapCanvas: React.FC = () => {
  const { 
    trustedSources, 
    apiKeys, 
    modelConfig,
    activeCenterTab,
    setActiveCenterTab
  } = useWorkspace();
  const [mermaidCode, setMermaidCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize Mermaid on mount
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        securityLevel: 'loose',
        themeVariables: {
          background: '#0f172a',
          primaryColor: '#6366f1',
          primaryTextColor: '#f8fafc',
          lineColor: '#64748b',
          fontSize: '13px'
        }
      });
    } catch (err) {
      console.error('Failed to initialize Mermaid:', err);
    }
  }, []);

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

  const generateMindMap = async () => {
    if (trustedSources.length === 0) return;
    setIsLoading(true);
    setError(null);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKeys.gemini) headers['x-gemini-key'] = apiKeys.gemini;
    if (apiKeys.claude) headers['x-anthropic-key'] = apiKeys.claude;
    if (apiKeys.openai) headers['x-openai-key'] = apiKeys.openai;

    // Create a corpus summary for the LLM
    const corpusSummary = trustedSources.map((doc, idx) => 
      `Paper [${idx + 1}]: "${doc.title}"\nAbstract: ${doc.abstract}\nAuthors: ${doc.authors.join(', ')}`
    ).join('\n\n');

    const prompt = `You are a research visualization expert. Analyze the following academic papers inside the user's notebook and generate a structured mind map representing the key connections, main themes, methodologies, and findings.

Papers:
${corpusSummary}

CRITICAL INSTRUCTIONS:
1. Return the output strictly as a Mermaid.js mindmap syntax.
2. The code block must start with "mindmap" on its own line.
3. Keep labels short and concise (1-4 words per node).
4. Use standard indents to define relationships.
5. Do not include extra comments, markdown formatting, or HTML tags inside the mindmap block.
6. Return ONLY the mermaid code block inside a \`\`\`mermaid codeblock.

Example output format:
\`\`\`mermaid
mindmap
  root((Multi-Paper Synthesis))
    Theme A
      Subtopic 1
      Subtopic 2
    Theme B
      Methodology X
      Finding Y
\`\`\`
`;

    try {
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
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate mind map.');
      }

      // Extract mermaid block
      const content = data.content;
      const mermaidMatch = content.match(/```mermaid\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*mindmap\s*([\s\S]*?)\s*```/) ||
                           [null, content];
                           
      let extractedCode = mermaidMatch[1]?.trim() || content.trim();

      // Ensure it starts with mindmap
      if (!extractedCode.startsWith('mindmap')) {
        extractedCode = 'mindmap\n' + extractedCode;
      }

      setMermaidCode(extractedCode);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to synthesize papers into a mind map.');
    } finally {
      setIsLoading(false);
    }
  };

  const hasKeys = !!(apiKeys.gemini || apiKeys.claude || apiKeys.openai);

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
          <button 
            className="btn-sync" 
            onClick={generateMindMap} 
            disabled={isLoading}
            title="Regenerate Mind Map"
          >
            <RefreshCw size={13} className={isLoading ? 'spin-anim' : ''} />
            <span>{mermaidCode ? 'Re-sync' : 'Generate'}</span>
          </button>
        )}
      </div>

      {/* 2. Main Render Canvas Area */}
      <div className="canvas-area">
        {isLoading && (
          <div className="canvas-loading animate-fade-in">
            <div className="spinner"></div>
            <h3>Synthesizing Documents...</h3>
            <p className="hint">Extracting topics, grouping methodologies, and formatting mind map nodes.</p>
          </div>
        )}

        {!isLoading && error && (
          <div className="canvas-error animate-fade-in">
            <p className="error-msg">{error}</p>
            <button className="btn-secondary" onClick={generateMindMap}>Try Again</button>
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
              <button className="btn-primary" onClick={generateMindMap}>
                <Sparkles size={13} />
                <span>Generate Mind Map</span>
              </button>
            )}
          </div>
        )}

        {!isLoading && !error && mermaidCode && (
          <div className="canvas-viewport">
            {/* The Render Target */}
            <div 
              ref={canvasRef} 
              className="mermaid-render-target" 
              style={{
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: 'transform 0.15s ease-out',
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
              <button onClick={() => setZoomLevel(1)} title="Reset Zoom">
                <Maximize2 size={14} />
              </button>
              <button onClick={() => window.print()} title="Print / Export PDF">
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
          background: rgba(10, 15, 29, 0.25);
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
          background: #080c16;
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

        .floating-canvas-controls {
          position: absolute;
          bottom: 16px;
          right: 16px;
          display: flex;
          gap: 6px;
          background: rgba(15, 23, 42, 0.85);
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
