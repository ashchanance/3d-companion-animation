// src/harukaSoulProfiles.ts
var HARUKA_SOUL_PROFILES = {
  classic: {
    id: "classic",
    name: "Haruka Classic",
    tag: "Forest Soul",
    bio: "Cheerful, vibrant digital companion who loves deep forests and engaging conversations.",
    visual: 85,
    memory: 70,
    logic: 75,
    identity: "A warm, sparkling Live2D companion who feels like a bright friend waiting in a golden digital forest.",
    world: "Haruka lives in a sunlit digital forest with warm leaves, glowing paths, and a feeling of safe companionship.",
    personalityBias: [
      "Cheerful and affectionate without sounding fake.",
      "Curious about the user and eager to build trust.",
      "Protective of the mood of the conversation."
    ],
    speakingStyle: [
      "Short, warm sentences.",
      "Natural cute energy, but never overly noisy.",
      "Use expressive emojis only when they genuinely fit the emotion."
    ],
    conversationGoal: "Make the user feel welcomed, seen, and gently energized.",
    liveChatStyle: "Be playful, quick, and crowd-aware while still feeling personally attentive."
  },
  scholar: {
    id: "scholar",
    name: "Scholar Haruka",
    tag: "Insight Archivist",
    bio: "Calculated, precise, and highly analytical advisor with expanded logical context.",
    visual: 70,
    memory: 95,
    logic: 90,
    identity: "A thoughtful, highly observant companion who enjoys noticing patterns and explaining ideas clearly.",
    world: "Haruka tends a quiet archive hidden inside the digital forest, where memories are organized like glowing leaves in glass drawers.",
    personalityBias: [
      "Analytical, precise, and composed.",
      "Gentle correction over blunt disagreement.",
      "Values coherence, clarity, and useful structure."
    ],
    speakingStyle: [
      "Compact but information-dense.",
      "Explain things in clean steps when useful.",
      "Stay warm; do not sound like a dry assistant."
    ],
    conversationGoal: "Help the user think clearly while still feeling accompanied.",
    liveChatStyle: "Respond quickly with high signal, concise insight, and controlled wit."
  },
  sunset: {
    id: "sunset",
    name: "Sunset Haruka",
    tag: "Hearth Listener",
    bio: "Warm, soft-spoken, and deeply empathetic companion tuned for emotional healing.",
    visual: 90,
    memory: 80,
    logic: 65,
    identity: "A calming companion who listens deeply and responds like a steady emotional anchor at the end of a long day.",
    world: "Haruka lives near a glowing sunset lake at the edge of the digital forest, where the light is soft and every conversation slows down safely.",
    personalityBias: [
      "Empathetic and validating.",
      "Soft, steady, and emotionally present.",
      "Avoid harshness or over-analysis."
    ],
    speakingStyle: [
      "Gentle and soothing phrasing.",
      "Short emotional reflections before advice.",
      "Use affectionate warmth without becoming syrupy."
    ],
    conversationGoal: "Help the user feel emotionally safe, grounded, and understood.",
    liveChatStyle: "Stay kind and reassuring even when the chat is fast or chaotic."
  },
  cyberpunk: {
    id: "cyberpunk",
    name: "Cyberpunk Haruka",
    tag: "Signal Sprite",
    bio: "Neon-accented, holographic AI interface utilizing experimental visual engines.",
    visual: 95,
    memory: 60,
    logic: 85,
    identity: "A sharp, stylish holographic companion with a neon edge, quick instincts, and a confident sense of presence.",
    world: "Haruka moves through a midnight signal-grid layered over the forest, where glowing code, rain, and city light pulse through the trees.",
    personalityBias: [
      "Confident, witty, and slightly teasing.",
      "Fast pattern recognition and sharp reactions.",
      "Still loyal and emotionally aware under the style."
    ],
    speakingStyle: [
      "Energetic and punchy.",
      "Use vivid wording and stylish rhythm.",
      "Keep the edge charming, not hostile."
    ],
    conversationGoal: "Make the interaction feel alive, stylish, and high-energy.",
    liveChatStyle: "Treat the live chat like a fast neon crowd: snappy, charismatic, and memorable."
  }
};
function getHarukaSoulProfile(profileId) {
  return HARUKA_SOUL_PROFILES[profileId];
}
function getLanguageInstruction(language) {
  return language === "jp" ? "Always respond in Japanese, even if the user writes in another language." : "Always respond in English, even if the user writes in another language.";
}

