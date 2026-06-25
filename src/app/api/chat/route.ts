import { NextResponse } from 'next/server';
import CircuitBreaker from 'opossum';
import { cosineSimilarity } from '@/lib/vector-search';
import { generateEmbeddings } from '@/lib/embeddings';
import { supabase } from '@/lib/supabase';

// 1. Google Gemini API Request Executor
async function executeGeminiRequest(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number,
  enableSearch?: boolean
) {
  const contents = messages.map(msg => {
    const parts = [{ text: msg.content }];
    
    if (msg.image) {
      try {
        const [mimePart, base64Data] = msg.image.split(';base64,');
        const mimeType = mimePart.split('data:').pop() || 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType,
            data: base64Data
          }
        } as any);
      } catch (err) {
        console.error('Failed to parse base64 image for Gemini:', err);
      }
    }

    return {
      role: msg.sender === 'assistant' ? 'model' : 'user',
      parts
    };
  });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents,
    generationConfig: {
      temperature: temperature ?? 0.2,
      maxOutputTokens: maxTokens ?? 2048,
    }
  };

  if (enableSearch) {
    payload.tools = [{ google_search: {} }];
  }

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const textBody = await response.text();
  let resJson;
  try {
    resJson = JSON.parse(textBody);
  } catch (e) {
    if (!response.ok) throw new Error(`Gemini API returned status ${response.status}: ${textBody}`);
    resJson = {};
  }

  if (!response.ok) {
    const err = new Error(resJson.error?.message || `Gemini API returned status ${response.status}`);
    (err as any).status = response.status;
    throw err;
  }

  return resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// 2. Anthropic Claude API Request Executor
async function executeClaudeRequest(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
) {
  const formattedMessages = messages.map(msg => {
    let content: any = msg.content;
    
    if (msg.image) {
      try {
        const [mimePart, base64Data] = msg.image.split(';base64,');
        const media_type = mimePart.split('data:').pop() || 'image/jpeg';
        content = [
          {
            type: 'text',
            text: msg.content
          },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type,
              data: base64Data
            }
          }
        ];
      } catch (err) {
        console.error('Failed to parse base64 image for Claude:', err);
      }
    }

    return {
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      content
    };
  });

  const url = 'https://api.anthropic.com/v1/messages';

  const payload: any = {
    model,
    max_tokens: maxTokens ?? 2048,
    messages: formattedMessages,
    temperature: temperature ?? 0.2
  };

  if (systemInstruction) {
    payload.system = systemInstruction;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(payload)
  });

  const textBody = await response.text();
  let resJson;
  try {
    resJson = JSON.parse(textBody);
  } catch (e) {
    if (!response.ok) throw new Error(`Claude API returned status ${response.status}: ${textBody}`);
    resJson = {};
  }

  if (!response.ok) {
    const err = new Error(resJson.error?.message || `Claude API returned status ${response.status}`);
    (err as any).status = response.status;
    throw err;
  }

  return resJson.content?.[0]?.text || '';
}

// 3. OpenAI API / GitHub Models Request Executor
async function executeOpenAIRequest(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
) {
  const formattedMessages = [];
  
  if (systemInstruction) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction
    });
  }

  formattedMessages.push(...messages.map(msg => {
    let content: any = msg.content;
    
    if (msg.image) {
      content = [
        {
          type: 'text',
          text: msg.content
        },
        {
          type: 'image_url',
          image_url: {
            url: msg.image
          }
        }
      ];
    }

    return {
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      content
    };
  }));

  let url = 'https://api.openai.com/v1/chat/completions';
  const isGitHub = apiKey.startsWith('ghp_') || apiKey.startsWith('github_pat_');
  if (isGitHub) {
    url = 'https://models.github.ai/inference/chat/completions';
  }

  const payload = {
    model,
    messages: formattedMessages,
    temperature: temperature ?? 0.2,
    max_tokens: maxTokens ?? 2048
  };

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  };

  if (isGitHub) {
    headers['Accept'] = 'application/vnd.github+json';
    headers['X-GitHub-Api-Version'] = '2022-11-28';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  const textBody = await response.text();
  let resJson;
  try {
    resJson = JSON.parse(textBody);
  } catch (e) {
    if (!response.ok) throw new Error(`OpenAI/GitHub Models API returned status ${response.status}: ${textBody}`);
    resJson = {};
  }

  if (!response.ok) {
    const err = new Error(resJson.error?.message || `OpenAI/GitHub Models API returned status ${response.status}`);
    (err as any).status = response.status;
    throw err;
  }

  return resJson.choices?.[0]?.message?.content || '';
}

// Circuit Breaker Registry by User Key
const globalAny = globalThis as any;
// In dev, clear the registry on hot reload so updated functions are used
if (process.env.NODE_ENV !== 'production') {
  globalAny.breakerRegistry = new Map<string, any>();
} else if (!globalAny.breakerRegistry) {
  globalAny.breakerRegistry = new Map<string, any>();
}

