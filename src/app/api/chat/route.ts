import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages, systemInstruction, provider, model } = body;

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
      return await handleGemini(geminiKey, model, messages, systemInstruction);
    } 
    
    if (provider === 'claude') {
      if (!anthropicKey) {
        return NextResponse.json({ error: 'Claude API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      return await handleClaude(anthropicKey, model, messages, systemInstruction);
    } 
    
    if (provider === 'openai') {
      if (!openaiKey) {
        return NextResponse.json({ error: 'OpenAI API Key is missing. Please configure it in Settings.' }, { status: 400 });
      }
      return await handleOpenAI(openaiKey, model, messages, systemInstruction);
    }

    return NextResponse.json({ error: `Unsupported provider: ${provider}` }, { status: 400 });

  } catch (error: any) {
    console.error('API Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

// 1. Google Gemini API Handler
async function handleGemini(apiKey: string, model: string, messages: any[], systemInstruction?: string) {
  // Convert messages to Gemini format (user -> user, assistant -> model)
  const contents = messages.map(msg => ({
    role: msg.sender === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }]
  }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload: any = {
    contents,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
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

// 2. Anthropic Claude API Handler
async function handleClaude(apiKey: string, model: string, messages: any[], systemInstruction?: string) {
  // Convert messages to Claude format
  const formattedMessages = messages.map(msg => ({
    role: msg.sender === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  }));

  const url = 'https://api.anthropic.com/v1/messages';

  const payload: any = {
    model,
    max_tokens: 2048,
    messages: formattedMessages,
    temperature: 0.2
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

// 3. OpenAI API Handler
async function handleOpenAI(apiKey: string, model: string, messages: any[], systemInstruction?: string) {
  // Convert messages to OpenAI format
  const formattedMessages = [];
  
  if (systemInstruction) {
    formattedMessages.push({
      role: 'system',
      content: systemInstruction
    });
  }

  formattedMessages.push(...messages.map(msg => ({
    role: msg.sender === 'assistant' ? 'assistant' : 'user',
    content: msg.content
  })));

  const url = 'https://api.openai.com/v1/chat/completions';

  const payload = {
    model,
    messages: formattedMessages,
    temperature: 0.2,
    max_tokens: 2048
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
