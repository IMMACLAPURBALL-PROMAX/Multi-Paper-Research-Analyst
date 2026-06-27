'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DocumentSource, ChatMessage, APIKeys, ModelConfig } from '@/types';
import { db, getSources, addSource, deleteSource, promoteSource, getMessages, addMessage, clearWorkspaceMessages } from '@/lib/db';
import { chunkMarkdown } from '@/lib/vector-search';
import { savePdfToLocal, deletePdfFromLocal } from '@/lib/indexeddb';

interface WorkspaceContextProps {
  // Sources
  trustedSources: DocumentSource[];
  stagedSources: DocumentSource[];
  activeStagedPaper: DocumentSource | null;
  
  // Chats
  mainChatHistory: ChatMessage[];
  stagedChats: Record<string, ChatMessage[]>;
  activeStagedChat: ChatMessage[];
  
  // Settings
  apiKeys: APIKeys;
  modelConfig: ModelConfig;
  
  // Loading flags
  isSearching: boolean;
  isChatting: boolean;
  isUploading: boolean;
  uploadProgress: { processed: number; total: number } | null;
  searchError: string | null;
  chatError: string | null;
  
  // Actions
  setActiveStagedPaper: (paper: DocumentSource | null) => void;
  updateApiKeys: (keys: APIKeys) => void;
  updateModelConfig: (config: ModelConfig) => void;
  uploadPDF: (file: File) => Promise<void>;
  searchPapers: (query: string, engine?: 'all' | 'arxiv' | 'semanticscholar') => Promise<DocumentSource[]>;
  promotePaperToTrusted: (id: string) => Promise<void>;
  discardStagedPaper: (id: string) => Promise<void>;
  sendWorkspaceMessage: (text: string, image?: string) => Promise<void>;
  sendStagedPaperMessage: (paperId: string, text: string) => Promise<void>;
  clearWorkspaceChat: () => Promise<void>;
  activeCenterTab: 'chat' | 'canvas' | 'viewer';
  setActiveCenterTab: (tab: 'chat' | 'canvas' | 'viewer') => void;
  selectedViewerDocId: string | null;
  setSelectedViewerDocId: (id: string | null) => void;
  isInlineViewerOpen: boolean;
  setIsInlineViewerOpen: (open: boolean) => void;
  activeTheme: 'purple' | 'coral' | 'amber' | 'teal' | 'plains';
  updateTheme: (theme: 'purple' | 'coral' | 'amber' | 'teal' | 'plains') => void;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(undefined);

const defaultModelConfig: ModelConfig = {
  provider: 'auto',
  model: 'auto',
  temperature: 0.2,
  maxTokens: 1024,
};

const WORKSPACE_ID = 'default-workspace'; // Supporting single workspace for simplicity

export const WorkspaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [trustedSources, setTrustedSources] = useState<DocumentSource[]>([]);
  const [stagedSources, setStagedSources] = useState<DocumentSource[]>([]);
  const [activeStagedPaper, setActiveStagedPaperState] = useState<DocumentSource | null>(null);
  
  const [mainChatHistory, setMainChatHistory] = useState<ChatMessage[]>([]);
  const [stagedChats, setStagedChats] = useState<Record<string, ChatMessage[]>>({});
  
  const [apiKeys, setApiKeys] = useState<APIKeys>({});
  const [modelConfig, setModelConfig] = useState<ModelConfig>(defaultModelConfig);
  
  const [isSearching, setIsSearching] = useState(false);
  const [isChatting, setIsChatting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ processed: number; total: number } | null>(null);
  
  const [searchError, setSearchError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activeCenterTab, setActiveCenterTab] = useState<'chat' | 'canvas' | 'viewer'>('chat');
  const [selectedViewerDocId, setSelectedViewerDocId] = useState<string | null>(null);
  const [isInlineViewerOpen, setIsInlineViewerOpen] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<'purple' | 'coral' | 'amber' | 'teal' | 'plains'>('purple');

  // Load cached theme from localStorage on mount
  useEffect(() => {
    const cachedTheme = localStorage.getItem('workspace_theme');
    if (cachedTheme) {
      setActiveTheme(cachedTheme as any);
    }
  }, []);

