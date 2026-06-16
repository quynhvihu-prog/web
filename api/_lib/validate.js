// api/_lib/validate.js
// Shared validation helpers used by all API routes

// ── EMAIL VALIDATION ─────────────────────────────────────────
export function isValidEmail(email) {
  return typeof email === 'string' &&
    /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}

// ── SANITIZE: strip HTML/script tags from any string ────────
export function sanitize(value) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, '').trim().slice(0, 5000);
}

// ── SANITIZE ARRAY: ensures jsonb arrays are clean ──────────
export function sanitizeArray(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(item => sanitize(String(item))).slice(0, 20);
}

// ── SPAM / HONEYPOT CHECK ────────────────────────────────────
// The frontend includes a hidden field called "website_hp".
// Real users will never fill it. Bots usually do.
export function isHoneypotTripped(body) {
  return !!body.website_hp;
}

// ── TOO-FAST SUBMISSION CHECK ────────────────────────────────
// Frontend sends a timestamp of when the form was first loaded.
// If the form was submitted in under 3 seconds, it is likely a bot.
export function isTooFast(body) {
  const loadedAt = parseInt(body._loadedAt, 10);
  if (!loadedAt || isNaN(loadedAt)) return false;
  const elapsed = Date.now() - loadedAt;
  return elapsed < 3000; // less than 3 seconds
}

// ── CORS HEADERS ─────────────────────────────────────────────
// Allows requests from your domain only.
// Update ALLOWED_ORIGIN to your actual domain in production.
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

// ── STANDARD RESPONSE HELPERS ────────────────────────────────
export function ok(res, data = {}) {
  return res.status(200).json({ success: true, ...data });
}

export function badRequest(res, message) {
  return res.status(400).json({ success: false, error: message });
}

export function serverError(res, message = 'Server error. Please try again.') {
  return res.status(500).json({ success: false, error: message });
}

export function spamRejected(res) {
  // Return 200 to not give bots feedback that they were detected
  return res.status(200).json({ success: true });
}
