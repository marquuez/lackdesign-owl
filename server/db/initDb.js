import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @param {import('pg').Pool} pool */
export async function initDb(pool) {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8')
  await pool.query(schema)

  const envToken = process.env.LACKDESIGN_PROVIDER_TOKEN?.trim()
  if (envToken) {
    await pool.query(
      `INSERT INTO app_settings (key, value)
       VALUES ('provider_token', $1)
       ON CONFLICT (key) DO NOTHING`,
      [envToken],
    )
  }
}

/** @param {import('pg').Pool} pool */
export async function seedAdminIfNeeded(pool) {
  const email = process.env.LACKDESIGN_ADMIN_EMAIL?.trim()
  const password = process.env.LACKDESIGN_ADMIN_PASSWORD
  if (!email || !password || password.length < 8) return

  const existing = await pool.query('SELECT id FROM admin_users WHERE email = $1', [
    email.toLowerCase(),
  ])
  if (existing.rows.length > 0) return

  const bcrypt = await import('bcrypt')
  const hash = await bcrypt.hash(password, 12)
  await pool.query(
    `INSERT INTO admin_users (email, password_hash, name)
     VALUES ($1, $2, $3)`,
    [email.toLowerCase(), hash, process.env.LACKDESIGN_ADMIN_NAME?.trim() || 'Lackdesigner'],
  )
  console.log(`Admin angelegt: ${email}`)
}
