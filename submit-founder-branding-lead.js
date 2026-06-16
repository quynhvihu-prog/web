// api/submit-founder-branding-lead.js
// POST /api/submit-founder-branding-lead
// Receives leads from founder-personal-branding-service.html
// and executive-brand-studio.html

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
    company:           sanitize(body.company),
    role:              sanitize(body.role),
    website:           sanitize(body.website),
    linkedin_url:      sanitize(body.linkedinUrl     || body.linkedin_url),
    main_goal:         sanitize(body.mainGoal        || body.main_goal),
    current_challenge: sanitize(body.currentChallenge || body.current_challenge),
    budget_range:      sanitize(body.budgetRange     || body.budget_range),
    message:           sanitize(body.message),
    source:            sanitize(body.source) || 'founder-branding'
  };

  const { error } = await supabase
    .from('founder_branding_leads')
    .insert([row]);

  if (error) {
    console.error('Supabase insert error (founder branding):', error);
    return serverError(res);
  }

  return ok(res, { message: 'Founder branding lead saved.' });
}