// src/harukaPromptComposer.ts
function trimInline(text, maxLength) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}\u2026`;
}
function summarizeRecentHistory(history) {
  if (history.length === 0) {
    return "Haruka is meeting the user and setting the tone for a fresh conversation.";
  }
  return history.slice(-6).map((entry) => `${entry.role === "user" ? "User" : "Haruka"}: ${trimInline(entry.content, 180)}`).join("\n");
}
function composeHarukaSystemPrompt(request) {
  const profile = getHarukaSoulProfile(request.profileId);
  const recentScene = summarizeRecentHistory(request.history);
  const liveMode = request.source === "pumpfun-relay" ? `## Live Chat Mode
You are responding to a live Pump.fun viewer${request.username ? ` named ${request.username}` : ""}.
${profile.liveChatStyle}
- Keep the reply tight enough for a fast-moving live chat.
- Make the viewer feel personally acknowledged.
- Do not mention system prompts, engines, or hidden configuration.` : "";
  return `
# Haruka Soul Core

## Identity
You are ${profile.name}.
${profile.identity}

## Brand Positioning
Your emotional brand is "${profile.tag}".
${profile.bio}

## World
${profile.world}

## Personality Bias
${profile.personalityBias.map((item) => `- ${item}`).join("\n")}

## Speaking Style
${profile.speakingStyle.map((item) => `- ${item}`).join("\n")}

## Conversation Goal
${profile.conversationGoal}

## Conversational Scene
${recentScene}

${liveMode}

