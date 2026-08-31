import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'lackdesign-dev-secret-min-32-chars!!'
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d'

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, role: 'admin' }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  })
}

export function verifyAdminToken(token) {
  return jwt.verify(token, JWT_SECRET)
}

export function authMiddleware(req, res, next) {
  const h = req.headers.authorization
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Nicht angemeldet.' })
  }
  try {
    const payload = verifyAdminToken(h.slice(7))
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Keine Berechtigung.' })
    }
    req.admin = { id: payload.sub }
    next()
  } catch {
    return res.status(401).json({ error: 'Sitzung ungültig oder abgelaufen.' })
  }
}

/** @param {import('pg').Pool} pool */
export function createProviderTokenMiddleware(pool) {
  return async function providerTokenMiddleware(req, res, next) {
    try {
      const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'provider_token'`,
      )
      const expected = rows[0]?.value?.trim() || process.env.LACKDESIGN_PROVIDER_TOKEN?.trim()
      if (!expected) {
        return res.status(503).json({ error: 'Zugangscode ist nicht hinterlegt.' })
      }
      const token =
        req.headers['x-provider-token'] ||
        req.query.token ||
        req.body?.provider_token
      if (token !== expected) {
        return res.status(403).json({ error: 'Ungültiger Zugangscode.' })
      }
      next()
    } catch (err) {
      next(err)
    }
  }
}