function getBreaker(provider: string, apiKey: string) {
  const keyHash = `${provider}_${apiKey.substring(0, 12)}`;
  if (!globalAny.breakerRegistry.has(keyHash)) {
    let executor;
    if (provider === 'gemini') executor = executeGeminiRequest;
    else if (provider === 'claude') executor = executeClaudeRequest;
    else executor = executeOpenAIRequest;
    
    globalAny.breakerRegistry.set(keyHash, new CircuitBreaker(executor, {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 15000
    }));
  }
  return globalAny.breakerRegistry.get(keyHash);
}

// Helper to perform web search using DuckDuckGo HTML
async function searchWeb(query: string): Promise<string[]> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    if (!response.ok) return [];
    const html = await response.text();
    const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    const snippets: string[] = [];
    while ((match = snippetRegex.exec(html)) !== null && snippets.length < 5) {
      const snippet = match[1]
        .replace(/<[^>]*>/g, '')
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
      if (snippet) {
        snippets.push(snippet);
      }
    }
    return snippets;
  } catch (err) {
    console.error("DuckDuckGo search error:", err);
    return [];
  }
}

// Removed getPipeline() because we now decouple embedding logic to the Edge-based /api/embed endpoint

// POST endpoint handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, provider, temperature, maxTokens, enableSearch, documentIds } = body;
    let { model, systemInstruction } = body;

    if (model) {
      model = model.replace(/[\u2013\u2014]/g, '-').trim();
    }

    const geminiKey = request.headers.get('x-gemini-key');
    const anthropicKey = request.headers.get('x-anthropic-key');
    const openaiKey = request.headers.get('x-openai-key');

    if (!provider) {
      return NextResponse.json({ error: 'Missing "provider" in request body.' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid "messages" in request body.' }, { status: 400 });
    }

    // -------------------------------------------------------------
    // Semantic Retrieval (Hybrid Search via Supabase)
    // -------------------------------------------------------------
    if (documentIds && Array.isArray(documentIds) && documentIds.length > 0) {
      const lastUserMsg = messages.slice().reverse().find((m: any) => m.sender === 'user' || m.role === 'user');
      if (lastUserMsg && lastUserMsg.content) {
        console.log(`[Semantic Search] Embedding query: "${lastUserMsg.content}"`);
        
        const geminiKey = request.headers.get('x-gemini-key');
        const openaiKey = request.headers.get('x-openai-key');
        
        const queryEmbeddings = await generateEmbeddings(
          [lastUserMsg.content],
          provider,
          geminiKey,
          openaiKey
        );
        
        const queryVector = queryEmbeddings[0];

        // Fetch top 5 chunks using Hybrid Search RPC (RRF combining Full Text & Vector)
        // We filter by document_id to ensure we only search trusted/staged sources
        const { data: topChunks, error } = await supabase.rpc('hybrid_search', {
          query_text: lastUserMsg.content,
          query_embedding: queryVector,
          match_count: 5
        }).in('document_id', documentIds);

        if (error) {
          console.error("Supabase hybrid search failed:", error);
        } else if (topChunks && topChunks.length > 0) {
          systemInstruction = (systemInstruction || '') + `\n\nTrusted Sources Context Excerpts (Top 5 Hybrid Matches):\n`;
          topChunks.forEach((c: any, idx: number) => {
            systemInstruction += `\nExcerpt [${idx + 1}]:\n${c.content}\n`;
          });
          
          systemInstruction += `\n\nCRITICAL GROUNDING CONSTRAINT: You must only answer using the excerpts provided above. If the context does not contain the answer to the user's question, state 'I cannot answer this based on the provided documents.' Do not hallucinate external information.`;
        }
      }
    }

    // -------------------------------------------------------------
    // Case A: Load Balancing / Auto Mode
    // -------------------------------------------------------------
    if (provider === 'auto' || model === 'auto') {
      const pool: Array<{
        provider: 'gemini' | 'claude' | 'openai';
        apiKey: string;
        model: string;
        weight: number;
        breaker: any;
      }> = [];

      if (geminiKey && geminiKey.trim() !== '') {
        pool.push({
          provider: 'gemini',
          apiKey: geminiKey,
          model: 'gemini-3.5-flash',
          weight: 5,
          breaker: getBreaker('gemini', geminiKey)
        });
      }
      if (anthropicKey && anthropicKey.trim() !== '') {
        pool.push({
          provider: 'claude',
          apiKey: anthropicKey,
          model: 'claude-3-5-haiku-latest',
          weight: 2,
          breaker: getBreaker('claude', anthropicKey)
        });
      }
      if (openaiKey && openaiKey.trim() !== '') {
        const isGitHub = openaiKey.startsWith('ghp_') || openaiKey.startsWith('github_pat_');
        pool.push({
          provider: 'openai',
          apiKey: openaiKey,
          model: isGitHub ? 'gpt-4o-mini' : 'gpt-4o-mini',
          weight: 3,
          breaker: getBreaker('openai', openaiKey)
        });
      }

      if (pool.length === 0) {
        return NextResponse.json({ error: 'No active/verified API keys provided for Auto load-balancing.' }, { status: 400 });
      }

      // Randomized WRR selection (Stateless)
      const sequence: number[] = [];
      pool.forEach((p, idx) => {
        for (let i = 0; i < p.weight; i++) sequence.push(idx);
      });
      const startIndex = Math.floor(Math.random() * sequence.length);
      const initialPoolIdx = sequence[startIndex];

      let success = false;
      let content = '';
      let lastError = null;

      // Failover round robin attempts across distinct providers
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const poolIdx = (initialPoolIdx + attempt) % pool.length;
        const endpoint = pool[poolIdx];

        if (endpoint.breaker.opened) {
          console.warn(`[Load Balancer] Circuit breaker for ${endpoint.provider} (Key Hash: ${endpoint.apiKey.substring(0,6)}...) is OPEN. Skipping...`);
          continue;
        }

        let finalInstruction = systemInstruction;
        let isGeminiSearch = false;
        
        if (enableSearch) {
          if (endpoint.provider === 'gemini') {
            isGeminiSearch = true;
          } else {
            const lastUserMessage = messages.slice().reverse().find((msg: any) => msg.sender === 'user' || msg.role === 'user')?.content || '';
            if (lastUserMessage) {
              const searchResults = await searchWeb(lastUserMessage);
              if (searchResults.length > 0) {
                finalInstruction = (systemInstruction || '') + `\n\nWEB SEARCH RESULTS FOR GROUNDING:\n` +
                  searchResults.map((snippet, i) => `Result [${i + 1}]: "${snippet}"`).join('\n') + `\n\n`;
              }
            }
          }
        }

        try {
          console.log(`[Load Balancer] Attempt ${attempt + 1}: Routing to ${endpoint.provider} (${endpoint.model})`);
          content = await endpoint.breaker.fire(
            endpoint.apiKey,
            endpoint.model,
            messages,
            finalInstruction,
            temperature,
            maxTokens,
            isGeminiSearch
          );
          success = true;
          break;
        } catch (err: any) {
          console.error(`[Load Balancer] Request to ${endpoint.provider} failed:`, err.message || err);
          lastError = err;
        }
      }

      if (success) {
        return NextResponse.json({ content });
      } else {
        return NextResponse.json({
          error: lastError?.message === 'open'
            ? 'All available AI providers are currently circuit-broken (breakers OPEN).'
            : (lastError?.message || 'All load balancing attempts failed.')
        }, { status: 500 });
      }
    }

    // -------------------------------------------------------------
    // Case B: Direct Model Target Mode
    // -------------------------------------------------------------
    let enrichedSystemInstruction = systemInstruction || '';
    if (enableSearch && provider !== 'gemini') {
      const lastUserMessage = messages.slice().reverse().find((msg: any) => msg.sender === 'user' || msg.role === 'user')?.content || '';
      if (lastUserMessage) {
        const searchResults = await searchWeb(lastUserMessage);
        if (searchResults.length > 0) {
          enrichedSystemInstruction += `\n\nWEB SEARCH RESULTS FOR GROUNDING:\n` +
            searchResults.map((snippet, i) => `Result [${i + 1}]: "${snippet}"`).join('\n') + `\n\n`;
        }
      }
    }

    if (provider === 'gemini') {
      if (!geminiKey) return NextResponse.json({ error: 'Gemini API Key is missing.' }, { status: 400 });
      try {
        const text = await getBreaker('gemini', geminiKey).fire(geminiKey, model, messages, enrichedSystemInstruction, temperature, maxTokens, enableSearch);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ error: err.message === 'open' ? 'Gemini service is disabled (Circuit Breaker OPEN).' : (err.message || 'Gemini error') }, { status: err.status || 500 });
      }
    } 
    
    if (provider === 'claude') {
      if (!anthropicKey) return NextResponse.json({ error: 'Claude API Key is missing.' }, { status: 400 });
      try {
        const text = await getBreaker('claude', anthropicKey).fire(anthropicKey, model, messages, enrichedSystemInstruction, temperature, maxTokens);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ error: err.message === 'open' ? 'Claude service is disabled (Circuit Breaker OPEN).' : (err.message || 'Claude error') }, { status: err.status || 500 });
      }
    } 
    
    if (provider === 'openai') {
      if (!openaiKey) return NextResponse.json({ error: 'OpenAI/GitHub Key is missing.' }, { status: 400 });
      try {
        const text = await getBreaker('openai', openaiKey).fire(openaiKey, model, messages, enrichedSystemInstruction, temperature, maxTokens);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ error: err.message === 'open' ? 'OpenAI/GitHub service disabled (Circuit Breaker OPEN).' : (err.message || 'OpenAI/GitHub error') }, { status: err.status || 500 });
      }
    }

    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
