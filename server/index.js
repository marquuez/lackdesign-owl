import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import bcrypt from 'bcrypt'
import { authMiddleware, createProviderTokenMiddleware, signAdminToken } from './auth.js'
import { mountContactApi } from './contact.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const siteRoot = path.join(__dirname, '..')

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 60 },
})

function mimeToExt(mime) {
  if (mime === 'image/jpeg') return '.jpg'
  if (mime === 'image/png') return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/heic') return '.heic'
  if (mime === 'image/heif') return '.heif'
  return '.bin'
}

function generateReferenceCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'LD-'
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function sanitizeText(value, maxLen) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, maxLen)
}

function mountStatic(app) {
  app.use(express.static(siteRoot, { extensions: ['html'] }))

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    const filePath = path.join(siteRoot, req.path === '/' ? 'index.html' : req.path)
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      return res.sendFile(filePath)
    }
    res.status(404).sendFile(path.join(siteRoot, 'index.html'))
  })
}

/**
 * @param {import('pg').Pool | null} pool
 * @param {string} uploadDirAbs
 */
export function createApp(pool, uploadDirAbs) {
  const app = express()
  app.set('trust proxy', process.env.LACKDESIGN_TRUST_PROXY === '1')

  app.use(express.json({ limit: '2mb' }))

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'lackdesign-website', db: Boolean(pool) })
  })

  mountContactApi(app)

  if (!pool) {
    mountStatic(app)
    return app
  }

  const providerTokenMiddleware = createProviderTokenMiddleware(pool)

  /* ─── Admin auth ─── */
  app.post('/api/admin/login', async (req, res) => {
    try {
      const email = sanitizeText(req.body?.email, 255).toLowerCase()
      const password = req.body?.password
      if (!email || !password) {
        return res.status(400).json({ error: 'E-Mail und Passwort erforderlich.' })
      }
      const { rows } = await pool.query(
        'SELECT id, email, password_hash, name FROM admin_users WHERE email = $1',
        [email],
      )
      const admin = rows[0]
      if (!admin || !(await bcrypt.compare(password, admin.password_hash))) {
        return res.status(401).json({ error: 'Anmeldedaten ungültig.' })
      }
      const token = signAdminToken(admin)
      res.json({
        token,
        admin: { id: admin.id, email: admin.email, name: admin.name },
      })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Anmeldung fehlgeschlagen.' })
    }
  })

  app.get('/api/admin/me', authMiddleware, async (req, res) => {
    const { rows } = await pool.query(
      'SELECT id, email, name FROM admin_users WHERE id = $1',
      [req.admin.id],
    )
    if (!rows[0]) return res.status(404).json({ error: 'Benutzer nicht gefunden.' })
    res.json({ admin: rows[0] })
  })

  app.get('/api/admin/settings', authMiddleware, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT value FROM app_settings WHERE key = 'provider_token'`,
      )
      const providerToken =
        rows[0]?.value || process.env.LACKDESIGN_PROVIDER_TOKEN?.trim() || ''
      res.json({ provider_token: providerToken })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Einstellungen konnten nicht geladen werden.' })
    }
  })

  app.put('/api/admin/settings', authMiddleware, async (req, res) => {
    try {
      const token = sanitizeText(req.body?.provider_token, 120)
      if (token.length < 6) {
        return res.status(400).json({ error: 'Zugangscode muss mindestens 6 Zeichen haben.' })
      }
      await pool.query(
        `INSERT INTO app_settings (key, value, updated_at)
         VALUES ('provider_token', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [token],
      )
      res.json({ ok: true, provider_token: token })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Zugangscode konnte nicht gespeichert werden.' })
    }
  })

  /* ─── Provider batch intake ─── */
  app.post(
    '/api/intake/batch',
    providerTokenMiddleware,
    upload.any(),
    async (req, res) => {
      const client = await pool.connect()
      try {
        let payload
        try {
          payload = JSON.parse(req.body?.data || '{}')
        } catch {
          return res.status(400).json({ error: 'Ungültige Formulardaten.' })
        }

        const providerCompany = sanitizeText(payload.provider_company, 200)
        const contactName = sanitizeText(payload.contact_name, 120)
        const contactEmail = sanitizeText(payload.contact_email, 255)
        const contactPhone = sanitizeText(payload.contact_phone, 80)
        const batchNotes = sanitizeText(payload.batch_notes, 4000)
        const vehicles = Array.isArray(payload.vehicles) ? payload.vehicles : []

        if (!providerCompany || !contactName || !contactPhone) {
          return res.status(400).json({
            error: 'Firma, Ansprechpartner und Telefon sind Pflichtfelder.',
          })
        }
        if (vehicles.length === 0) {
          return res.status(400).json({ error: 'Mindestens ein Fahrzeug erforderlich.' })
        }
        if (vehicles.length > 20) {
          return res.status(400).json({ error: 'Maximal 20 Fahrzeuge pro Anmeldung.' })
        }

        for (let i = 0; i < vehicles.length; i += 1) {
          const v = vehicles[i]
          if (!sanitizeText(v.make_model, 200)) {
            return res.status(400).json({ error: `Fahrzeug ${i + 1}: Marke/Modell fehlt.` })
          }
          if (!sanitizeText(v.description, 8000)) {
            return res.status(400).json({ error: `Fahrzeug ${i + 1}: Beschreibung fehlt.` })
          }
          if (!sanitizeText(v.agreed_work, 8000)) {
            return res.status(400).json({
              error: `Fahrzeug ${i + 1}: „Was ausgemacht wurde“ fehlt.`,
            })
          }
        }

        const filesByVehicle = new Map()
        for (const file of req.files || []) {
          const match = /^vehicle_(\d+)_images$/i.exec(file.fieldname)
          if (!match) continue
          const idx = Number(match[1])
          if (!filesByVehicle.has(idx)) filesByVehicle.set(idx, [])
          if ((filesByVehicle.get(idx)?.length || 0) < 12) {
            filesByVehicle.get(idx).push(file)
          }
        }

        await client.query('BEGIN')

        let referenceCode = generateReferenceCode()
        for (let attempt = 0; attempt < 5; attempt += 1) {
          try {
            await client.query(
              `INSERT INTO intake_batches
               (reference_code, provider_company, contact_name, contact_email, contact_phone, batch_notes)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                referenceCode,
                providerCompany,
                contactName,
                contactEmail || null,
                contactPhone,
                batchNotes || null,
              ],
            )
            break
          } catch (err) {
            if (err.code === '23505' && attempt < 4) {
              referenceCode = generateReferenceCode()
            } else {
              throw err
            }
          }
        }

        const batchRow = (
          await client.query('SELECT id FROM intake_batches WHERE reference_code = $1', [
            referenceCode,
          ])
        ).rows[0]

        const vehicleIds = []
        for (let i = 0; i < vehicles.length; i += 1) {
          const v = vehicles[i]
          const urgency = ['normal', 'kurzfristig', 'eilig'].includes(v.urgency)
            ? v.urgency
            : 'normal'
          const deadline = v.deadline ? sanitizeText(v.deadline, 10) : null

          const { rows } = await client.query(
            `INSERT INTO intake_vehicles
             (batch_id, sort_order, license_plate, make_model, description, agreed_work,
              pickup_required, pickup_address, deadline, urgency)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id`,
            [
              batchRow.id,
              i,
              sanitizeText(v.license_plate, 32) || null,
              sanitizeText(v.make_model, 200),
              sanitizeText(v.description, 8000),
              sanitizeText(v.agreed_work, 8000),
              Boolean(v.pickup_required),
              v.pickup_required ? sanitizeText(v.pickup_address, 500) || null : null,
              deadline || null,
              urgency,
            ],
          )
          vehicleIds.push(rows[0].id)

          const vehicleFiles = filesByVehicle.get(i) || []
          const vehicleDir = path.join(uploadDirAbs, rows[0].id)
          await fs.promises.mkdir(vehicleDir, { recursive: true })

          for (const file of vehicleFiles) {
            if (!file.mimetype?.startsWith('image/')) continue
            const imageId = crypto.randomUUID()
            const ext = mimeToExt(file.mimetype)
            const storedRel = path.join(rows[0].id, `${imageId}${ext}`)
            const storedAbs = path.join(uploadDirAbs, storedRel)
            await fs.promises.writeFile(storedAbs, file.buffer)
            await client.query(
              `INSERT INTO intake_images
               (id, vehicle_id, stored_path, original_filename, mime_type, size_bytes)
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [
                imageId,
                rows[0].id,
                storedRel.replace(/\\/g, '/'),
                sanitizeText(file.originalname, 300),
                file.mimetype,
                file.size,
              ],
            )
          }
        }

        await client.query('COMMIT')

        res.status(201).json({
          ok: true,
          reference_code: referenceCode,
          batch_id: batchRow.id,
          vehicle_count: vehicles.length,
          message: `${vehicles.length} Fahrzeug(e) angemeldet. Referenz: ${referenceCode}`,
        })
      } catch (err) {
        await client.query('ROLLBACK')
        console.error(err)
        res.status(500).json({ error: 'Anmeldung konnte nicht gespeichert werden.' })
      } finally {
        client.release()
      }
    },
  )

  /* ─── Admin: list & detail ─── */
  app.get('/api/admin/intakes', authMiddleware, async (req, res) => {
    try {
      const status = sanitizeText(req.query.status || '', 32)
      const search = sanitizeText(req.query.q || '', 100)
      const params = []
      const where = []

      if (status) {
        params.push(status)
        where.push(`v.status = $${params.length}`)
      }
      if (search) {
        params.push(`%${search}%`)
        const p = `$${params.length}`
        where.push(
          `(b.reference_code ILIKE ${p} OR b.provider_company ILIKE ${p} OR v.make_model ILIKE ${p} OR v.license_plate ILIKE ${p} OR b.contact_name ILIKE ${p})`,
        )
      }

      const sql = `
        SELECT
          v.id, v.batch_id, v.sort_order, v.license_plate, v.make_model,
          v.description, v.agreed_work, v.pickup_required, v.pickup_address,
          v.deadline, v.urgency, v.status, v.internal_notes,
          v.agreed_price_eur, v.internal_deadline,
          v.created_at, v.updated_at,
          b.reference_code, b.provider_company, b.contact_name,
          b.contact_email, b.contact_phone, b.batch_notes,
          (SELECT COUNT(*)::int FROM intake_images i WHERE i.vehicle_id = v.id) AS image_count
        FROM intake_vehicles v
        JOIN intake_batches b ON b.id = v.batch_id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY v.created_at DESC
        LIMIT 200
      `
      const { rows } = await pool.query(sql, params)
      res.json({ items: rows })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Liste konnte nicht geladen werden.' })
    }
  })

  app.get('/api/admin/intakes/:id', authMiddleware, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT
          v.*, b.reference_code, b.provider_company, b.contact_name,
          b.contact_email, b.contact_phone, b.batch_notes, b.created_at AS batch_created_at
         FROM intake_vehicles v
         JOIN intake_batches b ON b.id = v.batch_id
         WHERE v.id = $1`,
        [req.params.id],
      )
      if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' })

      const images = (
        await pool.query(
          `SELECT id, original_filename, mime_type, size_bytes, created_at
           FROM intake_images WHERE vehicle_id = $1 ORDER BY created_at`,
          [req.params.id],
        )
      ).rows

      res.json({ item: rows[0], images })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Details konnten nicht geladen werden.' })
    }
  })

  app.patch('/api/admin/intakes/:id', authMiddleware, async (req, res) => {
    try {
      const allowedStatus = new Set([
        'neu',
        'bestaetigt',
        'abholung_geplant',
        'in_arbeit',
        'fertig',
        'abgeschlossen',
        'storniert',
      ])
      const body = req.body || {}
      const updates = []
      const params = []

      if (body.status !== undefined) {
        if (!allowedStatus.has(body.status)) {
          return res.status(400).json({ error: 'Ungültiger Status.' })
        }
        params.push(body.status)
        updates.push(`status = $${params.length}`)
      }
      if (body.internal_notes !== undefined) {
        params.push(sanitizeText(String(body.internal_notes), 8000) || null)
        updates.push(`internal_notes = $${params.length}`)
      }
      if (body.agreed_price_eur !== undefined) {
        const price =
          body.agreed_price_eur === null || body.agreed_price_eur === ''
            ? null
            : Number(body.agreed_price_eur)
        if (price !== null && (Number.isNaN(price) || price < 0)) {
          return res.status(400).json({ error: 'Ungültiger Preis.' })
        }
        params.push(price)
        updates.push(`agreed_price_eur = $${params.length}`)
      }
      if (body.internal_deadline !== undefined) {
        const d =
          body.internal_deadline === null || body.internal_deadline === ''
            ? null
            : sanitizeText(String(body.internal_deadline), 10)
        params.push(d)
        updates.push(`internal_deadline = $${params.length}`)
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Keine Änderungen.' })
      }

      params.push(req.params.id)
      const { rows } = await pool.query(
        `UPDATE intake_vehicles SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $${params.length} RETURNING *`,
        params,
      )
      if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' })
      res.json({ item: rows[0] })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Speichern fehlgeschlagen.' })
    }
  })

  app.post(
    '/api/admin/intakes/:id/images',
    authMiddleware,
    upload.array('images', 12),
    async (req, res) => {
      try {
        const vehicle = (
          await pool.query('SELECT id FROM intake_vehicles WHERE id = $1', [req.params.id])
        ).rows[0]
        if (!vehicle) return res.status(404).json({ error: 'Nicht gefunden.' })

        const vehicleDir = path.join(uploadDirAbs, vehicle.id)
        await fs.promises.mkdir(vehicleDir, { recursive: true })

        const saved = []
        for (const file of req.files || []) {
          if (!file.mimetype?.startsWith('image/')) continue
          const imageId = crypto.randomUUID()
          const ext = mimeToExt(file.mimetype)
          const storedRel = path.join(vehicle.id, `${imageId}${ext}`)
          await fs.promises.writeFile(path.join(uploadDirAbs, storedRel), file.buffer)
          await pool.query(
            `INSERT INTO intake_images
             (id, vehicle_id, stored_path, original_filename, mime_type, size_bytes)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              imageId,
              vehicle.id,
              storedRel.replace(/\\/g, '/'),
              sanitizeText(file.originalname, 300),
              file.mimetype,
              file.size,
            ],
          )
          saved.push({ id: imageId })
        }
        res.status(201).json({ images: saved })
      } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Bilder konnten nicht hochgeladen werden.' })
      }
    },
  )

  app.delete('/api/admin/intakes/:id/images/:imageId', authMiddleware, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `DELETE FROM intake_images
         WHERE id = $1 AND vehicle_id = $2
         RETURNING stored_path`,
        [req.params.imageId, req.params.id],
      )
      if (!rows[0]) return res.status(404).json({ error: 'Bild nicht gefunden.' })
      const abs = path.join(uploadDirAbs, rows[0].stored_path)
      await fs.promises.unlink(abs).catch(() => {})
      res.json({ ok: true })
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Löschen fehlgeschlagen.' })
    }
  })

  app.get('/api/admin/intakes/:id/images/:imageId/file', authMiddleware, async (req, res) => {
    try {
      const { rows } = await pool.query(
        `SELECT stored_path, mime_type, original_filename
         FROM intake_images WHERE id = $1 AND vehicle_id = $2`,
        [req.params.imageId, req.params.id],
      )
      if (!rows[0]) return res.status(404).json({ error: 'Nicht gefunden.' })
      const abs = path.join(uploadDirAbs, rows[0].stored_path)
      res.type(rows[0].mime_type || 'application/octet-stream')
      if (rows[0].original_filename) {
        res.setHeader(
          'Content-Disposition',
          `inline; filename="${rows[0].original_filename.replace(/"/g, '')}"`,
        )
      }
      res.sendFile(abs)
    } catch (err) {
      console.error(err)
      res.status(500).json({ error: 'Datei konnte nicht geladen werden.' })
    }
  })

  app.get('/api/admin/stats', authMiddleware, async (_req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT status, COUNT(*)::int AS count
        FROM intake_vehicles
        GROUP BY status
      `)
      res.json({ by_status: rows })
    } catch (err) {
      res.status(500).json({ error: 'Statistik fehlgeschlagen.' })
    }
  })

  mountStatic(app)
  return app
}

async function main() {
  const uploadDir = process.env.LACKDESIGN_UPLOAD_DIR || path.join(siteRoot, 'data', 'uploads')
  await fs.promises.mkdir(uploadDir, { recursive: true })

  const app = createApp(null, uploadDir)
  const port = Number(process.env.PORT || process.env.LACKDESIGN_PORT) || 8080

  app.listen(port, () => {
    console.log(`Lackdesign Website → http://localhost:${port}`)
  })
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
