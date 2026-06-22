import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, systemInstruction, provider, temperature, maxTokens } = body;
    let { model } = body;

    // Normalize any copy-pasted en-dash (U+2013) or em-dash (U+2014) to standard hyphen
    if (model) {
      model = model.replace(/[\u2013\u2014]/g, '-').trim();
    }

    // Retrieve keys from headers
    const geminiKey = request.headers.get('x-gemini-key');
    const anthropicKey = request.headers.get('x-anthropic-key');
    const openaiKey = request.headers.get('x-openai-key');

    if (!provider) {
      return NextResponse.json({ error: 'Missing "provider" in request body.' }, { status: 400 });
    }

    if (!model) {
      return NextResponse.json({ error: 'Missing "model" in request body.' }, { status: 400 });
    }

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Missing or invalid "messages" in request body.' }, { status: 400 });
    }

    if (provider === 'gemini') {
      if (!geminiKey) {
        return NextResponse.json({ error: 'Gemini API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      return await handleGemini(geminiKey, model, messages, systemInstruction, temperature, maxTokens);
    } 
    
    if (provider === 'claude') {
      if (!anthropicKey) {
        return NextResponse.json({ error: 'Claude API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      return await handleClaude(anthropicKey, model, messages, systemInstruction, temperature, maxTokens);
    } 
    
    if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json({ error: 'OpenAI API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      return await handleOpenAI(openaiKey, model, messages, systemInstruction, temperature, maxTokens);
    }

    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// 1. Google Gemini API Handler (Multimodal)
async function handleGemini(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
) {
  // Convert messages to Gemini format (user -> user, assistant -> model, with multimodal support)
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

  // Switch to the stable v1 endpoint for stable models like gemini-1.5-flash
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

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
    return NextResponse.json({ 
      error: resJson.error?.message || `Gemini API returned status ${response.status}` 
    }, { status: response.status });
  }

  const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return NextResponse.json({ content: text });
}

// 2. Anthropic Claude API Handler (Multimodal)
async function handleClaude(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
) {
  // Convert messages to Claude format with multimodal support
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
    return NextResponse.json({ 
      error: resJson.error?.message || `Claude API returned status ${response.status}` 
    }, { status: response.status });
  }

  const text = resJson.content?.[0]?.text || '';
  return NextResponse.json({ content: text });
}

// 3. OpenAI API Handler (Multimodal)
async function handleOpenAI(
  apiKey: string, 
  model: string, 
  messages: any[], 
  systemInstruction?: string,
  temperature?: number,
  maxTokens?: number
) {
  // Convert messages to OpenAI format with multimodal support
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
            url: msg.image // OpenAI natively accepts the entire data URL (data:image/jpeg;base64,...)
          }
        }
      ];
    }

    return {
      role: msg.sender === 'assistant' ? 'assistant' : 'user',
      content
    };
  }));

  const url = 'https://api.openai.com/v1/chat/completions';

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
    return NextResponse.json({ 
      error: resJson.error?.message || `OpenAI API returned status ${response.status}` 
    }, { status: response.status });
  }

  const text = resJson.choices?.[0]?.message?.content || '';
  return NextResponse.json({ content: text });
}
