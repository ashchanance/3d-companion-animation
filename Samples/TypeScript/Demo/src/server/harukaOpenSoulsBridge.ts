import type { HarukaChatRequest, HarukaChatResponse, HarukaProviderConfig } from '../harukaChatContract';
import { composeHarukaSystemPrompt } from '../harukaPromptComposer';

interface OpenAiCompatibleResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
}

function readAssistantContent(payload: OpenAiCompatibleResponse): string {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === 'string') {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item.text === 'string' ? item.text : ''))
      .join('')
      .trim();
  }

  return '';
}

function resolveProviderConfig(providerConfig?: HarukaProviderConfig): Required<HarukaProviderConfig> {
  return {
    apiKey: providerConfig?.apiKey?.trim() || process.env.VITE_MEGALLM_API_KEY || '',
    baseUrl: providerConfig?.baseUrl?.trim() || process.env.VITE_MEGALLM_BASE_URL || 'https://ai.megallm.io/v1',
    model: providerConfig?.model?.trim() || process.env.VITE_MEGALLM_MODEL || 'openai-gpt-oss-120b'
  };
}

function getProfileOverlay(profileId: HarukaChatRequest['profileId']): string {
  switch (profileId) {
    case 'scholar':
      return 'Prioritize structure, sharp reasoning, and concise useful detail.';
    case 'sunset':
      return 'Prioritize emotional warmth, reassurance, and calm pacing.';
    case 'cyberpunk':
      return 'Prioritize stylish energy, speed, and confident delivery.';
    case 'classic':
    default:
      return 'Prioritize friendly warmth, curiosity, and companion energy.';
  }
}

async function callProvider(
  providerConfig: Required<HarukaProviderConfig>,
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<{ reply: string; error?: string }> {
  const response = await fetch(`${providerConfig.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {})
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages
    })
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAiCompatibleResponse;
  const reply = readAssistantContent(payload);

  if (!response.ok || !reply) {
    const error =
      payload.error?.message ||
      (response.status === 401
        ? 'Provider request failed with status 401. Check the active MegaLLM/OpenAI-compatible API key in your environment.'
        : response.ok
          ? 'No assistant reply was returned by the provider.'
          : `Provider request failed with status ${response.status}.`);

    return { reply: '', error };
  }

  return { reply };
}

export function shouldUseBundledOpenSoulsBridge(baseUrl?: string): boolean {
  const normalized = baseUrl?.trim().toLowerCase() || '';
  if (!normalized) {
    return true;
  }

  return (
    normalized === 'bundled' ||
    normalized === 'internal' ||
    normalized === 'http://127.0.0.1:4100' ||
    normalized === 'http://localhost:4100'
  );
}

export async function runBundledHarukaOpenSoulsBridge(request: HarukaChatRequest): Promise<HarukaChatResponse> {
  const providerConfig = resolveProviderConfig(request.providerConfig);
  const overlay = getProfileOverlay(request.profileId);
  const systemPrompt = composeHarukaSystemPrompt(request);
  const messages = [
    {
      role: 'system' as const,
      content: `${systemPrompt}\n\n## Unified Bridge Rule\n- Keep the soul identity fixed as Haruka.\n- The active profileId changes only Haruka's response bias and branding.\n- ${overlay}`.trim()
    },
    ...request.history
      .filter((item) => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string')
      .slice(-8)
      .map((item) => ({
        role: item.role,
        content: item.content.trim()
      })),
    {
      role: 'user' as const,
      content: request.message.trim()
    }
  ];

  try {
    const result = await callProvider(providerConfig, messages);
    if (!result.reply) {
      return {
        ok: false,
        reply: 'OpenSouls bridge could not reach the chat provider. Check your provider key and try again.',
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: result.error,
        debug: {
          routeVersion: 'haruka-opensouls-bridge-2026-06-05-v3',
          deploymentEnv: process.env.VERCEL_ENV || 'local',
          providerBaseUrl: providerConfig.baseUrl,
          providerModel: providerConfig.model,
          hasProviderApiKey: Boolean(providerConfig.apiKey),
          providerApiKeyLength: providerConfig.apiKey.length,
          profileId: request.profileId,
          source: request.source || 'chat-ui'
        }
      };
    }

    return {
      ok: true,
      reply: result.reply,
      engineMode: request.engineMode,
      profileId: request.profileId
    };
  } catch (error) {
    return {
      ok: false,
      reply: 'OpenSouls bridge could not reach the chat provider. Check your provider key and try again.',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        routeVersion: 'haruka-opensouls-bridge-2026-06-05-v3',
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        providerBaseUrl: providerConfig.baseUrl,
        providerModel: providerConfig.model,
        hasProviderApiKey: Boolean(providerConfig.apiKey),
        providerApiKeyLength: providerConfig.apiKey.length,
        profileId: request.profileId,
        source: request.source || 'chat-ui'
      }
    };
  }
}
