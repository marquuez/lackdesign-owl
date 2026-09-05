import nodemailer from 'nodemailer'

const DEFAULTS = {
  SMTP_HOST: 'smtp.strato.de',
  SMTP_PORT: '465',
  SMTP_USER: 'webmaster@lackdesign-owl.de',
  MAIL_FROM: 'Lackdesign <webmaster@lackdesign-owl.de>',
  MAIL_TO: 'info@lackdesign-owl.de',
}

function env(name, fallback = '') {
  return process.env[name]?.trim() || fallback
}

function smtpUser() {
  return env('SMTP_USER', DEFAULTS.SMTP_USER)
}

function mailFrom() {
  return env('MAIL_FROM', DEFAULTS.MAIL_FROM)
}

function mailTo() {
  return env('MAIL_TO', DEFAULTS.MAIL_TO)
}

export function getPublicContact() {
  const phone = env('LACKDESIGN_PHONE')
  const email = env('LACKDESIGN_MAIL') || mailTo()
  const tel = phone.replace(/[^\d+]/g, '')
  return {
    phone,
    phoneHref: tel ? `tel:${tel}` : '',
    email,
    mailHref: email ? `mailto:${email}` : '',
  }
}

export function isMailConfigured() {
  return Boolean(env('SMTP_PASS') && smtpUser() && mailTo())
}

export function createMailer() {
  if (!isMailConfigured()) return null
  const port = Number(env('SMTP_PORT', DEFAULTS.SMTP_PORT))
  const secure = env('SMTP_SECURE')
    ? env('SMTP_SECURE') === '1' || env('SMTP_SECURE') === 'true'
    : port === 465
  return nodemailer.createTransport({
    host: env('SMTP_HOST', DEFAULTS.SMTP_HOST),
    port,
    secure,
    auth: {
      user: smtpUser(),
      pass: env('SMTP_PASS'),
    },
  })
}

const SERVICE_LABELS = {
  lackdesign: 'Lackiererei',
  aufbereitung: 'Aufbereitung',
  waschstrasse: 'Waschstraße',
  beratung: 'Allgemeine Beratung',
}

export function serviceLabel(value) {
  return SERVICE_LABELS[value] || value || 'Allgemeine Beratung'
}

export function formatConsentStamp(date = new Date()) {
  const formatted = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
  return `${formatted} Uhr (Europe/Berlin)`
}

export async function sendContactMails({ name, email, phone, service, message, privacyAcceptedAt }) {
  const transport = createMailer()
  if (!transport) {
    const err = new Error('Mail ist nicht konfiguriert.')
    err.code = 'MAIL_NOT_CONFIGURED'
    throw err
  }

  const inbox = mailTo()
  const from = mailFrom()
  const topic = serviceLabel(service)
  const phoneLine = phone || 'nicht angegeben'
  const consentAt = privacyAcceptedAt || formatConsentStamp()

  await transport.sendMail({
    from,
    to: inbox,
    replyTo: email,
    subject: `Anfrage Website: ${topic} – ${name}`,
    text: [
      'Neue Anfrage über das Kontaktformular',
      '',
      `Name: ${name}`,
      `E-Mail: ${email}`,
      `Telefon: ${phoneLine}`,
      `Leistung: ${topic}`,
      '',
      'Nachricht:',
      message,
      '',
      'Datenschutz-Einwilligung:',
      'Der Absender hat die Datenschutzerklärung bestätigt.',
      `Zeitpunkt: ${consentAt}`,
    ].join('\n'),
  })

  await transport.sendMail({
    from,
    to: email,
    replyTo: inbox,
    subject: 'Ihre Anfrage bei Lackdesign – wir haben Ihre Nachricht erhalten',
    text: [
      `Guten Tag ${name},`,
      '',
      'vielen Dank für Ihre Anfrage bei Lackdesign.',
      'Wir haben Ihre Nachricht erhalten und melden uns innerhalb von 24 Stunden bei Ihnen.',
      '',
      'Ihre Angaben:',
      `Leistung: ${topic}`,
      `Telefon: ${phoneLine}`,
      '',
      'Ihre Nachricht:',
      message,
      '',
      'Bei Rückfragen erreichen Sie uns unter:',
      'Telefon: +49 160 90222734',
      'E-Mail: info@lackdesign-owl.de',
      '',
      'Mit freundlichen Grüßen',
      'Ihr Team von Lackdesign',
      'Christof Lempa',
      'Siemensstraße 18, 33397 Rietberg',
    ].join('\n'),
  })
}