  // Sync theme css variables to document root
  useEffect(() => {
    const root = document.documentElement;
    const colors = {
      purple: { brand: '#6366f1', hover: '#4f46e5', rgb: '99, 102, 241', glow: 'rgba(99, 102, 241, 0.15)', borderGlow: 'rgba(99, 102, 241, 0.25)' },
      coral: { brand: '#FF6B6B', hover: '#FF5252', rgb: '255, 107, 107', glow: 'rgba(255, 107, 107, 0.15)', borderGlow: 'rgba(255, 107, 107, 0.25)' },
      amber: { brand: '#FFC300', hover: '#E6B000', rgb: '255, 195, 0', glow: 'rgba(255, 195, 0, 0.15)', borderGlow: 'rgba(255, 195, 0, 0.25)' },
      teal: { brand: '#2EC4B6', hover: '#259E92', rgb: '46, 196, 182', glow: 'rgba(46, 196, 182, 0.15)', borderGlow: 'rgba(46, 196, 182, 0.25)' },
      plains: { brand: '#A9DFBF', hover: '#8FD4A8', rgb: '169, 223, 191', glow: 'rgba(169, 223, 191, 0.15)', borderGlow: 'rgba(169, 223, 191, 0.25)' }
    }[activeTheme];

    if (colors) {
      root.style.setProperty('--color-brand', colors.brand);
      root.style.setProperty('--color-brand-hover', colors.hover);
      root.style.setProperty('--color-brand-rgb', colors.rgb);
      root.style.setProperty('--color-brand-glow', colors.glow);
      root.style.setProperty('--border-color-glow', colors.borderGlow);
      root.style.setProperty('--shadow-glow', `0 0 20px 0 ${colors.glow}`);
    }
  }, [activeTheme]);

  const updateTheme = (theme: 'purple' | 'coral' | 'amber' | 'teal' | 'plains') => {
    setActiveTheme(theme);
    localStorage.setItem('workspace_theme', theme);
  };

