import { getPublicContact, isMailConfigured, sendContactMails } from './mail.js'

function sanitize(value, maxLen) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

const hits = new Map()

function rateLimited(ip) {
  const now = Date.now()
  const windowMs = 60 * 60 * 1000
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs)
  if (list.length >= 8) {
    hits.set(ip, list)
    return true
  }
  list.push(now)
  hits.set(ip, list)
  return false
}

export function mountContactApi(app) {
  app.get('/api/site', (_req, res) => {
    res.json({
      ...getPublicContact(),
      mailReady: isMailConfigured(),
    })
  })

  app.post('/api/contact', async (req, res) => {
    try {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown'
      if (rateLimited(ip)) {
        return res.status(429).json({ error: 'Bitte versuchen Sie es später erneut.' })
      }

      const honeypot = sanitize(req.body?.company, 80)
      if (honeypot) return res.json({ ok: true })

      const name = sanitize(req.body?.name, 120)
      const email = sanitize(req.body?.email, 255).toLowerCase()
      const phone = sanitize(req.body?.phone, 80)
      const service = sanitize(req.body?.service, 40)
      const message = sanitize(req.body?.message, 4000)
      const privacy = Boolean(req.body?.privacy)

      if (!name || !email || !message) {
        return res.status(400).json({ error: 'Name, E-Mail und Nachricht sind erforderlich.' })
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Bitte eine gültige E-Mail-Adresse angeben.' })
      }
      if (!privacy) {
        return res.status(400).json({ error: 'Bitte die Datenschutzerklärung akzeptieren.' })
      }

      await sendContactMails({ name, email, phone, service, message })
      res.json({ ok: true })
    } catch (err) {
      if (err.code === 'MAIL_NOT_CONFIGURED') {
        return res.status(503).json({
          error: 'Der E-Mail-Versand ist noch nicht eingerichtet. Bitte rufen Sie uns an oder versuchen Sie es später.',
        })
      }
      console.error(err)
      res.status(500).json({ error: 'Nachricht konnte nicht gesendet werden.' })
    }
  })
}
