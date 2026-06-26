import { NextResponse } from 'next/server';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { generateEmbeddings } from '@/lib/embeddings';
import { supabase } from '@/lib/supabase';

export const maxDuration = 60; // Prevent 504 Vercel timeout errors

export async function POST(request: Request) {
  try {
    const { documentId, markdown, provider, geminiKey, openaiKey } = await request.json();

    if (!documentId || !markdown) {
      return NextResponse.json({ error: 'Missing documentId or markdown content.' }, { status: 400 });
    }

    // 1. Chunking using Langchain
    // We use a chunkSize of 1000 and overlap of 200 as reasonable defaults for academic papers
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docChunks = await splitter.createDocuments([markdown]);
    const chunkTexts = docChunks.map(chunk => chunk.pageContent);

    if (chunkTexts.length === 0) {
       return NextResponse.json({ error: 'No text chunks extracted.' }, { status: 400 });
    }

    // 2. Generate Embeddings
    const embeddings = await generateEmbeddings(chunkTexts, provider, geminiKey, openaiKey);

    if (embeddings.length !== chunkTexts.length) {
       throw new Error('Mismatch between chunk count and embedding count returned from API.');
    }

    // 3. Store in Supabase pgvector
    const rows = chunkTexts.map((text, i) => ({
      document_id: documentId,
      content: text,
      embedding: embeddings[i]
    }));

    // We can insert them in batches if there are thousands, but usually ~100-300 chunks per paper
    // Supabase insert can handle 1000+ rows easily.
    const { error } = await supabase
      .from('document_chunks')
      .insert(rows);

    if (error) {
       console.error("Supabase insert error:", error);
       throw new Error(`Failed to store chunks in database: ${error.message}`);
    }

    return NextResponse.json({ success: true, chunksCount: rows.length });

  } catch (err: any) {
    console.error('Ingestion error:', err);
    return NextResponse.json({ error: err.message || 'Failed to ingest document.' }, { status: 500 });
  }
}
