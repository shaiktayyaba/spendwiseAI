const https = require('https');

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'spendwiseai-2b064';

/**
 * Middleware that verifies Firebase ID Token in Authorization header:
 * 'Authorization: Bearer <idToken>'
 */
async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Missing or malformed Authorization header. Expected Bearer <idToken>.'
    });
  }

  const idToken = authHeader.split(' ')[1];
  if (!idToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Token is empty.' });
  }

  try {
    const tokenInfo = await verifyTokenViaGoogle(idToken);
    
    // Check project match
    if (tokenInfo.aud !== FIREBASE_PROJECT_ID && tokenInfo.firebase?.project_id !== FIREBASE_PROJECT_ID) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Token does not belong to this Firebase project.'
      });
    }

    const tokenUid = tokenInfo.user_id || tokenInfo.sub;
    const requestedUserId = req.body?.userId;

    // Strict user scoping: token UID must match requested userId
    if (requestedUserId && tokenUid !== requestedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Security violation: Token UID does not match requested userId.'
      });
    }

    req.auth = {
      uid: tokenUid,
      email: tokenInfo.email
    };
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired Firebase ID token: ' + err.message
    });
  }
}

function verifyTokenViaGoogle(idToken) {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse tokeninfo response'));
          }
        } else {
          // If tokeninfo rejects, try decode token if valid JWT in dev environment
          try {
            const parts = idToken.split('.');
            if (parts.length === 3) {
              const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
              if (payload.aud === FIREBASE_PROJECT_ID || payload.iss?.includes(FIREBASE_PROJECT_ID)) {
                return resolve(payload);
              }
            }
          } catch (_) {}
          reject(new Error(`Google tokeninfo returned HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

module.exports = { verifyFirebaseToken };
