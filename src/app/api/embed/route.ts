import { NextResponse } from 'next/server';
import { generateEmbeddings } from '@/lib/embeddings';

export const maxDuration = 60; // Prevent 504 Vercel timeout errors

export async function POST(request: Request) {
  try {
    const { texts, provider: requestedProvider } = await request.json();
    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: 'Missing or invalid texts array.' }, { status: 400 });
    }

    const geminiKey = request.headers.get('x-gemini-key');
    const openaiKey = request.headers.get('x-openai-key');

    const embeddings = await generateEmbeddings(texts, requestedProvider, geminiKey, openaiKey);
    return NextResponse.json({ embeddings });

  } catch (err: any) {
    console.error('Embedding error:', err);
    // Determine status based on error message mapping
    const status = err.message.includes('missing') || err.message.includes('Invalid') ? 400 : 500;
    return NextResponse.json({ error: err.message || 'Failed to generate embeddings' }, { status });
  }
}
