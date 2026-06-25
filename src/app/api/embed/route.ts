import { NextResponse } from 'next/server';

// Helper to chunk array for batching limits
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function POST(request: Request) {
  try {
    const { texts, provider: requestedProvider } = await request.json();
    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: 'Missing or invalid texts array.' }, { status: 400 });
    }

    const geminiKey = request.headers.get('x-gemini-key');
    const openaiKey = request.headers.get('x-openai-key');

    let provider = requestedProvider;
    
    if (provider === 'auto' || provider === 'claude') {
      // Claude has no native embedding API, and 'auto' needs a fallback
      if (geminiKey) provider = 'gemini';
      else if (openaiKey) provider = 'openai';
      else return NextResponse.json({ error: 'No API keys available for embeddings. Provide Gemini or OpenAI.' }, { status: 400 });
    }

    if (provider === 'gemini') {
      if (!geminiKey) return NextResponse.json({ error: 'Gemini API Key missing for embeddings.' }, { status: 400 });
      
      // Gemini batchEmbedContents accepts up to 100 requests per batch
      const batches = chunkArray(texts, 100);
      const allEmbeddings: number[][] = [];
      
      for (const batch of batches) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${geminiKey}`;
        const payload = {
          requests: batch.map(text => ({
            model: "models/gemini-embedding-001",
            content: { parts: [{ text }] }
          }))
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`Gemini Embedding API Error: ${errData}`);
        }
        
        const data = await response.json();
        const batchEmbeddings = data.embeddings.map((e: any) => e.values);
        allEmbeddings.push(...batchEmbeddings);
      }
      return NextResponse.json({ embeddings: allEmbeddings });
    }
    
    if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'OpenAI API Key missing for embeddings.' }, { status: 400 });
      
      // OpenAI max batch size is 2048
      const batches = chunkArray(texts, 2000);
      const allEmbeddings: number[][] = [];
      
      const isGitHub = openaiKey.startsWith('ghp_') || openaiKey.startsWith('github_pat_');
      let url = 'https://api.openai.com/v1/embeddings';
      if (isGitHub) {
         url = 'https://models.github.ai/inference/embeddings';
      }
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      };
      
      if (isGitHub) {
        headers['Accept'] = 'application/vnd.github+json';
        headers['X-GitHub-Api-Version'] = '2022-11-28';
      }
      
      for (const batch of batches) {
        const payload = {
          input: batch,
          model: "text-embedding-3-small"
        };
        
        const response = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
          const errData = await response.text();
          throw new Error(`OpenAI Embedding API Error: ${errData}`);
        }
        
        const data = await response.json();
        // OpenAI returns data ordered by index
        data.data.sort((a: any, b: any) => a.index - b.index);
        const batchEmbeddings = data.data.map((d: any) => d.embedding);
        allEmbeddings.push(...batchEmbeddings);
      }
      return NextResponse.json({ embeddings: allEmbeddings });
    }
    
    return NextResponse.json({ error: `Invalid provider for embeddings: ${provider}` }, { status: 400 });

  } catch (err: any) {
    console.error('Embedding error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate embeddings' }, { status: 500 });
  }
}
