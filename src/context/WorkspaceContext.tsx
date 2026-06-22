'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { DocumentSource, ChatMessage, APIKeys, ModelConfig } from '@/types';
import { db, getSources, addSource, deleteSource, promoteSource, getMessages, addMessage, clearWorkspaceMessages } from '@/lib/db';
import { extractTextFromPdf } from '@/lib/pdf-extractor';
import { TFIDFSearchEngine } from '@/lib/tf-idf';

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
  searchPapers: (query: string) => Promise<DocumentSource[]>;
  promotePaperToTrusted: (id: string) => Promise<void>;
  discardStagedPaper: (id: string) => Promise<void>;
  sendWorkspaceMessage: (text: string, image?: string) => Promise<void>;
  sendStagedPaperMessage: (paperId: string, text: string) => Promise<void>;
  clearWorkspaceChat: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextProps | undefined>(undefined);

const defaultModelConfig: ModelConfig = {
  provider: 'gemini',
  model: 'gemini-3.5-flash',
  temperature: 0.2,
  maxTokens: 2048,
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

  // 3. Document upload
  const uploadPDF = async (file: File) => {
    setIsUploading(true);
    setUploadProgress({ processed: 0, total: 100 });
    setChatError(null);
    try {
      // Extract text client-side
      const fullText = await extractTextFromPdf(file, (processed, total) => {
        setUploadProgress({ processed, total });
      });

      // Simple metadata parse
      const paperId = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const authors = ['Local Upload'];
      
      const newDoc: DocumentSource = {
        id: paperId,
        title: file.name.replace(/\.[^/.]+$/, ""), // Strip extension
        authors,
        abstract: `Uploaded PDF file: ${file.name}. Size: ${(file.size / 1024 / 1024).toFixed(2)} MB.`,
        fullTextContent: fullText,
        metadata: {
          url: '',
          pdfUrl: '',
          publicationDate: new Date().toISOString().split('T')[0],
          publishedYear: new Date().getFullYear(),
          venue: 'My Notebook'
        },
        status: 'promoted', // Local uploads go directly into trusted area
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
  const searchPapers = async (query: string): Promise<DocumentSource[]> => {
    setIsSearching(true);
    setSearchError(null);
    try {
      const headers: Record<string, string> = {};
      if (apiKeys.semanticScholar) {
        headers['x-semanticscholar-key'] = apiKeys.semanticScholar;
      }
      
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=12`, {
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
  const executeChatRequest = async (messages: ChatMessage[], systemInstruction?: string) => {
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
        maxTokens: modelConfig.maxTokens
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
1. Ground your answers strictly in the provided text segments. If the text segments do not contain enough information to answer the question, state: "I cannot find the answer in the uploaded documents."
2. Never hallucinate details or cite papers outside of the provided context.
3. Reference the papers in your response by using bracketed citation numbers (e.g., [1], [2]) corresponding to the index in the "Trusted Sources Context" list below.
4. If there are no trusted documents in the notebook yet, politely tell the user to upload PDF papers or search and promote papers to their notebook.
`;

      let groundedSources: Array<{ id: string; title: string }> = [];

      if (trustedSources.length > 0) {
        // Run client-side TF-IDF RAG
        const searchEngine = new TFIDFSearchEngine(trustedSources);
        const searchResults = searchEngine.search(text, 6);

        systemInstruction += `\n\nTrusted Sources Context:\n`;
        searchResults.forEach((res, i) => {
          const citationIdx = i + 1;
          systemInstruction += `\n[${citationIdx}] Document: "${res.chunk.documentTitle}" (ID: ${res.chunk.documentId})\n`;
          systemInstruction += `Excerpt: ${res.chunk.text}\n`;
          
          if (!groundedSources.some(s => s.id === res.chunk.documentId)) {
            groundedSources.push({ id: res.chunk.documentId, title: res.chunk.documentTitle });
          }
        });
      } else {
        systemInstruction += `\nNo documents have been promoted to the trusted notebook yet.`;
      }

      // Query AI provider proxy
      // Provide conversational history (limit to last 10 messages to save context/tokens)
      const conversationalHistory = [...mainChatHistory, userMsg].slice(-10);
      const aiReply = await executeChatRequest(conversationalHistory, systemInstruction);

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
      // If we have full text, chunk it or just grab the top TF-IDF match for this specific document.
      let docContext = `Document Title: "${paper.title}"\n`;
      docContext += `Authors: ${paper.authors.join(', ')}\n`;
      
      if (paper.fullTextContent) {
        // Run TF-IDF search on just this single staged paper
        const searchEngine = new TFIDFSearchEngine([paper]);
        const results = searchEngine.search(text, 5);
        docContext += `\nRelevant text segments from this paper:\n`;
        results.forEach((res, i) => {
          docContext += `Excerpt ${i+1}:\n${res.chunk.text}\n\n`;
        });
      } else {
        docContext += `\nAbstract:\n${paper.abstract}\n`;
      }

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
      const conversation = [...currentStagedHistory, userMsg].slice(-8);

      const aiReply = await executeChatRequest(conversation, systemInstruction);

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
      clearWorkspaceChat
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
