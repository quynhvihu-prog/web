// api/submit-early-access.js
// POST /api/submit-early-access
// Receives early access applications from early-access.html

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

  const name  = sanitize(body.name);
  const email = sanitize(body.email);

  if (!name)                return badRequest(res, 'Name is required.');
  if (!isValidEmail(email)) return badRequest(res, 'A valid email is required.');

  const row = {
    name,
    email:             email.toLowerCase(),
    whatsapp:          sanitize(body.whatsapp),
    role:              sanitize(body.role),
    goal:              sanitize(body.goal),
    current_challenge: sanitize(body.currentChallenge || body.current_challenge),
    interested_plan:   sanitize(body.interestedPlan   || body.interested_plan),
    source:            sanitize(body.source) || 'early-access'
  };

  const { error } = await supabase
    .from('early_access_leads')
    .insert([row]);

  if (error) {
    console.error('Supabase insert error (early access):', error);
    return serverError(res);
  }

  return ok(res, { message: 'Early access lead saved.' });
}
