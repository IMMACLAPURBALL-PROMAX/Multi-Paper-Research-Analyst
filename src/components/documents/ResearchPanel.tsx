'use client';

import React, { useState } from 'react';
import { useWorkspace } from '@/context/WorkspaceContext';
import { DocumentSource } from '@/types';
import { Search, Flame, Calendar, Sparkles, ChevronRight } from 'lucide-react';

export const ResearchPanel: React.FC = () => {
  const {
    stagedSources,
    searchPapers,
    isSearching,
    searchError,
    activeStagedPaper,
    setActiveStagedPaper
  } = useWorkspace();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchEngine, setSearchEngine] = useState<'all' | 'arxiv' | 'semanticscholar' | 'pubmed' | 'openalex' | 'core'>('all');

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;
    await searchPapers(searchQuery, searchEngine);
  };

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

          <div className="search-engine-selector">
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'all' ? 'active' : ''}`}
              onClick={() => setSearchEngine('all')}
              disabled={isSearching}
            >
              All
            </button>
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'arxiv' ? 'active' : ''}`}
              onClick={() => setSearchEngine('arxiv')}
              disabled={isSearching}
            >
              arXiv
            </button>
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'semanticscholar' ? 'active' : ''}`}
              onClick={() => setSearchEngine('semanticscholar')}
              disabled={isSearching}
            >
              S. Scholar
            </button>
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'pubmed' ? 'active' : ''}`}
              onClick={() => setSearchEngine('pubmed')}
              disabled={isSearching}
            >
              PubMed
            </button>
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'openalex' ? 'active' : ''}`}
              onClick={() => setSearchEngine('openalex')}
              disabled={isSearching}
            >
              OpenAlex
            </button>
            <button
              type="button"
              className={`engine-btn ${searchEngine === 'core' ? 'active' : ''}`}
              onClick={() => setSearchEngine('core')}
              disabled={isSearching}
            >
              CORE
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
            <span>
              {searchEngine === 'all'
                ? 'Querying multiple databases...'
                : searchEngine === 'arxiv'
                ? 'Querying arXiv...'
                : searchEngine === 'semanticscholar'
                ? 'Querying Semantic Scholar...'
                : searchEngine === 'pubmed'
                ? 'Querying PubMed...'
                : searchEngine === 'openalex'
                ? 'Querying OpenAlex...'
                : 'Querying CORE API...'}
            </span>
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
                    {paper.id.startsWith('arxiv_') ? 'arXiv' 
                      : paper.id.startsWith('pubmed_') ? 'PubMed' 
                      : paper.id.startsWith('openalex_') ? 'OpenAlex' 
                      : paper.id.startsWith('core_') ? 'CORE' 
                      : 'Semantic Scholar'}
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
                    {paper.metadata.publicationDate || paper.metadata.publishedYear || 'Preprint'}
                  </span>
                  <ChevronRight size={14} className="arrow-icon" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Drawer removed (rendered in Workspace layout) */}

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
        
        .search-engine-selector {
          display: flex;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid var(--border-color);
          padding: 2px;
          border-radius: var(--radius-sm);
          margin-top: 8px;
        }
        .engine-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 4px 8px;
          border-radius: calc(var(--radius-sm) - 2px);
          font-size: 10px;
          font-weight: 500;
          cursor: pointer;
          transition: all var(--transition-fast);
          text-align: center;
        }
        .engine-btn:hover:not(:disabled) {
          color: var(--text-primary);
        }
        .engine-btn.active {
          background: var(--color-brand-glow);
          border: 1px solid var(--border-color-glow);
          color: #fff;
          font-weight: 600;
        }
        .engine-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
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


      `}</style>
    </div>
  );
};
