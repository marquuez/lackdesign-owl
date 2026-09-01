import nodemailer from 'nodemailer'

function env(name) {
  return process.env[name]?.trim() || ''
}

export function getPublicContact() {
  const phone = env('LACKDESIGN_PHONE')
  const email = env('LACKDESIGN_MAIL') || env('MAIL_FROM') || env('SMTP_USER')
  const tel = phone.replace(/[^\d+]/g, '')
  return {
    phone,
    phoneHref: tel ? `tel:${tel}` : '',
    email,
    mailHref: email ? `mailto:${email}` : '',
  }
}

export function isMailConfigured() {
  return Boolean(env('SMTP_HOST') && env('SMTP_USER') && env('SMTP_PASS') && (env('MAIL_TO') || env('SMTP_USER')))
}

export function createMailer() {
  if (!isMailConfigured()) return null
  const port = Number(env('SMTP_PORT') || '465')
  const secure = env('SMTP_SECURE') ? env('SMTP_SECURE') === '1' || env('SMTP_SECURE') === 'true' : port === 465
  return nodemailer.createTransport({
    host: env('SMTP_HOST') || 'smtp.strato.de',
    port,
    secure,
    auth: {
      user: env('SMTP_USER'),
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

export async function sendContactMails({ name, email, phone, service, message }) {
  const transport = createMailer()
  if (!transport) {
    const err = new Error('Mail ist nicht konfiguriert.')
    err.code = 'MAIL_NOT_CONFIGURED'
    throw err
  }

  const inbox = env('MAIL_TO') || env('SMTP_USER')
  const from = env('MAIL_FROM') || env('SMTP_USER')
  const topic = serviceLabel(service)
  const phoneLine = phone ? phone : 'nicht angegeben'

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
    ].join('\n'),
  })

  await transport.sendMail({
    from,
    to: email,
    subject: 'Ihre Anfrage bei Lackdesign',
    text: [
      `Guten Tag ${name},`,
      '',
      'vielen Dank für Ihre Anfrage bei Lackdesign. Wir haben Ihre Nachricht erhalten und melden uns in der Regel innerhalb unserer Öffnungszeiten.',
      '',
      'Ihre Angaben:',
      `Leistung: ${topic}`,
      phone ? `Telefon: ${phone}` : null,
      '',
      'Nachricht:',
      message,
      '',
      'Lackdesign',
      'Christof Lempa',
      'Siemensstraße 18, 33397 Rietberg',
    ]
      .filter(Boolean)
      .join('\n'),
  })
}
