export interface PaperMetadata {
  citationCount?: number;
  venue?: string;
  publicationDate?: string;
  publishedYear?: number;
  arXivId?: string;
  doi?: string;
  url?: string;
  pdfUrl?: string;
}

export interface DocumentSource {
  id: string; // Unique ID (e.g. UUID, arXiv ID, or MD5 hash of filename)
  title: string;
  authors: string[];
  abstract: string;
  fullTextContent?: string; // Loaded client-side from local upload
  metadata: PaperMetadata;
  status: 'staged' | 'promoted';
  addedAt: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: number;
  // Documents referenced in grounding
  sources?: Array<{ id: string; title: string }>;
  image?: string; // Optional Base64 Data URL
}

export interface APIKeys {
  gemini?: string;
  claude?: string;
  openai?: string;
  semanticScholar?: string;
}

export interface ModelConfig {
  provider: 'gemini' | 'claude' | 'openai';
  model: string;
  temperature: number;
  maxTokens: number;
}

export interface Workspace {
  id: string;
  name: string;
  createdAt: number;
}
