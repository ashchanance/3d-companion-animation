import type { HarukaChatRequest, HarukaChatResponse } from '../harukaChatContract';
import { buildHarukaProviderMessages, composeHarukaSystemPrompt } from '../harukaPromptComposer';
import { runBundledHarukaOpenSoulsBridge, shouldUseBundledOpenSoulsBridge } from './harukaOpenSoulsBridge';

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

function jsonResponse(result: HarukaChatResponse): HarukaChatResponse {
  return result;
}

function buildProviderDebug(request: HarukaChatRequest): Record<string, unknown> {
  const apiKey = request.providerConfig?.apiKey?.trim() || process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '';
  const baseUrl = request.providerConfig?.baseUrl?.trim() || process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || 'https://ai.megallm.io/v1';
  const model = request.providerConfig?.model?.trim() || process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || 'openai-gpt-oss-120b';

  return {
    routeVersion: 'haruka-chat-2026-06-05-v3',
    deploymentEnv: process.env.VERCEL_ENV || 'local',
    engineMode: request.engineMode,
    profileId: request.profileId,
    providerId: request.providerId,
    providerBaseUrl: baseUrl,
    providerModel: model,
    hasProviderApiKey: Boolean(apiKey),
    providerApiKeyLength: apiKey.length,
    openSoulsBaseUrl: request.openSouls?.baseUrl || '',
    source: request.source || 'chat-ui'
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

async function runDirectProvider(request: HarukaChatRequest): Promise<HarukaChatResponse> {
  const apiKey = request.providerConfig?.apiKey?.trim() || process.env.MEGALLM_API_KEY || process.env.VITE_MEGALLM_API_KEY || '';
  const baseUrl = request.providerConfig?.baseUrl?.trim() || process.env.MEGALLM_BASE_URL || process.env.VITE_MEGALLM_BASE_URL || 'https://ai.megallm.io/v1';
  const model = request.providerConfig?.model?.trim() || process.env.MEGALLM_MODEL || process.env.VITE_MEGALLM_MODEL || 'openai-gpt-oss-120b';

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: JSON.stringify({
      model,
      messages: buildHarukaProviderMessages(request)
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

    return jsonResponse({
      ok: false,
      reply: 'Sorry, it seems my connection is having trouble... Please try again later!',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error,
      debug: buildProviderDebug(request)
    });
  }

  return jsonResponse({
    ok: true,
    reply,
    engineMode: request.engineMode,
    profileId: request.profileId
  });
}

async function runOpenSoulsBridge(request: HarukaChatRequest): Promise<HarukaChatResponse> {
  const baseUrl = request.openSouls?.baseUrl?.trim() || '';

  if (shouldUseBundledOpenSoulsBridge(baseUrl)) {
    return runBundledHarukaOpenSoulsBridge(request);
  }

  const soulName = 'haruka';

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/haruka/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        soulName,
        source: request.source || 'chat-ui',
        username: request.username || null,
        message: request.message,
        history: request.history,
        profileId: request.profileId,
        systemPrompt: composeHarukaSystemPrompt(request),
        providerConfig: request.providerConfig
      })
    });

    const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    const reply = typeof payload.reply === 'string'
      ? payload.reply.trim()
      : typeof payload.content === 'string'
        ? payload.content.trim()
        : '';

    if (!response.ok || !reply) {
      return jsonResponse({
        ok: false,
        reply: 'OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.',
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: typeof payload.error === 'string' ? payload.error : `OpenSouls bridge request failed with status ${response.status}.`,
        debug: {
          ...buildProviderDebug(request),
          externalBridgeUrl: baseUrl,
          externalBridgeStatus: response.status
        }
      });
    }

    return jsonResponse({
      ok: true,
      reply,
      engineMode: request.engineMode,
      profileId: request.profileId
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      reply: 'OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.',
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        ...buildProviderDebug(request),
        externalBridgeUrl: baseUrl
      }
    });
  }
}

export async function runHarukaChat(request: HarukaChatRequest): Promise<HarukaChatResponse> {
  if (request.engineMode === 'opensouls-bridge') {
    return runOpenSoulsBridge(request);
  }

  return runDirectProvider(request);
}
