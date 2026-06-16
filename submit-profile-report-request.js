// api/submit-profile-report-request.js
// POST /api/submit-profile-report-request
// Receives a profile report request from profile-report.html

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
  if (!body.consent)        return badRequest(res, 'Consent is required.');

  // At least one profile URL must be provided
  const linkedin   = sanitize(body.linkedin_url  || body.linkedinUrl);
  const instagram  = sanitize(body.instagram_url || body.instagramUrl);
  const xUrl       = sanitize(body.x_url         || body.xUrl);
  const websiteUrl = sanitize(body.website_url   || body.websiteUrl);

  if (!linkedin && !instagram && !xUrl && !websiteUrl) {
    return badRequest(res, 'Please provide at least one public profile link.');
  }

  const row = {
    diagnosis_id:       body.diagnosisId || body.diagnosis_id || null,
    name,
    email:              email.toLowerCase(),
    linkedin_url:       linkedin,
    instagram_url:      instagram,
    x_url:              xUrl,
    website_url:        websiteUrl,
    current_headline:   sanitize(body.current_headline || body.currentHeadline),
    current_bio:        sanitize(body.current_bio      || body.currentBio),
    recent_post_topics: sanitize(body.recent_post_topics || body.recentPostTopics),
    goal:               sanitize(body.goal),
    consent:            true
  };

  const { error } = await supabase
    .from('profile_report_requests')
    .insert([row]);

  if (error) {
    console.error('Supabase insert error (profile report):', error);
    return serverError(res);
  }

  return ok(res, { message: 'Profile report request saved.' });
}