  // 1. Initial Load: Load sources, main chat and keys from sessionStorage/IndexedDB
  useEffect(() => {
    async function loadData() {
      try {
        // Load API keys and config from sessionStorage (BYOK - session bound)
        const cachedKeys = sessionStorage.getItem('research_api_keys');
        const cachedConfig = sessionStorage.getItem('research_model_config');
        if (cachedKeys) setApiKeys(JSON.parse(cachedKeys));
        if (cachedConfig) setModelConfig(JSON.parse(cachedConfig));

        // Load files from IndexedDB
        const trusted = await getSources('promoted');
        const staged = await getSources('staged');
        setTrustedSources(trusted);
        setStagedSources(staged);

        // Load main chat messages
        const msgs = await getMessages(WORKSPACE_ID, null);
        setMainChatHistory(msgs.map(m => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          timestamp: m.timestamp,
          sources: m.sources
        })));
      } catch (err) {
        console.error('Error initializing database:', err);
      }
    }
    loadData();
  }, []);

  // Sync staged chats when active staged paper changes
  useEffect(() => {
    if (!activeStagedPaper) return;
    
    async function loadStagedChat() {
      const msgs = await getMessages(WORKSPACE_ID, activeStagedPaper!.id);
      setStagedChats(prev => ({
        ...prev,
        [activeStagedPaper!.id]: msgs.map(m => ({
          id: m.id,
          sender: m.sender,
          content: m.content,
          timestamp: m.timestamp,
          sources: m.sources
        }))
      }));
    }
    loadStagedChat();
  }, [activeStagedPaper]);

  const activeStagedChat = activeStagedPaper ? (stagedChats[activeStagedPaper.id] || []) : [];

  const setActiveStagedPaper = (paper: DocumentSource | null) => {
    setActiveStagedPaperState(paper);
  };

  // 2. Settings management
  const updateApiKeys = (keys: APIKeys) => {
    setApiKeys(keys);
    sessionStorage.setItem('research_api_keys', JSON.stringify(keys));
  };

  const updateModelConfig = (config: ModelConfig) => {
    setModelConfig(config);
    sessionStorage.setItem('research_model_config', JSON.stringify(config));
  };

  const uploadPDF = async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ processed: 10, total: 100 });
    setChatError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      // 1. Parse PDF to Markdown
      const parseRes = await fetch('/api/parse', {
        method: 'POST',
        body: formData
      });
      
      if (!parseRes.ok) {
        throw new Error('Failed to parse PDF on the server.');
      }
      
      const { markdown } = await parseRes.json();
      setUploadProgress({ processed: 50, total: 100 });

      const paperId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const title = file.name.replace(/\.[^/.]+$/, "");

      // Save PDF locally for Viewer
      await savePdfToLocal(paperId, file);

      // 2. Ingest Markdown to Supabase
      const ingestRes = await fetch('/api/ingest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId: paperId,
          markdown,
          provider: modelConfig.provider,
          geminiKey: apiKeys.gemini || '',
          openaiKey: apiKeys.openai || ''
        })
      });

      if (!ingestRes.ok) {
         let errMsg = "Failed to process document into vector database.";
         try {
           const errBody = await ingestRes.json();
           if (errBody.error) {
             if (errBody.error.includes("429") || errBody.error.includes("quota")) {
               errMsg = "Rate limit exceeded! The AI provider's quota was reached. Please wait a moment and try reuploading the PDF.";
             } else {
               errMsg = errBody.error;
             }
           }
         } catch(e) {
           // fallback if not json
         }
         console.error("Ingestion failed:", errMsg);
         throw new Error(errMsg);
      }
      
      setUploadProgress({ processed: 100, total: 100 });

      const authors = ['Local Upload'];
      
      const newDoc: DocumentSource = {
        id: paperId,
        title,
        authors,
        abstract: `Uploaded PDF file: ${file.name}. Size: ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
        fullTextContent: markdown,
        chunks: [], // We no longer store chunks locally, they live in Supabase
        metadata: {
          url: '',
          pdfUrl: '',
          publicationDate: new Date().toISOString().split('T')[0],
          publishedYear: new Date().getFullYear(),
          venue: 'My Notebook'
        },
        status: 'promoted',
        addedAt: Date.now()
      };

      await addSource(newDoc);
      setTrustedSources(prev => [...prev, newDoc]);
    } catch (err: any) {
      console.error('PDF extraction failed:', err);
      setChatError(`Failed to process PDF: ${err.message || err}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  };

  // 4. Academic Search
  const searchPapers = async (query: string, engine: 'all' | 'arxiv' | 'semanticscholar' = 'all'): Promise<DocumentSource[]> => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKeys.semanticScholar) {
        headers['x-semanticscholar-key'] = apiKeys.semanticScholar;
      }
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12&engine=${engine}`, {
        headers
      });
      
      if (!response.ok) {
        throw new Error('Search failed to execute.');
      }
      
      const data = await response.json();
      
      if (data.warning) {
        setSearchError(data.warning);
      }
      
      const papers: DocumentSource[] = data.papers || [];

      // Save found papers to staging area in database
      for (const paper of papers) {
        // Only save to db if not already present in trusted or staged list
        const exists = await db.sources.get(paper.id);
        if (!exists) {
          await addSource(paper);
          setStagedSources(prev => [...prev, paper]);
        }
      }
      return papers;
    } catch (err: any) {
      setSearchError(err.message || 'Failed to fetch search results.');
      return [];
    } finally {
      setIsSearching(false);
    }
  };

  // 5. Promote staged paper to trusted sources
  const promotePaperToTrusted = async (id: string) => {
    try {
      await promoteSource(id);
      
      // Update UI state
      const paper = stagedSources.find(p => p.id === id);
      if (paper) {
        const updatedPaper = { ...paper, status: 'promoted' as const };
        setTrustedSources(prev => [...prev, updatedPaper]);
        setStagedSources(prev => prev.filter(p => p.id !== id));
        if (activeStagedPaper?.id === id) {
          setActiveStagedPaperState(updatedPaper);
        }
      }
    } catch (err) {
      console.error('Promotion failed:', err);
    }
  };

  // 6. Discard staged or promoted paper
  const discardStagedPaper = async (id: string) => {
    try {
      await deleteSource(id);
      await deletePdfFromLocal(id);
      
      // Delete chunks from Supabase
      await fetch(`/api/chunks/${id}`, { method: 'DELETE' }).catch(err => console.error('Failed to delete Supabase chunks:', err));

      setStagedSources(prev => prev.filter(p => p.id !== id));
      setTrustedSources(prev => prev.filter(p => p.id !== id));
      if (activeStagedPaper?.id === id) {
        setActiveStagedPaperState(null);
      }
    } catch (err) {
      console.error('Discard failed:', err);
    }
  };

  // Helper to fetch chat completion
  const executeChatRequest = async (messages: ChatMessage[], systemInstruction?: string, enableSearch = false, documentIds: string[] = []) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKeys.gemini) headers['x-gemini-key'] = apiKeys.gemini;
    if (apiKeys.claude) headers['x-anthropic-key'] = apiKeys.claude;
    if (apiKeys.openai) headers['x-openai-key'] = apiKeys.openai;

    const response = await fetch('/api/chat', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages,
        systemInstruction,
        provider: modelConfig.provider,
        model: modelConfig.model,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        enableSearch,
        documentIds
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to communicate with AI provider.');
    }
    return data.content;
  };

  // 7. Grounded chat message in main workspace (trusted sources only)
  const sendWorkspaceMessage = async (text: string, image?: string) => {
    if ((!text.trim() && !image) || isChatting) return;

    setIsChatting(true);
    setChatError(null);

    // Create user message
    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: Date.now(),
      image
    };

    // Prepend user message to local state immediately for responsiveness
    setMainChatHistory(prev => [...prev, userMsg]);
    await addMessage({
      ...userMsg,
      workspaceId: WORKSPACE_ID,
      documentId: null
    });

    try {
      let systemInstruction = `You are a professional multi-paper research analyst assistant. 
