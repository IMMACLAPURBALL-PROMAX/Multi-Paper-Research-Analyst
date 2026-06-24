import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { provider, apiKey } = await request.json();
    if (!provider || !apiKey) {
      return NextResponse.json({ valid: false, error: 'Missing provider or apiKey.' }, { status: 400 });
    }

    let isValid = false;
    let errorMessage = '';

    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        isValid = true;
      } else {
        const json = await res.json().catch(() => ({}));
        errorMessage = json.error?.message || `Google API returned status ${res.status}`;
      }
    } 
    else if (provider === 'claude') {
      const url = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-latest',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'Ping' }]
        })
      });
      if (res.ok) {
        isValid = true;
      } else {
        const json = await res.json().catch(() => ({}));
        errorMessage = json.error?.message || `Anthropic API returned status ${res.status}`;
      }
    } 
    else if (provider === 'openai') {
      const isGitHub = apiKey.startsWith('ghp_') || apiKey.startsWith('github_pat_');
      
      if (isGitHub) {
        const url = 'https://models.inference.ai.azure.com/chat/completions';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Ping' }]
          })
        });
        if (res.ok) {
          isValid = true;
        } else {
          const json = await res.json().catch(() => ({}));
          errorMessage = json.error?.message || `GitHub Models API returned status ${res.status}`;
        }
      } else {
        const url = 'https://api.openai.com/v1/models';
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiKey}`
          }
        });
        if (res.ok) {
          isValid = true;
        } else {
          const json = await res.json().catch(() => ({}));
          errorMessage = json.error?.message || `OpenAI API returned status ${res.status}`;
        }
      }
    }

    return NextResponse.json({ valid: isValid, error: errorMessage });
  } catch (error: any) {
    return NextResponse.json({ valid: false, error: error.message || 'Verification failed.' });
  }
}
