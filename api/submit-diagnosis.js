// api/submit-diagnosis.js
// POST /api/submit-diagnosis
// Receives the completed Knownly Diagnosis form, validates it,
// saves it to Supabase, and returns the new row's ID so the
// frontend can store it in localStorage for the result page.

import { supabase } from './_lib/supabase.js';
import {
  isValidEmail, sanitize, sanitizeArray,
  isHoneypotTripped, isTooFast,
  corsHeaders, ok, badRequest, serverError, spamRejected
} from './_lib/validate.js';

export default async function handler(req, res) {
  // ── CORS preflight ──────────────────────────────────────────
  const headers = corsHeaders();
  Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ── Method guard ────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // ── Spam protection ─────────────────────────────────────────
  if (isHoneypotTripped(body)) return spamRejected(res);
  if (isTooFast(body))         return spamRejected(res);

  // ── Required field validation ────────────────────────────────
  const name  = sanitize(body.name);
  const email = sanitize(body.email);

  if (!name)             return badRequest(res, 'Name is required.');
  if (!isValidEmail(email)) return badRequest(res, 'A valid email is required.');
  if (!body.consent)     return badRequest(res, 'Consent is required.');

  // ── Build the row ────────────────────────────────────────────
  const row = {
    name,
    email:              email.toLowerCase(),
    stage:              sanitize(body.stage),
    main_goal:          sanitize(body.mainGoal || body.main_goal),
    strengths:          sanitizeArray(body.strengths || body.naturalStrengths),
    topics:             sanitizeArray(body.topics),
    perceived_for:      sanitize(body.perceivedFor || body.perceived_for),
    proof_experience:   sanitize(body.proofExperience || body.proof_experience),
    expression_style:   sanitize(body.naturalStyle || body.expression_style),
    content_comfort:    sanitizeArray(body.contentComfort || body.content_comfort),
    avoid_style:        sanitize(body.avoidStyle || body.avoid_style),
    blocker:            sanitize(body.currentBlocker || body.blocker),
    outcome_goal:       sanitize(body.desiredOutcome || body.outcome_goal),
    platforms:          sanitizeArray(body.platforms),
    time_available:     sanitize(body.timeAvailable || body.time_available),
    consent:            true,
    source:             sanitize(body.source) || 'diagnosis'
  };

  // ── Insert into Supabase ─────────────────────────────────────
  const { data, error } = await supabase
    .from('diagnosis_submissions')
    .insert([row])
    .select('id')
    .single();

  if (error) {
    console.error('Supabase insert error (diagnosis):', error);
    return serverError(res, 'Could not save your diagnosis. Please try again.');
  }

  // ── Also generate and store a basic rule-based report ────────
  // (This will be replaced with an LLM call later)
  const reportRow = buildRuleBasedReport(data.id, email, row);
  await supabase.from('knownly_reports').insert([reportRow]);

  return ok(res, {
    message: 'Diagnosis saved.',
    diagnosisId: data.id
  });
}

// ── RULE-BASED REPORT GENERATOR ──────────────────────────────
// Temporary logic until LLM API is connected.
// Mirrors the computeHints() function in the frontend JS.
function buildRuleBasedReport(diagnosisId, email, row) {
  const s   = row.strengths   || [];
  const ns  = row.expression_style || '';
  const cc  = row.content_comfort  || [];
  const do_ = row.outcome_goal     || '';
  const pl  = row.platforms        || [];
  const cs  = row.stage            || '';
  const pf  = (row.perceived_for   || '').toLowerCase();
  const pr  = (row.proof_experience || '').toLowerCase();

  // Archetype
  let archetype = 'Visibility Builder';
  if (s.includes('Explaining things clearly') || ns.includes('teaching step-by-step') || pf.includes('explain') || pf.includes('simplif')) archetype = 'Trusted Educator';
  else if (s.includes('Solving practical problems') || ns.includes('simple and practical') || pf.includes('problem') || pf.includes('fix')) archetype = 'Practical Authority Builder';
  else if (s.includes('Spotting opportunities') || pf.includes('opportunit') || pf.includes('strateg')) archetype = 'Strategic Opportunity Spotter';
  else if (s.includes('Researching deeply') || ns.includes('thoughtful writing')) archetype = 'Silent Expert';
  else if (cs.includes('Founder') || pr.includes('built') || pr.includes('founded') || pr.includes('started')) archetype = 'Founder-Led Voice';
  else if (s.includes('Storytelling or communication') || pf.includes('story') || pf.includes('communicat')) archetype = 'Creative Story Educator';

  // Content style
  let contentStyle = 'Simple practical posts';
  if (cc.includes('Written posts') || cc.includes('LinkedIn-style professional posts')) contentStyle = 'Written thought leadership';
  else if (cc.includes('Short videos')) contentStyle = 'Short video insights';
  else if (cc.includes('Carousels or visual posts')) contentStyle = 'Visual educational content';
  else if (cc.includes('Case studies or examples')) contentStyle = 'Case-study based content';
  else if (cc.includes('Educational tips')) contentStyle = 'Practical educational content';
  else if (cc.includes('Personal stories')) contentStyle = 'Story-led content';

  // Platform
  let platform = 'LinkedIn';
  if (pl.includes('Instagram') && (cc.includes('Personal stories') || cc.includes('Carousels or visual posts'))) platform = 'Instagram';
  else if (pl.includes('YouTube') && cc.includes('Short videos')) platform = 'YouTube';
  else if (pl.includes('X / Twitter') && cc.includes('Threads or long-form breakdowns')) platform = 'X / Twitter';

  // Opportunity path
  let opportunity = 'Online presence clarity';
  const dlo = do_.toLowerCase();
  if (dlo.includes('job') || dlo.includes('career')) opportunity = 'Career opportunities';
  else if (dlo.includes('client') || dlo.includes('freelance')) opportunity = 'Client opportunities';
  else if (dlo.includes('founder') || dlo.includes('business')) opportunity = 'Founder credibility';
  else if (dlo.includes('authority') || dlo.includes('thought leadership')) opportunity = 'Authority building';
  else if (dlo.includes('creator') || dlo.includes('audience')) opportunity = 'Creator growth';
  else if (dlo.includes('coaching') || dlo.includes('consulting') || dlo.includes('course')) opportunity = 'Knowledge monetization';

  const knownFor = `${archetype} focused on ${(row.topics || []).slice(0, 2).join(' and ') || 'your area of expertise'}`;

  return {
    diagnosis_id:     diagnosisId,
    email:            email.toLowerCase(),
    archetype,
    known_for:        knownFor,
    summary:          `You are a ${archetype} who expresses yourself through ${contentStyle.toLowerCase()}. Your strongest opportunity is in ${opportunity.toLowerCase()}.`,
    strength_pattern: s.slice(0, 3).join(', '),
    visibility_gap:   row.blocker || 'Unclear direction',
    best_audience:    'Professionals in your area who need your insight',
    best_platform:    platform,
    content_pillars:  (row.topics || []).slice(0, 4),
    seven_day_plan:   [
      'Day 1: Update your LinkedIn headline using your Knownly direction',
      'Day 2: Write a simple About section that mentions your archetype',
      'Day 3: Post one short insight from your strongest topic area',
      'Day 4: Comment thoughtfully on 5 posts from your target audience',
      'Day 5: Share one real example or result from your experience',
      'Day 6: Write a post answering the most common question people ask you',
      'Day 7: Review what felt natural and plan your next 7 days'
    ],
    share_card_text:  `I discovered I am a ${archetype} at Knownly — and now I know what I should be known for.`,
    model_used:       'rule-based-v1'
  };
}