Your goal is to answer the user's questions objectively, based ONLY on the provided trusted documents.

CRITICAL INSTRUCTIONS:
1. You have two sources of information: The "Active Notebook Documents" catalog (which contains full abstracts) AND the "Trusted Sources Context Excerpts" (which contain specific paragraphs).
2. The abstracts in the Active Notebook Documents catalog are completely sufficient for summarizing what a paper is about. DO NOT refuse to summarize a paper just because there are no matching Excerpts for it.
3. Ground your answers strictly in the provided information. If the combined context does not contain the answer, state: "I cannot find the answer in the uploaded documents."
4. Never hallucinate details or cite papers outside of the provided context.
5. Reference the papers in your response by using bracketed citation numbers (e.g., [1], [2]) corresponding to the Document number.
`;

      let groundedSources: Array<{ id: string; title: string }> = [];
      const conversationalHistory = [...mainChatHistory, userMsg].slice(-6);
      
      if (trustedSources.length > 0) {
        // 1. Inject a global catalog of active notebook documents with their abstracts
        systemInstruction += `\n\nActive Notebook Documents (Total: ${trustedSources.length}):\n`;
        for (let idx = 0; idx < trustedSources.length; idx++) {
          const doc = trustedSources[idx];
          const docNum = idx + 1;
          
          let abstractText = doc.abstract;
          if (!abstractText || abstractText.trim() === '') {
            try {
              const res = await fetch(`/api/chunks/${doc.id}`);
              if (res.ok) {
                const data = await res.json();
                if (data.chunks && data.chunks.length > 0) {
                  abstractText = data.chunks.slice(0, 3).map((c: any) => c.content).join('\n...\n');
                }
              }
            } catch (e) {
              console.error("Failed to fetch fallback chunks for chat prompt", e);
            }
          }

          systemInstruction += `\n[Document ${docNum}] Title: "${doc.title}" (Source ID: ${doc.id})\n`;
          systemInstruction += `Authors: ${doc.authors.join(', ')}\n`;
          systemInstruction += `Abstract/Summary: ${abstractText || 'No abstract available.'}\n`;
        }

        // 2. Identify the document IDs to search over
        const trustedIds = trustedSources.map(doc => doc.id);
        const activeIdsSet = new Set(trustedIds);

        // Smart Pruning & Token Reduction: Keep max 6 messages, filter out deleted paper citations
        const prunedHistory = conversationalHistory.filter(msg => {
          if (msg.sender === 'user') return true;
          if (msg.sources && msg.sources.length > 0) {
             return msg.sources.every(source => activeIdsSet.has(source.id));
          }
          return true;
        });

        // Track grounded sources
        groundedSources = trustedSources.map(doc => ({ id: doc.id, title: doc.title }));

        // Pass document IDs to backend for semantic search & retrieval
        const hasScannedDoc = trustedSources.some(doc => doc.hasNoText);
        const aiReply = await executeChatRequest(prunedHistory, systemInstruction, hasScannedDoc, trustedIds);

        // Create assistant reply
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'assistant',
          content: aiReply,
          timestamp: Date.now(),
          sources: groundedSources
        };

        setMainChatHistory(prev => [...prev, assistantMsg]);
        await addMessage({
          ...assistantMsg,
          workspaceId: WORKSPACE_ID,
          documentId: null
        });
      } else {
        systemInstruction += `\nNo documents have been promoted to the trusted notebook yet.`;

        const aiReply = await executeChatRequest(conversationalHistory, systemInstruction, false);

        // Create assistant reply
        const assistantMsg: ChatMessage = {
          id: `msg_${Date.now() + 1}`,
          sender: 'assistant',
          content: aiReply,
          timestamp: Date.now(),
          sources: []
        };

        setMainChatHistory(prev => [...prev, assistantMsg]);
        await addMessage({
          ...assistantMsg,
          workspaceId: WORKSPACE_ID,
          documentId: null
        });
      }

      // RAG debugger logged manually or removed.

    } catch (err: any) {
      console.error('Chat error:', err);
      setChatError(err.message || 'AI request failed. Please check your API key and connection.');
      // Remove user message from list on failure so they can retry
      setMainChatHistory(prev => prev.filter(m => m.id !== userMsg.id));
      await db.messages.delete(userMsg.id);
    } finally {
      setIsChatting(false);
    }
  };

  // 8. Grounded chat message in specific staged or promoted paper preview
  const sendStagedPaperMessage = async (paperId: string, text: string) => {
    if (!text.trim() || isChatting) return;

    const paper = stagedSources.find(p => p.id === paperId) || trustedSources.find(p => p.id === paperId);
    if (!paper) return;

    setIsChatting(true);
    setChatError(null);

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: Date.now()
    };

    // Update staged chat list in state
    setStagedChats(prev => ({
      ...prev,
      [paperId]: [...(prev[paperId] || []), userMsg]
    }));
    
    await addMessage({
      ...userMsg,
      workspaceId: WORKSPACE_ID,
      documentId: paperId
    });

    try {
      const fullText = paper.fullTextContent || paper.abstract;
      // We truncate document full text if it's too long, but staged abstract is small.
      let docContext = `Document Title: "${paper.title}"\n`;
      docContext += `Authors: ${paper.authors.join(', ')}\n`;
      
      const isPromoted = paper.status === 'promoted';
      const systemInstruction = `You are a research analyst reviewing a ${isPromoted ? 'promoted notebook' : 'staged (unverified)'} paper.
