export interface TextChunk {
  id: string; // docId_chunkIndex
  documentId: string;
  documentTitle: string;
  text: string;
  index: number;
  embedding?: number[];
}

/**
 * Split markdown content semantically based on headers.
 */
export function chunkMarkdown(docId: string, title: string, markdown: string): TextChunk[] {
  // Use regex to match headers: lines starting with 1 to 6 '#' characters.
  // This split preserves the header line within the chunk if we split before it.
  const regex = /(?=^#{1,6}\s+)/m;
  const rawChunks = markdown.split(regex);
  
  const chunks: TextChunk[] = [];
  let index = 0;
  
  for (const rc of rawChunks) {
    const text = rc.trim();
    if (text.length < 50) continue; // skip very tiny artifacts or empty sections
    
    // If a section is excessively large (> 2000 chars), we might want to split it by paragraphs.
    if (text.length > 2500) {
      const paragraphs = text.split(/\n\s*\n/);
      let currentChunk = '';
      for (const p of paragraphs) {
        if ((currentChunk.length + p.length) > 2500) {
          chunks.push({
            id: `${docId}_${index++}`,
            documentId: docId,
            documentTitle: title,
            text: currentChunk.trim(),
            index: index - 1
          });
          currentChunk = p;
        } else {
          currentChunk += (currentChunk ? '\n\n' : '') + p;
        }
      }
      if (currentChunk.trim().length > 50) {
        chunks.push({
          id: `${docId}_${index++}`,
          documentId: docId,
          documentTitle: title,
          text: currentChunk.trim(),
          index: index - 1
        });
      }
    } else {
      chunks.push({
        id: `${docId}_${index++}`,
        documentId: docId,
        documentTitle: title,
        text,
        index: index - 1
      });
    }
  }
  
  return chunks;
}

/**
 * Calculate cosine similarity between two vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
