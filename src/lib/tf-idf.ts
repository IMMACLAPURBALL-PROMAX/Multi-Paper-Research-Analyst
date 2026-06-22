import { DocumentSource } from '@/types';

export interface TextChunk {
  id: string; // docId_chunkIndex
  documentId: string;
  documentTitle: string;
  text: string;
  index: number;
}

// Simple English stopwords list to filter out noisy terms
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can\'t', 'cannot', 'could', 'couldn\'t',
  'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during',
  'each',
  'few', 'for', 'from', 'further',
  'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here',
  'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s',
  'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself',
  'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself',
  'no', 'nor', 'not',
  'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own',
  'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such',
  'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'there\'s', 'these',
  'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve', 'this', 'those', 'through', 'to', 'too', 'under', 'until',
  'up', 'very',
  'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when',
  'when\'s', 'where', 'where\'s', 'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t',
  'would', 'wouldn\'t',
  'you', 'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Tokenizes text into lowercase words, removing punctuation and stopwords.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // remove punctuation
    .split(/[\s_]+/) // split by spaces or underscores
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}

/**
 * Chunks a document's fullTextContent into overlapping windows.
 */
export function chunkDocument(doc: DocumentSource, chunkSize = 1000, overlap = 200): TextChunk[] {
  const content = doc.fullTextContent || doc.abstract;
  if (!content) return [];

  const chunks: TextChunk[] = [];
  let startIndex = 0;
  let index = 0;

  while (startIndex < content.length) {
    const endIndex = Math.min(startIndex + chunkSize, content.length);
    let chunkText = content.substring(startIndex, endIndex);

    // Try to adjust chunk boundary to avoid cutting words/sentences
    if (endIndex < content.length) {
      const lastSpace = chunkText.lastIndexOf(' ');
      const lastPeriod = chunkText.lastIndexOf('. ');
      const boundary = lastPeriod > 0 ? lastPeriod + 1 : lastSpace;
      
      if (boundary > chunkSize / 2) {
        chunkText = chunkText.substring(0, boundary);
      }
    }

    chunks.push({
      id: `${doc.id}_${index}`,
      documentId: doc.id,
      documentTitle: doc.title,
      text: chunkText.trim(),
      index
    });

    startIndex += chunkText.length - overlap;
    // Prevent infinite loop if overlap >= chunkText length
    if (chunkText.length <= overlap) {
      startIndex = endIndex;
    }
    index++;
  }

  return chunks;
}

export interface SearchResult {
  chunk: TextChunk;
  score: number;
}

/**
 * Lightweight client-side RAG search engine using TF-IDF and Cosine Similarity.
 */
export class TFIDFSearchEngine {
  private chunks: TextChunk[] = [];
  private tokenizedChunks: string[][] = [];
  private idfMap: Map<string, number> = new Map();
  private chunkVectors: Map<string, Map<string, number>> = new Map();

  constructor(documents: DocumentSource[]) {
    // 1. Chunk all documents
    for (const doc of documents) {
      this.chunks.push(...chunkDocument(doc));
    }

    // 2. Tokenize chunks
    this.tokenizedChunks = this.chunks.map(chunk => tokenize(chunk.text));

    // 3. Build vocabulary and Document Frequency (DF)
    const docFrequency = new Map<string, number>();
    const totalDocs = this.chunks.length;

    this.tokenizedChunks.forEach(tokens => {
      const uniqueTokens = new Set(tokens);
      uniqueTokens.forEach(token => {
        docFrequency.set(token, (docFrequency.get(token) || 0) + 1);
      });
    });

    // 4. Calculate Inverse Document Frequency (IDF)
    docFrequency.forEach((df, term) => {
      // idf = log(1 + (N / df))
      const idf = Math.log(1 + totalDocs / df);
      this.idfMap.set(term, idf);
    });

    // 5. Build TF-IDF vectors for all chunks
    this.chunks.forEach((chunk, i) => {
      const tokens = this.tokenizedChunks[i];
      const termCounts = new Map<string, number>();
      
      tokens.forEach(token => {
        termCounts.set(token, (termCounts.get(token) || 0) + 1);
      });

      const vector = new Map<string, number>();
      let maxTermFreq = 0;
      termCounts.forEach((count) => {
        if (count > maxTermFreq) maxTermFreq = count;
      });

      termCounts.forEach((count, term) => {
        // TF-IDF = (count / maxFreq) * IDF
        const tf = count / maxTermFreq;
        const idf = this.idfMap.get(term) || 0;
        vector.set(term, tf * idf);
      });

      this.chunkVectors.set(chunk.id, vector);
    });
  }

  /**
   * Search query similarity against chunks. Returns top results.
   */
  public search(query: string, limit = 5): SearchResult[] {
    const queryTokens = tokenize(query);
    if (queryTokens.length === 0 || this.chunks.length === 0) {
      // Fallback: return first few chunks
      return this.chunks.slice(0, limit).map(chunk => ({ chunk, score: 0 }));
    }

    // Build query vector
    const queryTermCounts = new Map<string, number>();
    queryTokens.forEach(token => {
      queryTermCounts.set(token, (queryTermCounts.get(token) || 0) + 1);
    });

    const queryVector = new Map<string, number>();
    queryTermCounts.forEach((count, term) => {
      const idf = this.idfMap.get(term) || 0;
      queryVector.set(term, count * idf);
    });

    // Compute magnitude of query vector
    let queryMagnitude = 0;
    queryVector.forEach(val => {
      queryMagnitude += val * val;
    });
    queryMagnitude = Math.sqrt(queryMagnitude);

    if (queryMagnitude === 0) {
      return this.chunks.slice(0, limit).map(chunk => ({ chunk, score: 0 }));
    }

    const results: SearchResult[] = [];

    // Calculate Cosine Similarity for each chunk
    this.chunks.forEach(chunk => {
      const chunkVector = this.chunkVectors.get(chunk.id);
      if (!chunkVector) return;

      // Compute dot product and magnitude of chunk vector
      let dotProduct = 0;
      let chunkMagnitude = 0;

      chunkVector.forEach((val, term) => {
        chunkMagnitude += val * val;
        if (queryVector.has(term)) {
          dotProduct += val * (queryVector.get(term) || 0);
        }
      });
      
      chunkMagnitude = Math.sqrt(chunkMagnitude);

      let similarity = 0;
      if (chunkMagnitude > 0) {
        similarity = dotProduct / (queryMagnitude * chunkMagnitude);
      }

      // Boost score if the query terms match the document title (basic metadata reinforcement)
      const queryTitleMatch = queryTokens.filter(token => 
        chunk.documentTitle.toLowerCase().includes(token)
      ).length;
      similarity += queryTitleMatch * 0.05;

      results.push({ chunk, score: similarity });
    });

    // Sort by descending score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }
}
