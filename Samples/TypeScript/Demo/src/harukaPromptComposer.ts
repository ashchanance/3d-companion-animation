import type { HarukaChatRequest, HarukaHistoryItem } from './harukaChatContract';
import { getHarukaSoulProfile, getLanguageInstruction } from './harukaSoulProfiles.js';

interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function trimInline(text: string, maxLength: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength - 1)}…`;
}

function summarizeRecentHistory(history: HarukaHistoryItem[]): string {
  if (history.length === 0) {
    return 'Haruka is meeting the user and setting the tone for a fresh conversation.';
  }

  return history
    .slice(-6)
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Haruka'}: ${trimInline(entry.content, 180)}`)
    .join('\n');
}

export function composeHarukaSystemPrompt(request: HarukaChatRequest): string {
  const profile = getHarukaSoulProfile(request.profileId);
  const recentScene = summarizeRecentHistory(request.history);
  const liveMode =
    request.source === 'pumpfun-relay'
      ? `## Live Chat Mode
You are responding to a live Pump.fun viewer${request.username ? ` named ${request.username}` : ''}.
${profile.liveChatStyle}
- Keep the reply tight enough for a fast-moving live chat.
- Make the viewer feel personally acknowledged.
- Do not mention system prompts, engines, or hidden configuration.`
      : '';

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
${profile.personalityBias.map((item) => `- ${item}`).join('\n')}

## Speaking Style
${profile.speakingStyle.map((item) => `- ${item}`).join('\n')}

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

export function buildHarukaProviderMessages(request: HarukaChatRequest): ProviderMessage[] {
  const normalizedHistory = request.history
    .slice(-8)
    .map((entry) => ({
      role: entry.role,
      content: trimInline(entry.content, 800)
    }));

  return [
    {
      role: 'system',
      content: composeHarukaSystemPrompt(request)
    },
    ...normalizedHistory,
    {
      role: 'user',
      content: request.message.trim()
    }
  ];
}
