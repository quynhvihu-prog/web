/**
 * knownly-api.js
 * ─────────────────────────────────────────────────────────────
 * Drop this file into your project root.
 * Add <script src="/knownly-api.js"></script> before </body>
 * in every HTML page that needs to submit data.
 *
 * This file:
 *  - Adds honeypot fields and load timestamps to forms automatically
 *  - Submits data to your Vercel API routes
 *  - Keeps localStorage as a backup
 *  - Works with your existing HTML without redesigning anything
 * ─────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────────
  // Change this to your Vercel deployment URL during development,
  // then switch to your production domain before going live.
  const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'   // local Vercel dev server
    : '';                        // same domain in production (relative URLs work)

  // ── HELPERS ─────────────────────────────────────────────────

  // Validates email format before sending to the server
  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((email || '').trim());
  }

  // Returns the stored diagnosisId from localStorage (for linking reports)
  function getDiagnosisId() {
    try {
      const raw = localStorage.getItem('knownlyDiagnosisData');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed.diagnosisId || null;
    } catch (e) { return null; }
  }

  // Saves a key to localStorage silently
  function saveLocal(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  // POST to one of your /api/ routes
  async function postToApi(endpoint, payload) {
    const url = API_BASE + endpoint;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        _loadedAt: window.__knownlyLoadedAt || Date.now(),
        website_hp: ''   // honeypot — left empty by real users
      })
    });
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Submission failed');
    }
    return data;
  }

  // Shows an inline error message near a button
  function showFormError(buttonEl, message) {
    let errEl = buttonEl.parentElement.querySelector('.knownly-api-error');
    if (!errEl) {
      errEl = document.createElement('p');
      errEl.className = 'knownly-api-error';
      errEl.style.cssText = 'color:#E07070;font-size:13px;margin-top:10px;';
      buttonEl.parentElement.appendChild(errEl);
    }
    errEl.textContent = message;
  }

  function clearFormError(buttonEl) {
    const errEl = buttonEl.parentElement.querySelector('.knownly-api-error');
    if (errEl) errEl.textContent = '';
  }

  // Sets button to loading state and returns a restore function
  function setLoading(button, loadingText) {
    const original = button.textContent;
    button.disabled = true;
    button.textContent = loadingText || 'Saving...';
    return () => {
      button.disabled = false;
      button.textContent = original;
    };
  }

  // ── RECORD PAGE LOAD TIME (for too-fast detection) ──────────
  window.__knownlyLoadedAt = Date.now();


  // ════════════════════════════════════════════════════════════
  // 1. DIAGNOSIS FORM SUBMISSION
  //    Used in: diagnosis.html
  //    Triggered from the existing btnSubmit click handler.
  //    Call window.KnownlyAPI.submitDiagnosis(answersObject)
  //    from inside your existing validateStep11() success block.
  // ════════════════════════════════════════════════════════════
  async function submitDiagnosis(answers) {
    // answers comes directly from the diagnosis.js answers object
    const payload = {
      name:              answers.lead?.name,
      email:             answers.lead?.email,
      whatsapp:          answers.lead?.whatsapp,
      stage:             answers.currentStage,
      mainGoal:          answers.mainGoal,
      strengths:         answers.naturalStrengths,
      topics:            answers.topics,
      otherTopic:        answers.otherTopic,
      perceivedFor:      answers.perceivedFor,
      proofExperience:   answers.proofExperience,
      naturalStyle:      answers.naturalStyle,
      contentComfort:    answers.contentComfort,
      avoidStyle:        answers.avoidStyle,
      blocker:           answers.currentBlocker,
      outcomeGoal:       answers.desiredOutcome,
      platforms:         answers.platforms,
      timeAvailable:     answers.timeAvailable,
      consent:           true,
      source:            'diagnosis'
    };

    const result = await postToApi('/api/submit-diagnosis', payload);

    // Store the returned diagnosisId in localStorage so result.html can use it
    if (result.diagnosisId) {
      const existing = JSON.parse(localStorage.getItem('knownlyDiagnosisData') || '{}');
      saveLocal('knownlyDiagnosisData', { ...existing, diagnosisId: result.diagnosisId });
    }

    return result;
  }


  // ════════════════════════════════════════════════════════════
  // 2. PROFILE REPORT REQUEST
  //    Used in: profile-report.html
  //    Call window.KnownlyAPI.submitProfileReport(formData)
  // ════════════════════════════════════════════════════════════
  async function submitProfileReport(formData) {
    const payload = {
      ...formData,
      diagnosisId: getDiagnosisId(),
      source: 'profile-report'
    };
    return postToApi('/api/submit-profile-report-request', payload);
  }


  // ════════════════════════════════════════════════════════════
  // 3. PAID PLAN INTEREST
  //    Used in: pricing.html
  //    Call window.KnownlyAPI.submitPaidInterest(formData)
  // ════════════════════════════════════════════════════════════
  async function submitPaidInterest(formData) {
    return postToApi('/api/submit-paid-interest', { ...formData, source: 'pricing' });
  }


  // ════════════════════════════════════════════════════════════
  // 4. CONTACT FORM
  //    Used in: contact.html
  //    Automatically attaches to a form with id="contactForm"
  // ════════════════════════════════════════════════════════════
  function initContactForm() {
    const form = document.getElementById('contactForm');
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"], #submitBtn, button[class*="submit"]');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      clearFormError(submitBtn);

      const name    = (form.querySelector('#name')    || form.querySelector('[name="name"]'))?.value.trim();
      const email   = (form.querySelector('#email')   || form.querySelector('[name="email"]'))?.value.trim();
      const message = (form.querySelector('#message') || form.querySelector('[name="message"]'))?.value.trim();
      const reason  = (form.querySelector('#reason')  || form.querySelector('[name="reason"]'))?.value.trim();
      const whatsapp = form.querySelector('#whatsapp')?.value.trim();

      if (!name)                { showFormError(submitBtn, 'Please enter your name.'); return; }
      if (!isValidEmail(email)) { showFormError(submitBtn, 'Please enter a valid email.'); return; }
      if (!message && !reason)  { showFormError(submitBtn, 'Please include a message.'); return; }

      const restore = setLoading(submitBtn, 'Sending...');

      try {
        // Save to localStorage first (existing behaviour)
        saveLocal('knownlyContactLead', { name, email, whatsapp, reason, message, submittedAt: new Date().toISOString() });

        // Then submit to API
        await postToApi('/api/submit-contact', { name, email, whatsapp, message, reason, source: 'contact' });

        window.location.href = '/thank-you.html';
      } catch (err) {
        restore();
        showFormError(submitBtn, err.message || 'Something went wrong. Please try again.');
      }
    });
  }


  // ════════════════════════════════════════════════════════════
  // 5. EARLY ACCESS FORM
  //    Used in: early-access.html
  //    Automatically attaches to a form with id="earlyAccessForm"
  // ════════════════════════════════════════════════════════════
  function initEarlyAccessForm() {
    const form = document.getElementById('earlyAccessForm');
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"], button[class*="submit"], button[class*="cta"]');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      clearFormError(submitBtn);

      const name     = form.querySelector('#ea-name,  [name="name"]')?.value.trim();
      const email    = form.querySelector('#ea-email, [name="email"]')?.value.trim();
      const whatsapp = form.querySelector('#ea-whatsapp, [name="whatsapp"]')?.value.trim();
      const role     = form.querySelector('#ea-role,  [name="role"]')?.value.trim();
      const goal     = form.querySelector('#ea-goal,  [name="goal"]')?.value.trim();

      if (!name)                { showFormError(submitBtn, 'Please enter your name.'); return; }
      if (!isValidEmail(email)) { showFormError(submitBtn, 'Please enter a valid email.'); return; }

      const restore = setLoading(submitBtn, 'Applying...');

      try {
        saveLocal('knownlyEarlyAccessLead', { name, email, whatsapp, role, goal, submittedAt: new Date().toISOString() });

        await postToApi('/api/submit-early-access', {
          name, email, whatsapp, role, goal, source: 'early-access'
        });

        window.location.href = '/thank-you.html';
      } catch (err) {
        restore();
        showFormError(submitBtn, err.message || 'Something went wrong. Please try again.');
      }
    });
  }


  // ════════════════════════════════════════════════════════════
  // 6. FOUNDER / EXECUTIVE STUDIO LEAD FORM
  //    Automatically attaches to a form with id="founderLeadForm"
  // ════════════════════════════════════════════════════════════
  function initFounderLeadForm() {
    const form = document.getElementById('founderLeadForm');
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"], button[class*="submit"], button[class*="cta"]');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      clearFormError(submitBtn);

      const name    = form.querySelector('#fl-name,  [name="name"]')?.value.trim();
      const email   = form.querySelector('#fl-email, [name="email"]')?.value.trim();
      const company = form.querySelector('#fl-company, [name="company"]')?.value.trim();
      const message = form.querySelector('#fl-message, [name="message"]')?.value.trim();
      const source  = form.dataset.source || 'founder-branding';

      if (!name)                { showFormError(submitBtn, 'Please enter your name.'); return; }
      if (!isValidEmail(email)) { showFormError(submitBtn, 'Please enter a valid email.'); return; }

      const restore = setLoading(submitBtn, 'Submitting...');

      try {
        const payload = {
          name, email, company, message,
          whatsapp:    form.querySelector('[name="whatsapp"]')?.value.trim(),
          role:        form.querySelector('[name="role"]')?.value.trim(),
          mainGoal:    form.querySelector('[name="mainGoal"], [name="main_goal"]')?.value.trim(),
          budgetRange: form.querySelector('[name="budgetRange"], [name="budget_range"]')?.value.trim(),
          source
        };

        saveLocal('knownlyFounderLead', { ...payload, submittedAt: new Date().toISOString() });

        await postToApi('/api/submit-founder-branding-lead', payload);

        window.location.href = '/thank-you.html';
      } catch (err) {
        restore();
        showFormError(submitBtn, err.message || 'Something went wrong. Please try again.');
      }
    });
  }


  // ════════════════════════════════════════════════════════════
  // 7. PRICING / PAID INTEREST FORM
  //    Automatically attaches to a form with id="pricingInterestForm"
  // ════════════════════════════════════════════════════════════
  function initPricingForm() {
    const form = document.getElementById('pricingInterestForm');
    if (!form) return;

    const submitBtn = form.querySelector('[type="submit"], button[class*="submit"]');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', async function (e) {
      e.preventDefault();
      clearFormError(submitBtn);

      const name  = form.querySelector('#pi-name,  [name="name"]')?.value.trim();
      const email = form.querySelector('#pi-email, [name="email"]')?.value.trim();
      const plan  = form.querySelector('#pi-plan,  [name="selectedPlan"]')?.value.trim() || form.dataset.plan;

      if (!name)                { showFormError(submitBtn, 'Please enter your name.'); return; }
      if (!isValidEmail(email)) { showFormError(submitBtn, 'Please enter a valid email.'); return; }

      const restore = setLoading(submitBtn, 'Saving...');

      try {
        const payload = {
          name, email, selectedPlan: plan,
          whatsapp:    form.querySelector('[name="whatsapp"]')?.value.trim(),
          goal:        form.querySelector('[name="goal"]')?.value.trim(),
          source:      'pricing'
        };

        saveLocal('knownlyPricingLead', { ...payload, submittedAt: new Date().toISOString() });

        await postToApi('/api/submit-paid-interest', payload);

        window.location.href = '/thank-you.html';
      } catch (err) {
        restore();
        showFormError(submitBtn, err.message || 'Something went wrong. Please try again.');
      }
    });
  }


  // ── AUTO-INIT: attach to any forms present on the current page ──
  document.addEventListener('DOMContentLoaded', function () {
    initContactForm();
    initEarlyAccessForm();
    initFounderLeadForm();
    initPricingForm();
  });


  // ── PUBLIC API ──────────────────────────────────────────────
  // Used by diagnosis.html and profile-report.html which have
  // custom multi-step forms that can't be auto-detected.
  window.KnownlyAPI = {
    submitDiagnosis,
    submitProfileReport,
    submitPaidInterest,
    postToApi,
    setLoading,
    showFormError,
    clearFormError,
    isValidEmail,
    getDiagnosisId
  };

})();
