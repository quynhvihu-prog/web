// api/submit-contact.js
// POST /api/submit-contact
// Receives contact form submissions from contact.html

import { supabase } from './_lib/supabase.js';
import {
  isValidEmail, sanitize,
  isHoneypotTripped, isTooFast,
  corsHeaders, ok, badRequest, serverError, spamRejected
} from './_lib/validate.js';

export default async function handler(req, res) {
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  if (isHoneypotTripped(body)) return spamRejected(res);
  if (isTooFast(body))         return spamRejected(res);

  const name    = sanitize(body.name);
  const email   = sanitize(body.email);
  const message = sanitize(body.message);
  const reason  = sanitize(body.reason);

  if (!name)                return badRequest(res, 'Name is required.');
  if (!isValidEmail(email)) return badRequest(res, 'A valid email is required.');
  if (!message && !reason)  return badRequest(res, 'Please include a message or reason.');

  const row = {
    name,
    email:    email.toLowerCase(),
    message,
    reason,
    whatsapp: sanitize(body.whatsapp),
    source:   sanitize(body.source) || 'contact'
  };

  const { error } = await supabase
    .from('contact_leads')
    .insert([row]);

  if (error) {
    console.error('Supabase insert error (contact):', error);
    return serverError(res);
  }

  return ok(res, { message: 'Contact saved.' });
}
