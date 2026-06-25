// Helper to chunk array for batching limits
function chunkArray<T>(arr: T[], size: number): T[][] {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function generateEmbeddings(
  texts: string[],
  requestedProvider: string,
  geminiKey?: string | null,
  openaiKey?: string | null
): Promise<number[][]> {
  let provider = requestedProvider;
  
  if (provider === 'auto' || provider === 'claude') {
    if (geminiKey) provider = 'gemini';
    else if (openaiKey) provider = 'openai';
    else throw new Error('No API keys available for embeddings. Provide Gemini or OpenAI.');
  }

  if (provider === 'gemini') {
    if (!geminiKey) throw new Error('Gemini API Key missing for embeddings.');
    
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
    return allEmbeddings;
  }
  
  if (provider === 'openai') {
    if (!openaiKey) throw new Error('OpenAI API Key missing for embeddings.');
    
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
      data.data.sort((a: any, b: any) => a.index - b.index);
      const batchEmbeddings = data.data.map((d: any) => d.embedding);
      allEmbeddings.push(...batchEmbeddings);
    }
    return allEmbeddings;
  }
  
  throw new Error(`Invalid provider for embeddings: ${provider}`);
}
