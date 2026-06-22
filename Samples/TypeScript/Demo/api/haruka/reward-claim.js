const {
  ROUTE_VERSION,
  buildRewardClaimSnapshot,
  isAuthorizedRewardClaimRequest,
  parseRewardClaimRequest,
  runRewardClaim
} = require('../../lib/haruka/reward-claim.js');

function applyHeaders(response) {
  response.setHeader('Content-Type', 'application/json');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
        rewardClaim: buildRewardClaimSnapshot()
      }
    });
    return;
  }

  const authorization = isAuthorizedRewardClaimRequest(request);
  if (!authorization.ok) {
    response.status(401).json({
      ok: false,
      error: authorization.reason,
      debug: {
        routeVersion: ROUTE_VERSION,
        deploymentEnv: process.env.VERCEL_ENV || 'local',
        vercelRegion: process.env.VERCEL_REGION || 'unknown',
        rewardClaim: buildRewardClaimSnapshot()
      }
    });
    return;
  }

  try {
    const options = parseRewardClaimRequest(request.body);
    const result = await runRewardClaim(options);
    const statusCode = result.ok ? 200 : result.statusCode || 502;
    response.status(statusCode).json({
      ...result,
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
        rewardClaim: buildRewardClaimSnapshot()
      }
    });
  }
};
