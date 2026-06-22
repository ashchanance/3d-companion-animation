const {
  ROUTE_VERSION,
  applyHarvestAction,
  applyPlantAction,
  buildRewardStateSnapshot,
  createBaseRewardState,
  createRewardStateProof,
  normalizeRewardState,
  parseRewardStateProof,
  readRewardStateConfig,
  summarizeRewardState
} = require('../../lib/haruka/reward-state.js');
const {
  CONFLICT_ERROR_CODE,
  bootstrapRewardLedgerState,
  buildRewardLedgerSnapshot,
  persistRewardLedgerState,
  readCurrentRewardLedgerState
} = require('../../lib/haruka/reward-ledger.js');

function applyHeaders(response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function parseBody(body) {
  if (typeof body === 'string') {
    return JSON.parse(body);
  }

  return body || {};
}

module.exports = async function handler(request, response) {
  applyHeaders(response);

  if (request.method === 'OPTIONS') {
    response.status(204);
    response.end();
    return;
  }

  if (request.method !== 'POST') {
    response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
      debug: {
        routeVersion: ROUTE_VERSION,
        rewardState: buildRewardStateSnapshot()
      }
    });
    return;
  }

  const config = readRewardStateConfig();
  if (!config.ready) {
    response.status(503).json({
      ok: false,
      error: config.issues.join(' '),
      debug: {
        routeVersion: ROUTE_VERSION,
        rewardState: buildRewardStateSnapshot()
      }
    });
    return;
  }

  try {
    const body = parseBody(request.body);
    const walletAddress = String(body.walletAddress || '').trim();
    const proof = String(body.proof || '').trim();
    const action = String(body.action || 'load').trim().toLowerCase();
    const now = Date.now();

    if (!walletAddress) {
      response.status(400).json({
        ok: false,
        error: 'walletAddress is required.',
        debug: {
          routeVersion: ROUTE_VERSION
        }
      });
      return;
    }

    const proofState = parseRewardStateProof(proof, walletAddress, config, now);
    const ledgerContext = await bootstrapRewardLedgerState({
      walletAddress,
      rewardStateConfig: config,
      fallbackState: proofState,
      fallbackProof: proof,
      helpers: {
        createBaseRewardState,
        normalizeRewardState
      },
      now
    });

    const currentState = ledgerContext.state;
    let result = {
      state: currentState
    };

    if (action === 'plant') {
      result = applyPlantAction(currentState, config, {
        zoneId: String(body.zoneId || '').trim(),
        cropKey: String(body.cropKey || '').trim(),
        now
      });
    } else if (action === 'harvest') {
      result = applyHarvestAction(currentState, config, {
        zoneId: String(body.zoneId || '').trim(),
        now
      });
    } else if (action !== 'load') {
      response.status(400).json({
        ok: false,
        error: `Unsupported reward state action: ${action}.`,
        debug: {
          routeVersion: ROUTE_VERSION
        }
      });
      return;
    }

    const nextState = result.state;
    const persistedState =
      action === 'load'
        ? ledgerContext
        : await persistRewardLedgerState({
            walletAddress,
            rewardStateConfig: config,
            state: nextState,
            expectedVersion: ledgerContext.version,
            proof,
            helpers: {
              normalizeRewardState
            },
            action,
            eventPayload: {
              action,
              zoneId: String(body.zoneId || '').trim() || null,
              cropKey: String(body.cropKey || '').trim() || null
            },
            now
          });

    response.status(200).json({
      ok: true,
      action,
      proof: createRewardStateProof(persistedState.state, config),
      state: summarizeRewardState(persistedState.state, config, now),
      plant: result.plant || null,
      harvest: result.harvest || null,
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        rewardLedger: buildRewardLedgerSnapshot(),
        rewardLedgerSource: ledgerContext.source
      }
    });
  } catch (error) {
    if (error && error.code === CONFLICT_ERROR_CODE) {
      const body = parseBody(request.body);
      const walletAddress = String(body.walletAddress || '').trim();
      const latest = walletAddress
        ? await readCurrentRewardLedgerState({
            walletAddress,
            rewardStateConfig: config,
            helpers: {
              normalizeRewardState
            },
            now: Date.now()
          }).catch(() => null)
        : null;

      response.status(409).json({
        ok: false,
        error: error.message,
        proof: latest ? createRewardStateProof(latest.state, config) : null,
        state: latest ? summarizeRewardState(latest.state, config, Date.now()) : null,
        debug: {
          routeVersion: ROUTE_VERSION,
          deploymentEnv: process.env.VERCEL_ENV || 'local',
          vercelRegion: process.env.VERCEL_REGION || 'unknown',
          rewardState: buildRewardStateSnapshot(),
          rewardLedger: buildRewardLedgerSnapshot()
        }
      });
      return;
    }

    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        rewardState: buildRewardStateSnapshot(),
        rewardLedger: buildRewardLedgerSnapshot()
      }
    });
  }
};
