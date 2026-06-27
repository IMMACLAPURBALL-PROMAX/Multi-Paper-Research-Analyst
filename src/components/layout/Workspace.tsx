'use client';

import React, { useState } from 'react';
import { WorkspaceProvider, useWorkspace } from '@/context/WorkspaceContext';
import { TrustedPanel } from '@/components/documents/TrustedPanel';
import { ResearchPanel } from '@/components/documents/ResearchPanel';
import { PreviewDrawer } from '@/components/documents/PreviewDrawer';
import { MainChat } from '@/components/chat/MainChat';
import { MindMapCanvas } from '@/components/visualization/MindMapCanvas';
import { DocumentViewer } from '@/components/documents/DocumentViewer';
import { KeyConfigModal } from '@/components/layout/KeyConfigModal';
import { BookOpen, Sparkles } from 'lucide-react';

const InnerWorkspace: React.FC<{
  activeLeftTab: 'notebook' | 'research';
  setActiveLeftTab: (tab: 'notebook' | 'research') => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}> = ({ activeLeftTab, setActiveLeftTab, isSettingsOpen, setIsSettingsOpen }) => {
  const { activeCenterTab } = useWorkspace();

  return (
    <div className="workspace-container">
      {/* Left Column - Navigation and Sources */}
      <div className="workspace-column left-col">
        {/* Tab Switcher Header */}
        <div className="column-tabs border-bottom">
          <button
            className={`tab-btn ${activeLeftTab === 'notebook' ? 'active' : ''}`}
            onClick={() => setActiveLeftTab('notebook')}
          >
            <BookOpen size={14} />
            <span>Notebook</span>
          </button>
          
          <button
            className={`tab-btn tab-btn-research ${activeLeftTab === 'research' ? 'active' : ''}`}
            onClick={() => setActiveLeftTab('research')}
          >
            <Sparkles size={14} />
            <span>Research Mode</span>
          </button>
        </div>

        {/* Active Panel Display */}
        <div className="active-panel-container">
          {activeLeftTab === 'notebook' ? (
            <TrustedPanel onOpenSettings={() => setIsSettingsOpen(true)} />
          ) : (
            <ResearchPanel />
          )}
        </div>

      </div>

      {/* Center Column - Grounded Chat, Concept Canvas, or Document Viewer */}
      <div className="workspace-column center-col">
        {activeCenterTab === 'chat' && <MainChat />}
        {activeCenterTab === 'canvas' && <MindMapCanvas />}
        {activeCenterTab === 'viewer' && <DocumentViewer />}
        <PreviewDrawer />
      </div>

      {/* Settings Modal */}
      <KeyConfigModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
};

export const Workspace: React.FC = () => {
  const [activeLeftTab, setActiveLeftTab] = useState<'notebook' | 'research'>('notebook');
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);

  return (
    <WorkspaceProvider>
      <InnerWorkspace 
        activeLeftTab={activeLeftTab}
        setActiveLeftTab={setActiveLeftTab}
        isSettingsOpen={isSettingsOpen}
        setIsSettingsOpen={setIsSettingsOpen}
      />

      <style jsx global>{`
        .workspace-container {
          display: grid;
          grid-template-columns: 310px 1fr;
          height: 100vh;
          width: 100vw;
          background-color: var(--bg-primary);
          overflow: hidden;
        }
        
        .workspace-column {
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        
        .left-col {
          border-right: 1px solid var(--border-color);
          background: rgba(10, 15, 29, 0.5);
          position: relative;
        }
        
        .center-col {
          background: var(--bg-secondary);
          position: relative;
        }
        
        .border-bottom {
          border-bottom: 1px solid var(--border-color);
        }
        
        /* Tab switcher styles */
        .column-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          background: rgba(15, 23, 42, 0.8);
          padding: 4px;
        }
        
        .tab-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 10px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
          border-radius: var(--radius-sm);
          transition: all var(--transition-fast);
        }
        
        .tab-btn:hover {
          color: var(--text-primary);
          background: rgba(148, 163, 184, 0.05);
        }
        
        .tab-btn.active {
          color: #fff;
          background: var(--color-brand-glow);
          border: 1px solid var(--border-color-glow);
        }
        
        .tab-btn-research.active {
          color: #fff;
          background: rgba(245, 158, 11, 0.12);
          border-color: rgba(245, 158, 11, 0.25);
        }
        
        .active-panel-container {
          flex-grow: 1;
          overflow: hidden;
        }
        
        /* Responsive tweaks */
        @media (max-width: 1024px) {
          .workspace-container {
            grid-template-columns: 260px 1fr;
          }
        }
      `}</style>
    </WorkspaceProvider>
  );
};
