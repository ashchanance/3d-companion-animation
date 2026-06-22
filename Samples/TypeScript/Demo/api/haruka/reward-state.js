const {
  ROUTE_VERSION,
  applyHarvestAction,
  applyPlantAction,
  buildRewardStateSnapshot,
  createRewardStateProof,
  parseRewardStateProof,
  readRewardStateConfig,
  summarizeRewardState
} = require('../../lib/haruka/reward-state.js');

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

    const currentState = parseRewardStateProof(proof, walletAddress, config, now);
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
    response.status(200).json({
      ok: true,
      action,
      proof: createRewardStateProof(nextState, config),
      state: summarizeRewardState(nextState, config, now),
      plant: result.plant || null,
      harvest: result.harvest || null,
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown'
      }
    });
  } catch (error) {
    response.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        rewardState: buildRewardStateSnapshot()
      }
    });
  }
};
