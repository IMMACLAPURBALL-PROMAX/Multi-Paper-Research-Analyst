import { APIKeys } from '@/types';

export interface ModelOption {
  id: string;
  name: string;
  provider: 'gemini' | 'claude' | 'openai';
  isGitHub?: boolean;
}

export function getAvailableModels(apiKeys: APIKeys): ModelOption[] {
  const models: ModelOption[] = [];

  // 1. Google Gemini Models
  if (apiKeys.gemini && apiKeys.gemini.trim() !== '') {
    models.push(
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'gemini' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', provider: 'gemini' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', provider: 'gemini' }
    );
  }

  // 2. Anthropic Claude Models
  if (apiKeys.claude && apiKeys.claude.trim() !== '') {
    models.push(
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'claude' },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'claude' }
    );
  }

  // 3. OpenAI or GitHub Models
  if (apiKeys.openai && apiKeys.openai.trim() !== '') {
    const isGitHub = apiKeys.openai.startsWith('ghp_') || apiKeys.openai.startsWith('github_pat_');
    if (isGitHub) {
      models.push(
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (GH)', provider: 'openai', isGitHub: true },
        { id: 'gpt-4o', name: 'GPT-4o (GH)', provider: 'openai', isGitHub: true },
        { id: 'Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B (GH)', provider: 'openai', isGitHub: true },
        { id: 'Mistral-large-2411', name: 'Mistral Large (GH)', provider: 'openai', isGitHub: true },
        { id: 'Cohere-command-r-plus', name: 'Command R+ (GH)', provider: 'openai', isGitHub: true }
      );
    } else {
      models.push(
        { id: 'gpt-4o', name: 'GPT-4o (OpenAI)', provider: 'openai' },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (OpenAI)', provider: 'openai' }
      );
    }
  }

  return models;
}
