import { NextResponse } from 'next/server';
import CircuitBreaker from 'opossum';

// 1. Google Gemini API Request Executor
async function executeGeminiRequest(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
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

  const resJson = await response.json();

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

  const resJson = await response.json();

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
  if (apiKey.startsWith('ghp_') || apiKey.startsWith('github_pat_')) {
    url = 'https://models.inference.ai.azure.com/chat/completions';
  }

  const payload = {
    model,
    messages: formattedMessages,
    temperature: temperature ?? 0.2,
    max_tokens: maxTokens ?? 2048
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload)
  });

  const resJson = await response.json();

  if (!response.ok) {
    const err = new Error(resJson.error?.message || `OpenAI/GitHub Models API returned status ${response.status}`);
    (err as any).status = response.status;
    throw err;
  }

  return resJson.choices?.[0]?.message?.content || '';
}

// Initialize global circuit breakers in Next.js hot-reload safe way
const globalAny = globalThis as any;
if (!globalAny.geminiBreaker) {
  globalAny.geminiBreaker = new CircuitBreaker(executeGeminiRequest, {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000
  });
}
if (!globalAny.claudeBreaker) {
  globalAny.claudeBreaker = new CircuitBreaker(executeClaudeRequest, {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000
  });
}
if (!globalAny.openaiBreaker) {
  globalAny.openaiBreaker = new CircuitBreaker(executeOpenAIRequest, {
    timeout: 30000,
    errorThresholdPercentage: 50,
    resetTimeout: 15000
  });
}

// POST endpoint handler
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, systemInstruction, provider, temperature, maxTokens } = body;
    let { model } = body;

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

      if (geminiKey) {
        pool.push({
          provider: 'gemini',
          apiKey: geminiKey,
          model: 'gemini-3.5-flash',
          weight: 5,
          breaker: globalAny.geminiBreaker
        });
      }
      if (anthropicKey) {
        pool.push({
          provider: 'claude',
          apiKey: anthropicKey,
          model: 'claude-3-5-haiku-latest',
          weight: 2,
          breaker: globalAny.claudeBreaker
        });
      }
      if (openaiKey) {
        const isGitHub = openaiKey.startsWith('ghp_') || openaiKey.startsWith('github_pat_');
        pool.push({
          provider: 'openai',
          apiKey: openaiKey,
          model: isGitHub ? 'gpt-4o-mini' : 'gpt-4o-mini',
          weight: 3,
          breaker: globalAny.openaiBreaker
        });
      }

      if (pool.length === 0) {
        return NextResponse.json({ error: 'No active/verified API keys provided for Auto load-balancing.' }, { status: 400 });
      }

      // Stateful WRR sequence construction
      const sequence: number[] = [];
      const activeWeights = pool.map(p => p.weight);
      const currentWeights = [...activeWeights];
      const totalWeight = activeWeights.reduce((sum, w) => sum + w, 0);

      for (let i = 0; i < totalWeight; i++) {
        let maxIdx = 0;
        let maxVal = -1;
        for (let j = 0; j < currentWeights.length; j++) {
          if (currentWeights[j] > maxVal) {
            maxVal = currentWeights[j];
            maxIdx = j;
          }
        }
        sequence.push(maxIdx);
        currentWeights[maxIdx] -= totalWeight;
        for (let j = 0; j < currentWeights.length; j++) {
          currentWeights[j] += activeWeights[j];
        }
      }

      if (globalAny.lbCounter === undefined) {
        globalAny.lbCounter = 0;
      }
      const startIndex = globalAny.lbCounter % sequence.length;
      globalAny.lbCounter++;

      let success = false;
      let content = '';
      let lastError = null;

      // Failover round robin attempts
      for (let attempt = 0; attempt < pool.length; attempt++) {
        const seqIdx = (startIndex + attempt) % sequence.length;
        const poolIdx = sequence[seqIdx];
        const endpoint = pool[poolIdx];

        if (endpoint.breaker.opened) {
          console.warn(`[Load Balancer] Circuit breaker for ${endpoint.provider} is OPEN. Skipping...`);
          continue;
        }

        try {
          console.log(`[Load Balancer] Attempt ${attempt + 1}: Routing to ${endpoint.provider} (${endpoint.model})`);
          content = await endpoint.breaker.fire(
            endpoint.apiKey,
            endpoint.model,
            messages,
            systemInstruction,
            temperature,
            maxTokens
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
    if (!model) {
      return NextResponse.json({ error: 'Missing "model" in request body.' }, { status: 400 });
    }

    if (provider === 'gemini') {
      if (!geminiKey) {
        return NextResponse.json({ error: 'Gemini API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      try {
        const text = await globalAny.geminiBreaker.fire(geminiKey, model, messages, systemInstruction, temperature, maxTokens);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ 
          error: err.message === 'open' ? 'Gemini service is temporarily disabled (Circuit Breaker OPEN).' : (err.message || 'Gemini error')
        }, { status: err.status || 500 });
      }
    } 
    
    if (provider === 'claude') {
      if (!anthropicKey) {
        return NextResponse.json({ error: 'Claude API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      try {
        const text = await globalAny.claudeBreaker.fire(anthropicKey, model, messages, systemInstruction, temperature, maxTokens);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ 
          error: err.message === 'open' ? 'Claude service is temporarily disabled (Circuit Breaker OPEN).' : (err.message || 'Claude error')
        }, { status: err.status || 500 });
      }
    } 
    
    if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json({ error: 'OpenAI/GitHub Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      try {
        const text = await globalAny.openaiBreaker.fire(openaiKey, model, messages, systemInstruction, temperature, maxTokens);
        return NextResponse.json({ content: text });
      } catch (err: any) {
        return NextResponse.json({ 
          error: err.message === 'open' ? 'OpenAI/GitHub service is temporarily disabled (Circuit Breaker OPEN).' : (err.message || 'OpenAI/GitHub error')
        }, { status: err.status || 500 });
      }
    }

    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
