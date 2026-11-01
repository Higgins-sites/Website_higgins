/**
 * Project intake form
 * - Switches between the "New Project" and "Security Program / Review" branches
 * - Keeps hidden branch fields out of validation and out of the submitted data
 * - Submits to `data-endpoint` if one is set (Formspree-compatible),
 *   otherwise opens a pre-filled email draft.
 */
(function () {
  const form = document.getElementById('intakeForm');
  if (!form) return;

  const branches = Array.from(document.querySelectorAll('.branch'));
  const radios = form.querySelectorAll('input[name="requestType"]');
  const alertBox = document.getElementById('formAlert');
  const submitBtn = document.getElementById('submitBtn');
  const summaryPanel = document.getElementById('summaryPanel');
  const summaryText = document.getElementById('summaryText');
  const copyBtn = document.getElementById('copyBtn');
  const mailtoFallback = document.getElementById('mailtoFallback');
  const finalStepNum = document.getElementById('finalStepNum');

  const needUnknown = document.getElementById('needUnknown');
  const specificNeeds = document.getElementById('specificNeeds');
  const generalConcerns = document.getElementById('generalConcerns');
  const generalConcernsField = document.getElementById('generalConcernsField');
  const needsError = document.getElementById('needsError');
  const engagementTypeError = document.getElementById('engagementTypeError');

  const CONTACT_EMAIL = 'jadenbrucehiggins@gmail.com';

  /* ------------------------------------------------------------
   * Branch switching
   * ---------------------------------------------------------- */
  function activeBranchName() {
    const checked = form.querySelector('input[name="requestType"]:checked');
    return checked ? checked.value : null;
  }

  function syncBranches() {
    const active = activeBranchName();

    branches.forEach(function (branch) {
      const isActive = branch.dataset.branch === active;
      branch.hidden = !isActive;

      // Disable everything inside an inactive branch so it is neither
      // validated nor included in the submitted data.
      branch.querySelectorAll('input, select, textarea').forEach(function (el) {
        el.disabled = !isActive;
      });

      if (!isActive) {
        branch.querySelectorAll('.field-error').forEach(function (err) {
          err.hidden = true;
        });
      }
    });

    if (finalStepNum) finalStepNum.textContent = active ? '5' : '3';
    if (needsError) needsError.hidden = true;
    if (engagementTypeError) engagementTypeError.hidden = true;
    hideAlert();
  }

  radios.forEach(function (radio) {
    radio.addEventListener('change', syncBranches);
  });

  // Clear the "pick at least one" error as soon as a box is ticked.
  form.querySelectorAll('input[name="engagementType"]').forEach(function (box) {
    box.addEventListener('change', function () {
      if (engagementTypeError) engagementTypeError.hidden = true;
    });
  });

  /* ------------------------------------------------------------
   * "No specific need" toggle
   * ---------------------------------------------------------- */
  if (needUnknown) {
    needUnknown.addEventListener('change', function () {
      if (!generalConcernsField) return;
      generalConcernsField.classList.toggle('is-emphasised', needUnknown.checked);
      if (needUnknown.checked) {
        generalConcerns.focus();
        needsError.hidden = true;
      }
    });
  }

  if (specificNeeds) {
    specificNeeds.addEventListener('input', function () { needsError.hidden = true; });
  }
  if (generalConcerns) {
    generalConcerns.addEventListener('input', function () { needsError.hidden = true; });
  }

  /* ------------------------------------------------------------
   * Labels for the email summary
   * ---------------------------------------------------------- */
  function cleanText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll('.req, .hint-inline, .field-error, .hint').forEach(function (n) {
      n.remove();
    });
    return clone.textContent.replace(/\s+/g, ' ').trim();
  }

  function cleanLabel(text) {
    return text.replace(/[\s:?]+$/, '');
  }

  function labelFor(el) {
    const field = el.closest('.field');
    if (field) {
      const label = field.querySelector('label[for="' + el.id + '"]');
      if (label) return cleanText(label);
      const legend = field.closest('fieldset') ? field.closest('fieldset').querySelector('legend') : null;
      if (!field.querySelector('label[for="' + el.id + '"]') && legend) return cleanText(legend);
    }

    const fieldset = el.closest('fieldset');
    if (fieldset && fieldset.querySelector('legend')) {
      return cleanText(fieldset.querySelector('legend'));
    }

    if (el.closest('.check')) {
      const wrap = el.closest('.check');
      const label = wrap.querySelector('span');
      if (label) return cleanText(label);
    }

    const anyLabel = el.closest('label');
    if (anyLabel) return cleanText(anyLabel);

    return el.name;
  }

  const SKIP_NAMES = ['website', 'consent', 'needUnknown'];
  const BUDGET_TIMELINE_LABELS = {
    projectBudget: 'Budget',
    securityBudget: 'Budget',
    projectTimeline: 'Timeline',
    securityTimeline: 'Timeline',
    projectStart: 'Target start',
    securityStart: 'Target start',
    projectDeadline: 'Hard deadline',
    securityDeadline: 'Hard deadline'
  };

  function collectAnswers() {
    const lines = [];
    const handledGroups = new Set();

    const elements = form.querySelectorAll('input, select, textarea');
    elements.forEach(function (el) {
      if (el.disabled) return;
      if (el.type === 'submit' || el.type === 'button') return;
      if (SKIP_NAMES.indexOf(el.name) !== -1) return;

      // Radio group (request type)
      if (el.type === 'radio') {
        if (handledGroups.has(el.name)) return;
        handledGroups.add(el.name);
        const checked = form.querySelector('input[name="' + el.name + '"]:checked');
        if (checked) lines.push('Request type: ' + checked.value);
        return;
      }

      // Checkbox groups
      if (el.type === 'checkbox') {
        if (handledGroups.has(el.name)) return;
        handledGroups.add(el.name);
        const group = Array.from(form.querySelectorAll('input[name="' + el.name + '"]'));
        const values = group.filter(function (c) { return c.checked; }).map(function (c) {
          return c.value;
        });
        if (values.length) {
          lines.push(cleanLabel(labelFor(el) || el.name) + ': ' + values.join(', '));
        }
        return;
      }

      const value = (el.value || '').trim();
      if (!value) return;

      const label = BUDGET_TIMELINE_LABELS[el.name] || cleanLabel(labelFor(el));
      lines.push(label + ': ' + value);
    });

    return lines;
  }

  function buildSummaryText(lines) {
    const mode = activeBranchName();
    const header = [
      'New client intake — ' + mode,
      'Submitted: ' + new Date().toLocaleString()
    ];
    return header.join('\n') + '\n\n' + lines.join('\n');
  }

  /* ------------------------------------------------------------
   * Alerts
   * ---------------------------------------------------------- */
  function showAlert(message) {
    alertBox.textContent = message;
    alertBox.hidden = false;
    alertBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function hideAlert() {
    alertBox.hidden = true;
    alertBox.textContent = '';
  }

  /* ------------------------------------------------------------
   * Custom validation
   * ---------------------------------------------------------- */
  function validateExtra() {
    const mode = activeBranchName();
    if (mode !== 'Security Program / Review') return true;

    const types = form.querySelectorAll('input[name="engagementType"]:checked');
    if (!types.length) {
      engagementTypeError.hidden = false;
      engagementTypeError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }

    const hasNeed = (specificNeeds.value || '').trim().length > 0;
    const hasConcern = (generalConcerns.value || '').trim().length > 0;
    if (!hasNeed && !hasConcern) {
      needsError.hidden = false;
      generalConcernsField.classList.add('is-emphasised');
      (needUnknown.checked ? generalConcerns : specificNeeds).focus();
      return false;
    }

    return true;
  }

  /* ------------------------------------------------------------
   * Submit
   * ---------------------------------------------------------- */
  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideAlert();

    // Bot trap
    const honeypot = form.querySelector('input[name="website"]');
    if (honeypot && honeypot.value.trim()) {
      return showSummary('');
    }

    if (!validateExtra()) return;

    if (!form.reportValidity()) return;

    const lines = collectAnswers();
    const summary = buildSummaryText(lines);
    const mode = activeBranchName();
    const nameField = form.elements['name'];
    const contactName = nameField && nameField.value ? nameField.value.trim() : 'Website enquiry';
    const subject = 'Project intake — ' + mode + ' — ' + contactName;

    const endpoint = (form.dataset.endpoint || '').trim();

    if (endpoint) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ subject: subject, summary: summary, mode: mode })
        });
        if (!res.ok) throw new Error('Request failed: ' + res.status);
        showSummary(summary, true);
      } catch (err) {
        openMailto(subject, summary);
        showSummary(summary);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send my answers';
      }
      return;
    }

    openMailto(subject, summary);
    showSummary(summary);
  });

  function openMailto(subject, summary) {
    // Keep the URL within practical mail client limits.
    const maxBody = 1800;
    const body = summary.length > maxBody ? summary.slice(0, maxBody) + '\n\n[Truncated — full answers copied to the page]' : summary;
    const url = 'mailto:' + CONTACT_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = url;
  }

  function showSummary(summary, sentToServer) {
    const intro = document.getElementById('summaryIntro');
    if (intro) {
      if (sentToServer) {
        intro.textContent = 'Thanks — your answers have been sent. A copy is below for your records.';
      } else {
        intro.innerHTML = 'Thanks — your email draft should be open. If it didn\'t open, copy the summary below and send it to ' +
          '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>.';
      }
    }
    if (summaryText) summaryText.textContent = summary;
    if (mailtoFallback) {
      mailtoFallback.href = 'mailto:' + CONTACT_EMAIL +
        '?subject=' + encodeURIComponent('Project intake') +
        '&body=' + encodeURIComponent(summary.slice(0, 1800));
    }
    summaryPanel.hidden = false;
    form.hidden = sentToServer ? true : false;
    summaryPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ------------------------------------------------------------
   * Copy button
   * ---------------------------------------------------------- */
  if (copyBtn) {
    copyBtn.addEventListener('click', async function () {
      const text = summaryText.textContent;
      try {
        await navigator.clipboard.writeText(text);
        copyBtn.textContent = 'Copied';
      } catch (err) {
        const range = document.createRange();
        range.selectNodeContents(summaryText);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        copyBtn.textContent = 'Press Ctrl+C to copy';
      }
      setTimeout(function () { copyBtn.textContent = 'Copy summary'; }, 2500);
    });
  }

  /* ------------------------------------------------------------
   * Init
   * ---------------------------------------------------------- */
  // No request type is pre-selected, so start with both branches hidden.
  syncBranches();
})();
