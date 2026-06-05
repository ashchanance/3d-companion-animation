import type { HarukaChatRequest, HarukaChatResponse, HarukaUsageInfo } from '../harukaChatContract';

interface UsageGateConfig {
  enabled: boolean;
  windowMinutes: number;
  webLimit: number;
  embedLimit: number;
  keyLimits: Map<string, number>;
  bypassKeys: Set<string>;
}

interface UsageBucket {
  count: number;
  resetAt: number;
}

interface UsageGateDecision {
  ok: boolean;
  response?: HarukaChatResponse;
  usage: HarukaUsageInfo;
}

const usageBuckets = new Map<string, UsageBucket>();

function parseBooleanFlag(value: string | undefined): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function splitEnvList(value: string | undefined): string[] {
  return String(value || '')
    .split(/[\r\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseKeyLimits(value: string | undefined): Map<string, number> {
  const entries = splitEnvList(value);
  const limits = new Map<string, number>();

  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const rawLimit = entry.slice(separatorIndex + 1).trim();
    const limit = parsePositiveInteger(rawLimit, 0);

    if (key && limit > 0) {
      limits.set(key, limit);
    }
  }

  return limits;
}

function readUsageGateConfig(): UsageGateConfig {
  return {
    enabled: parseBooleanFlag(process.env.HARUKA_USAGE_GATE_ENABLED),
    windowMinutes: parsePositiveInteger(process.env.HARUKA_USAGE_WINDOW_MINUTES, 60) || 60,
    webLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_WEB_APP, 0),
    embedLimit: parsePositiveInteger(process.env.HARUKA_USAGE_LIMIT_EMBED_WIDGET, 0),
    keyLimits: parseKeyLimits(process.env.HARUKA_USAGE_KEY_LIMITS),
    bypassKeys: new Set(splitEnvList(process.env.HARUKA_USAGE_BYPASS_KEYS))
  };
}

function buildUsageInfo(
  scope: HarukaUsageInfo['scope'],
  config: UsageGateConfig,
  options?: Partial<HarukaUsageInfo>
): HarukaUsageInfo {
  return {
    scope,
    gateEnabled: config.enabled,
    windowMinutes: config.windowMinutes,
    limit: options?.limit ?? null,
    used: options?.used ?? 0,
    remaining: options?.remaining ?? null,
    ...(options?.resetAt ? { resetAt: options.resetAt } : {})
  };
}

function pruneExpiredBuckets(now: number): void {
  if (usageBuckets.size < 512) {
    return;
  }

  for (const [key, bucket] of usageBuckets.entries()) {
    if (bucket.resetAt <= now) {
      usageBuckets.delete(key);
    }
  }
}

function reserveUsage(bucketKey: string, limit: number, config: UsageGateConfig, scope: HarukaUsageInfo['scope']): UsageGateDecision {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const windowMs = Math.max(config.windowMinutes, 1) * 60_000;
  const existing = usageBuckets.get(bucketKey);
  const activeBucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + windowMs }
    : existing;

  if (activeBucket.count >= limit) {
    const usage = buildUsageInfo(scope, config, {
      limit,
      used: activeBucket.count,
      remaining: 0,
      resetAt: new Date(activeBucket.resetAt).toISOString()
    });

    return {
      ok: false,
      usage,
      response: {
        ok: false,
        reply: scope === 'web-app'
          ? 'Haruka has reached the current free chat quota for this session. Please wait for the usage window to reset and try again.'
          : 'This HARUKA widget has reached its current chat quota. Please wait for the usage window to reset and try again.',
        engineMode: 'direct',
        profileId: 'classic',
        statusCode: 402,
        error: 'Usage gate limit reached.',
        usage
      }
    };
  }

  activeBucket.count += 1;
  usageBuckets.set(bucketKey, activeBucket);

  return {
    ok: true,
    usage: buildUsageInfo(scope, config, {
      limit,
      used: activeBucket.count,
      remaining: Math.max(limit - activeBucket.count, 0),
      resetAt: new Date(activeBucket.resetAt).toISOString()
    })
  };
}

export function readHarukaUsageGateSnapshot(): Record<string, unknown> {
  const config = readUsageGateConfig();

  return {
    usageGateEnabled: config.enabled,
    usageWindowMinutes: config.windowMinutes,
    webAppWindowLimit: config.webLimit,
    embedWidgetWindowLimit: config.embedLimit,
    configuredUsageKeyCount: config.keyLimits.size,
    usageBypassKeyCount: config.bypassKeys.size
  };
}

export function evaluateHarukaUsageGate(request: HarukaChatRequest): UsageGateDecision {
  const config = readUsageGateConfig();
  const apiKey = request.apiKey?.trim() || '';
  const sessionId = request.sessionId?.trim() || '';
  const userId = request.userId?.trim() || '';
  const isEmbedRequest = request.clientType === 'embed-widget' || Boolean(apiKey);

  if (!config.enabled) {
    return {
      ok: true,
      usage: buildUsageInfo('disabled', config)
    };
  }

  if (apiKey && config.bypassKeys.has(apiKey)) {
    return {
      ok: true,
      usage: buildUsageInfo('bypass', config)
    };
  }

  if (isEmbedRequest) {
    const keyLimit = apiKey ? config.keyLimits.get(apiKey) : undefined;
    if (typeof keyLimit === 'number' && keyLimit > 0) {
      return reserveUsage(`embed-key:${apiKey}`, keyLimit, config, 'embed-api-key');
    }

    if (config.embedLimit > 0) {
      const bucketIdentity = apiKey || userId || sessionId || 'anonymous';
      return reserveUsage(`embed:${bucketIdentity}`, config.embedLimit, config, 'embed-widget');
    }

    return {
      ok: true,
      usage: buildUsageInfo('embed-widget', config)
    };
  }

  if (config.webLimit > 0) {
    const bucketIdentity = userId || sessionId || 'anonymous';
    return reserveUsage(`web:${bucketIdentity}`, config.webLimit, config, 'web-app');
  }

  return {
    ok: true,
    usage: buildUsageInfo('web-app', config)
  };
}
