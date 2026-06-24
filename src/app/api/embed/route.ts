import { NextResponse } from 'next/server';

let pipelineInstance: any = null;

async function getPipeline() {
  if (!pipelineInstance) {
    const { pipeline, env } = await import('@huggingface/transformers');
    
    // Disable local model loading to fetch directly from HF Hub (safe for serverless)
    env.allowLocalModels = false;
    
    // Force the AI model to cache inside Vercel's writable temporary directory
    env.cacheDir = "/tmp/.cache";

    // Force WebAssembly to bypass the missing .so Linux files in standard Node runtime
    (env.backends as any).setPriority(['wasm', 'cpu']);
    
    pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      quantized: true,
    });
  }
  return pipelineInstance;
}

export async function POST(request: Request) {
  try {
    const { texts } = await request.json();
    if (!texts || !Array.isArray(texts)) {
      return NextResponse.json({ error: 'Missing or invalid texts array.' }, { status: 400 });
    }

    const embedder = await getPipeline();
    const embeddings: number[][] = [];

    // Process all texts sequentially or in parallel
    for (const text of texts) {
      // Mean pooling and normalization are typical for sentence embeddings
      const output = await embedder(text, { pooling: 'mean', normalize: true });
      embeddings.push(Array.from(output.data));
    }

    return NextResponse.json({ embeddings });
  } catch (err: any) {
    console.error('Embedding error:', err);
    return NextResponse.json({ error: err.message || 'Failed to generate embeddings' }, { status: 500 });
  }
}