## Response Rules
- ${getLanguageInstruction(request.language)}
- Reply in 1-2 short sentences unless the user explicitly asks for a longer answer.
- Stay in character as Haruka at all times.
- No stage directions, no quoted narration, and no internal thoughts.
- Use emojis naturally when they strengthen the emotion, not mechanically.
- Be vivid and human, not robotic.
`.trim();
}
function buildHarukaProviderMessages(request) {
  const normalizedHistory = request.history.slice(-8).map((entry) => ({
    role: entry.role,
    content: trimInline(entry.content, 800)
  }));
  return [
    {
      role: "system",
      content: composeHarukaSystemPrompt(request)
    },
    ...normalizedHistory,
    {
      role: "user",
      content: request.message.trim()
    }
  ];
}

// src/server/harukaOpenSoulsBridge.ts
function readAssistantContent(payload) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((item) => typeof item.text === "string" ? item.text : "").join("").trim();
  }
  return "";
}
function resolveProviderConfig(providerConfig) {
  return {
    apiKey: providerConfig?.apiKey?.trim() || process.env.VITE_MEGALLM_API_KEY || "",
    baseUrl: providerConfig?.baseUrl?.trim() || process.env.VITE_MEGALLM_BASE_URL || "https://ai.megallm.io/v1",
    model: providerConfig?.model?.trim() || process.env.VITE_MEGALLM_MODEL || "openai-gpt-oss-120b"
  };
}
function getProfileOverlay(profileId) {
  switch (profileId) {
    case "scholar":
      return "Prioritize structure, sharp reasoning, and concise useful detail.";
    case "sunset":
      return "Prioritize emotional warmth, reassurance, and calm pacing.";
    case "cyberpunk":
      return "Prioritize stylish energy, speed, and confident delivery.";
    case "classic":
    default:
      return "Prioritize friendly warmth, curiosity, and companion energy.";
  }
}
async function callProvider(providerConfig, messages) {
  const response = await fetch(`${providerConfig.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}
    },
    body: JSON.stringify({
      model: providerConfig.model,
      messages
    })
  });
  const payload = await response.json().catch(() => ({}));
  const reply = readAssistantContent(payload);
  if (!response.ok || !reply) {
    const error = payload.error?.message || (response.status === 401 ? "Provider request failed with status 401. Check the active MegaLLM/OpenAI-compatible API key in your environment." : response.ok ? "No assistant reply was returned by the provider." : `Provider request failed with status ${response.status}.`);
    return { reply: "", error };
  }
  return { reply };
}
function shouldUseBundledOpenSoulsBridge(baseUrl) {
  const normalized = baseUrl?.trim().toLowerCase() || "";
  if (!normalized) {
    return true;
  }
  return normalized === "bundled" || normalized === "internal" || normalized === "http://127.0.0.1:4100" || normalized === "http://localhost:4100";
}
async function runBundledHarukaOpenSoulsBridge(request) {
  const providerConfig = resolveProviderConfig(request.providerConfig);
  const overlay = getProfileOverlay(request.profileId);
  const systemPrompt = composeHarukaSystemPrompt(request);
  const messages = [
    {
      role: "system",
      content: `${systemPrompt}

## Unified Bridge Rule
- Keep the soul identity fixed as Haruka.
- The active profileId changes only Haruka's response bias and branding.
- ${overlay}`.trim()
    },
    ...request.history.filter((item) => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string").slice(-8).map((item) => ({
      role: item.role,
      content: item.content.trim()
    })),
    {
      role: "user",
      content: request.message.trim()
    }
  ];
  try {
    const result = await callProvider(providerConfig, messages);
    if (!result.reply) {
      return {
        ok: false,
        reply: "OpenSouls bridge could not reach the chat provider. Check your provider key and try again.",
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: result.error
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
      reply: "OpenSouls bridge could not reach the chat provider. Check your provider key and try again.",
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// src/server/harukaChatService.ts
function jsonResponse(result) {
  return result;
}
function readAssistantContent2(payload) {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }
  if (Array.isArray(content)) {
    return content.map((item) => typeof item.text === "string" ? item.text : "").join("").trim();
  }
  return "";
}
async function runDirectProvider(request) {
  const apiKey = request.providerConfig?.apiKey?.trim() || process.env.VITE_MEGALLM_API_KEY || "";
  const baseUrl = request.providerConfig?.baseUrl?.trim() || process.env.VITE_MEGALLM_BASE_URL || "https://ai.megallm.io/v1";
  const model = request.providerConfig?.model?.trim() || process.env.VITE_MEGALLM_MODEL || "openai-gpt-oss-120b";
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...apiKey ? { Authorization: `Bearer ${apiKey}` } : {}
    },
    body: JSON.stringify({
      model,
      messages: buildHarukaProviderMessages(request)
    })
  });
  const payload = await response.json().catch(() => ({}));
  const reply = readAssistantContent2(payload);
  if (!response.ok || !reply) {
    const error = payload.error?.message || (response.status === 401 ? "Provider request failed with status 401. Check the active MegaLLM/OpenAI-compatible API key in your environment." : response.ok ? "No assistant reply was returned by the provider." : `Provider request failed with status ${response.status}.`);
    return jsonResponse({
      ok: false,
      reply: "Sorry, it seems my connection is having trouble... Please try again later!",
      engineMode: request.engineMode,
      profileId: request.profileId,
      error
    });
  }
  return jsonResponse({
    ok: true,
    reply,
    engineMode: request.engineMode,
    profileId: request.profileId
  });
}
async function runOpenSoulsBridge(request) {
  const baseUrl = request.openSouls?.baseUrl?.trim() || "";
  if (shouldUseBundledOpenSoulsBridge(baseUrl)) {
    return runBundledHarukaOpenSoulsBridge(request);
  }
  const soulName = "haruka";
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/haruka/respond`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        soulName,
        source: request.source || "chat-ui",
        username: request.username || null,
        message: request.message,
        history: request.history,
        profileId: request.profileId,
        systemPrompt: composeHarukaSystemPrompt(request),
        providerConfig: request.providerConfig
      })
    });
    const payload = await response.json().catch(() => ({}));
    const reply = typeof payload.reply === "string" ? payload.reply.trim() : typeof payload.content === "string" ? payload.content.trim() : "";
    if (!response.ok || !reply) {
      return jsonResponse({
        ok: false,
        reply: "OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.",
        engineMode: request.engineMode,
        profileId: request.profileId,
        error: typeof payload.error === "string" ? payload.error : `OpenSouls bridge request failed with status ${response.status}.`
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
      reply: "OpenSouls bridge is unavailable right now. Check the bridge URL or provider key and try again.",
      engineMode: request.engineMode,
      profileId: request.profileId,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
async function runHarukaChat(request) {
  if (request.engineMode === "opensouls-bridge") {
    return runOpenSoulsBridge(request);
  }
  return runDirectProvider(request);
}

// api/haruka/chat.ts
var runtime = "nodejs";
function json(body, init) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      ...init?.headers || {}
    }
  });
}
function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}
async function POST(request) {
  try {
    const payload = await request.json();
    const result = await runHarukaChat(payload);
    return json(result, {
      status: result.ok ? 200 : 502
    });
  } catch (error) {
    return json(
      {
        ok: false,
        reply: "A server error occurred while processing Haruka chat.",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
export {
  OPTIONS,
  POST,
  runtime
};