Your goal is to answer questions ONLY about this specific paper: "${paper.title}".

CRITICAL INSTRUCTIONS:
1. Ground your answers strictly in the document details provided below.
${isPromoted ? '' : '2. If the user asks general research questions, remind them that this paper is staged and they must promote it to the notebook to combine it with other sources.\n'}3. Be precise, objective, and cite only this document.

Paper Details:
${docContext}
`;

      const currentStagedHistory = stagedChats[paperId] || [];
      const conversation = [...currentStagedHistory, userMsg].slice(-4);
      const isScanned = !!paper.hasNoText;

      const aiReply = await executeChatRequest(conversation, systemInstruction, isScanned, [paper.id]);

      const assistantMsg: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        sender: 'assistant',
        content: aiReply,
        timestamp: Date.now(),
        sources: [{ id: paper.id, title: paper.title }]
      };

      setStagedChats(prev => ({
        ...prev,
        [paperId]: [...(prev[paperId] || []), assistantMsg]
      }));

      await addMessage({
        ...assistantMsg,
        workspaceId: WORKSPACE_ID,
        documentId: paperId
      });

    } catch (err: any) {
      console.error('Staged chat error:', err);
      setChatError(err.message || 'AI request failed.');
      // Rollback
      setStagedChats(prev => ({
        ...prev,
        [paperId]: (prev[paperId] || []).filter(m => m.id !== userMsg.id)
      }));
      await db.messages.delete(userMsg.id);
    } finally {
      setIsChatting(false);
    }
  };

  // 9. Clear workspace chat
  const clearWorkspaceChat = async () => {
    try {
      await clearWorkspaceMessages(WORKSPACE_ID);
      setMainChatHistory([]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      trustedSources,
      stagedSources,
      activeStagedPaper,
      mainChatHistory,
      stagedChats,
      activeStagedChat,
      apiKeys,
      modelConfig,
      isSearching,
      isChatting,
      isUploading,
      uploadProgress,
      searchError,
      chatError,
      setActiveStagedPaper,
      updateApiKeys,
      updateModelConfig,
      uploadPDF,
      searchPapers,
      promotePaperToTrusted,
      discardStagedPaper,
      sendWorkspaceMessage,
      sendStagedPaperMessage,
      clearWorkspaceChat,
      activeCenterTab,
      setActiveCenterTab,
      selectedViewerDocId,
      setSelectedViewerDocId,
      isInlineViewerOpen,
      setIsInlineViewerOpen,
      activeTheme,
      updateTheme
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
};
