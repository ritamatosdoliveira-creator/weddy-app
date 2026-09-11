// api/auth-email.js
// Endpoint serverless (Vercel) que substitui o envio automático de
// emails do Firebase Auth (reset de password / confirmação de email)
// por um envio próprio, com HTML totalmente personalizado.
//
// Fluxo: o Admin SDK gera o link de ação (não envia nada) -> nós
// metemos esse link dentro do nosso template -> enviamos via Resend.

const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { Resend } = require('resend');

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    }),
  });
}

const resend = new Resend(process.env.RESEND_API_KEY);

// Origem do site (para o CORS e para onde o link devolve o utilizador).
// Muda para o teu domínio final antes de publicares.
const SITE_URL = process.env.SITE_URL || 'https://o-teu-site.pt';
const FROM_ADDRESS = process.env.FROM_ADDRESS || 'Weddy <naoresponder@o-teu-dominio.pt>';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', SITE_URL);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'método não permitido' });

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { type, email } = body || {};

  if (!email || !['reset', 'verify'].includes(type)) {
    return res.status(400).json({ error: 'dados inválidos' });
  }

  const actionCodeSettings = {
    url: SITE_URL + '/',
    handleCodeInApp: false,
  };

  try {
    if (type === 'reset') {
      const link = await getAuth().generatePasswordResetLink(email, actionCodeSettings);
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: 'Repõe a tua password — Weddy',
        html: resetEmailHTML(link),
      });
    } else {
      const link = await getAuth().generateEmailVerificationLink(email, actionCodeSettings);
      await resend.emails.send({
        from: FROM_ADDRESS,
        to: email,
        subject: 'Confirma o teu email — Weddy',
        html: verifyEmailHTML(link),
      });
    }
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('auth-email error:', err && err.code, err && err.message);
    // Não revelamos se o email existe ou não (evita enumeração de contas).
    if (err && err.code === 'auth/user-not-found') {
      return res.status(200).json({ ok: true });
    }
    return res.status(500).json({ error: 'não foi possível enviar o email' });
  }
};

function baseWrapper(title, bodyHTML) {
  return `
  <div style="background:#FAF8F5;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <h1 style="font-size:20px;color:#3C332B;margin:0 0 16px;">${title}</h1>
      ${bodyHTML}
      <p style="font-size:12px;color:#9a8f83;margin-top:32px;">Se não pediste isto, podes ignorar este email.</p>
    </div>
  </div>`;
}

function resetEmailHTML(link) {
  return baseWrapper('Repõe a tua password', `
    <p style="color:#3C332B;font-size:15px;line-height:1.6;">Recebemos um pedido para repor a password da tua conta Weddy.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${link}" style="background:#3C332B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;">Repor password</a>
    </p>
    <p style="color:#9a8f83;font-size:12px;">Este link expira em breve, por motivos de segurança.</p>
  `);
}

function verifyEmailHTML(link) {
  return baseWrapper('Confirma o teu email', `
    <p style="color:#3C332B;font-size:15px;line-height:1.6;">Falta só confirmar o teu email para começares a usar o Weddy.</p>
    <p style="text-align:center;margin:28px 0;">
      <a href="${link}" style="background:#3C332B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;">Confirmar email</a>
    </p>
  `);
}
