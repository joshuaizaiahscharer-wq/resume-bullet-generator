const resumeBuilderState = {
  hasPaid: false,
  checkoutInProgress: false,
  checkoutError: "",
  fullName: "Jordan Lee",
  email: "jordan.lee@email.com",
  phone: "(555) 010-2784",
  location: "Austin, TX",
  professionalSummary:
    "Results-driven product marketer with 6+ years of experience launching B2B SaaS products and improving conversion across full-funnel campaigns.",
  workExperience: [
    {
      company: "Northstar Software",
      role: "Senior Product Marketing Manager",
      location: "Austin, TX",
      startDate: "2022",
      endDate: "Present",
      details:
        "Led GTM strategy for two flagship releases, increasing qualified pipeline by 34% and improving landing page conversion by 21%.",
    },
  ],
  education: [
    {
      school: "University of Texas at Austin",
      degree: "BBA, Marketing",
      location: "Austin, TX",
      startDate: "2013",
      endDate: "2017",
      details: "Graduated with honors. Led student marketing association workshops.",
    },
  ],
  skills: "Product Marketing, GTM Strategy, Messaging, Lifecycle Email, SEO, Paid Acquisition, HubSpot, Tableau",
  certifications: "Google Analytics Certification, HubSpot Inbound Marketing",
  projects: [
    {
      name: "Pricing Page Conversion Redesign",
      link: "https://example.com/case-study",
      description:
        "Redesigned pricing page narrative and CTAs, driving a 19% increase in trial starts in 90 days.",
    },
  ],
};

const elementRefs = {
  formRoot: document.getElementById("resumeBuilderFormRoot"),
  previewRoot: document.getElementById("resumePreviewRoot"),
  overlayRoot: document.getElementById("paywallOverlayRoot"),
  previewShell: document.getElementById("resumePreviewShell"),
  paymentStatusBadge: document.getElementById("paymentStatusBadge"),
  downloadBtn: document.getElementById("downloadResumeBtn"),
};

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createField({ label, key, value, type = "text", multiline = false, placeholder = "" }) {
  const inputMarkup = multiline
    ? `<textarea data-key="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input type="${escapeHtml(type)}" data-key="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />`;

  return `
    <div class="form-field">
      <label>${escapeHtml(label)}</label>
      ${inputMarkup}
    </div>
  `;
}

function createDynamicEntryCard(groupName, index, fields) {
  const fieldMarkup = fields
    .map((field) => {
      const key = `${groupName}.${index}.${field.key}`;
      return createField({
        label: field.label,
        key,
        value: field.value,
        multiline: field.multiline,
        placeholder: field.placeholder,
      });
    })
    .join("");

  return `
    <div class="entry-card">
      <div class="dynamic-section-header">
        <p class="dynamic-section-title">${escapeHtml(groupName)} #${index + 1}</p>
        <button class="remove-entry-btn" type="button" data-remove-group="${escapeHtml(groupName)}" data-remove-index="${index}">
          Remove
        </button>
      </div>
      ${fieldMarkup}
    </div>
  `;
}

function ResumeBuilderForm() {
  function render() {
    if (!elementRefs.formRoot) return;

    const experienceEntries = resumeBuilderState.workExperience
      .map((item, index) =>
        createDynamicEntryCard("workExperience", index, [
          { label: "Company", key: "company", value: item.company, placeholder: "Company name" },
          { label: "Role", key: "role", value: item.role, placeholder: "Job title" },
          { label: "Location", key: "location", value: item.location, placeholder: "City, State" },
          { label: "Start Date", key: "startDate", value: item.startDate, placeholder: "2022" },
          { label: "End Date", key: "endDate", value: item.endDate, placeholder: "Present" },
          {
            label: "Impact / Details",
            key: "details",
            value: item.details,
            multiline: true,
            placeholder: "Describe impact with metrics and outcomes",
          },
        ])
      )
      .join("");

    const educationEntries = resumeBuilderState.education
      .map((item, index) =>
        createDynamicEntryCard("education", index, [
          { label: "School", key: "school", value: item.school, placeholder: "University or institution" },
          { label: "Degree", key: "degree", value: item.degree, placeholder: "Degree and major" },
          { label: "Location", key: "location", value: item.location, placeholder: "City, State" },
          { label: "Start Date", key: "startDate", value: item.startDate, placeholder: "2017" },
          { label: "End Date", key: "endDate", value: item.endDate, placeholder: "2021" },
          {
            label: "Details",
            key: "details",
            value: item.details,
            multiline: true,
            placeholder: "Honors, coursework, leadership",
          },
        ])
      )
      .join("");

    const projectEntries = resumeBuilderState.projects
      .map((item, index) =>
        createDynamicEntryCard("projects", index, [
          { label: "Project Name", key: "name", value: item.name, placeholder: "Project title" },
          { label: "Project Link", key: "link", value: item.link, placeholder: "https://..." },
          {
            label: "Project Description",
            key: "description",
            value: item.description,
            multiline: true,
            placeholder: "What you built and what results it drove",
          },
        ])
      )
      .join("");

    elementRefs.formRoot.innerHTML = `
      <form class="resume-form" id="resumeBuilderForm" novalidate>
        <div class="form-grid-two">
          ${createField({ label: "Full name", key: "fullName", value: resumeBuilderState.fullName, placeholder: "Your full name" })}
          ${createField({ label: "Email", key: "email", value: resumeBuilderState.email, type: "email", placeholder: "you@example.com" })}
        </div>

        <div class="form-grid-two">
          ${createField({ label: "Phone number", key: "phone", value: resumeBuilderState.phone, placeholder: "(555) 123-4567" })}
          ${createField({ label: "Location", key: "location", value: resumeBuilderState.location, placeholder: "City, State" })}
        </div>

        ${createField({
          label: "Professional summary",
          key: "professionalSummary",
          value: resumeBuilderState.professionalSummary,
          multiline: true,
          placeholder: "2-4 sentence summary of your professional strengths",
        })}

        <section class="dynamic-section">
          <div class="dynamic-section-header">
            <p class="dynamic-section-title">Work experience</p>
            <button type="button" class="ghost-btn" data-add-group="workExperience">+ Add work experience</button>
          </div>
          ${experienceEntries}
        </section>

        <section class="dynamic-section">
          <div class="dynamic-section-header">
            <p class="dynamic-section-title">Education</p>
            <button type="button" class="ghost-btn" data-add-group="education">+ Add education</button>
          </div>
          ${educationEntries}
        </section>

        ${createField({
          label: "Skills",
          key: "skills",
          value: resumeBuilderState.skills,
          multiline: true,
          placeholder: "List your strongest skills separated by commas",
        })}

        ${createField({
          label: "Certifications",
          key: "certifications",
          value: resumeBuilderState.certifications,
          multiline: true,
          placeholder: "List certifications separated by commas",
        })}

        <section class="dynamic-section">
          <div class="dynamic-section-header">
            <p class="dynamic-section-title">Projects</p>
            <button type="button" class="ghost-btn" data-add-group="projects">+ Add project</button>
          </div>
          ${projectEntries}
        </section>
      </form>
    `;

    bindFormEvents();
  }

  function bindFormEvents() {
    const form = document.getElementById("resumeBuilderForm");
    if (!form) return;

    form.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      const key = target.getAttribute("data-key");
      if (!key) return;
      const value = target.value || "";
      updateStateByKey(key, value);
      ResumePreview().render();
    });

    form.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const addGroup = target.getAttribute("data-add-group");
      if (addGroup) {
        event.preventDefault();
        addDynamicEntry(addGroup);
        render();
        ResumePreview().render();
        return;
      }

      const removeGroup = target.getAttribute("data-remove-group");
      const removeIndex = target.getAttribute("data-remove-index");
      if (removeGroup && removeIndex !== null) {
        event.preventDefault();
        removeDynamicEntry(removeGroup, Number(removeIndex));
        render();
        ResumePreview().render();
      }
    });
  }

  return { render };
}

function ResumePreview() {
  function render() {
    if (!elementRefs.previewRoot) return;

    const workMarkup = resumeBuilderState.workExperience
      .map(
        (item) => `
          <article class="resume-item">
            <div class="resume-item-title-row">
              <strong>${escapeHtml(item.role || "Role")}</strong>
              <span>${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
            </div>
            <div class="resume-item-meta">${escapeHtml(item.company)}${item.location ? ` | ${escapeHtml(item.location)}` : ""}</div>
            <p>${escapeHtml(item.details)}</p>
          </article>
        `
      )
      .join("");

    const educationMarkup = resumeBuilderState.education
      .map(
        (item) => `
          <article class="resume-item">
            <div class="resume-item-title-row">
              <strong>${escapeHtml(item.degree || "Degree")}</strong>
              <span>${escapeHtml(formatDateRange(item.startDate, item.endDate))}</span>
            </div>
            <div class="resume-item-meta">${escapeHtml(item.school)}${item.location ? ` | ${escapeHtml(item.location)}` : ""}</div>
            <p>${escapeHtml(item.details)}</p>
          </article>
        `
      )
      .join("");

    const projectMarkup = resumeBuilderState.projects
      .map(
        (item) => `
          <article class="resume-item">
            <div class="resume-item-title-row">
              <strong>${escapeHtml(item.name || "Project")}</strong>
              <span>${item.link ? `<a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">View</a>` : ""}</span>
            </div>
            <p>${escapeHtml(item.description)}</p>
          </article>
        `
      )
      .join("");

    elementRefs.previewRoot.innerHTML = `
      <article class="resume-preview-document" aria-label="Generated Resume Preview">
        <header class="resume-header">
          <h3>${escapeHtml(resumeBuilderState.fullName || "Your Name")}</h3>
          <p class="resume-contact">
            ${escapeHtml(resumeBuilderState.email)}
            ${resumeBuilderState.phone ? ` | ${escapeHtml(resumeBuilderState.phone)}` : ""}
            ${resumeBuilderState.location ? ` | ${escapeHtml(resumeBuilderState.location)}` : ""}
          </p>
        </header>

        <section class="resume-block">
          <h4>Professional Summary</h4>
          <p class="resume-summary-text">${escapeHtml(resumeBuilderState.professionalSummary)}</p>
        </section>

        <section class="resume-block">
          <h4>Work Experience</h4>
          ${workMarkup}
        </section>

        <section class="resume-block">
          <h4>Education</h4>
          ${educationMarkup}
        </section>

        <section class="resume-block">
          <h4>Skills</h4>
          <p class="resume-skills-text">${escapeHtml(resumeBuilderState.skills)}</p>
        </section>

        <section class="resume-block">
          <h4>Certifications</h4>
          <p class="resume-certs-text">${escapeHtml(resumeBuilderState.certifications)}</p>
        </section>

        <section class="resume-block">
          <h4>Projects</h4>
          ${projectMarkup}
        </section>
      </article>
    `;
  }

  return { render };
}

function PaywallOverlay() {
  function render() {
    if (!elementRefs.overlayRoot) return;

    if (resumeBuilderState.hasPaid) {
      elementRefs.overlayRoot.innerHTML = "";
      return;
    }

    elementRefs.overlayRoot.innerHTML = `
      <div class="paywall-overlay" aria-label="Locked Resume Preview">
        <div class="paywall-card">
          <h4>Your resume is ready</h4>
          <p>Unlock your full resume template to view and download.</p>
          <button id="payToUnlockBtn" class="paywall-cta" type="button" ${
            resumeBuilderState.checkoutInProgress ? "disabled" : ""
          }>
            ${resumeBuilderState.checkoutInProgress ? "Opening Checkout..." : "Pay to Unlock"}
          </button>
          <p class="paywall-subtext">Secure unlock flow. Payment access is controlled by the backend.</p>
          ${
            resumeBuilderState.checkoutError
              ? `<p class="paywall-error">${escapeHtml(resumeBuilderState.checkoutError)}</p>`
              : ""
          }
        </div>
      </div>
    `;

    const payToUnlockBtn = document.getElementById("payToUnlockBtn");
    if (payToUnlockBtn) {
      payToUnlockBtn.addEventListener("click", handlePayToUnlock);
    }
  }

  return { render };
}

function formatDateRange(startDate, endDate) {
  const start = String(startDate || "").trim();
  const end = String(endDate || "").trim();
  if (!start && !end) return "";
  if (!start) return end;
  if (!end) return start;
  return `${start} - ${end}`;
}

function updateStateByKey(key, value) {
  const parts = key.split(".");
  if (parts.length === 1) {
    resumeBuilderState[parts[0]] = value;
    return;
  }

  if (parts.length === 3) {
    const groupName = parts[0];
    const index = Number(parts[1]);
    const fieldName = parts[2];

    if (!Array.isArray(resumeBuilderState[groupName]) || Number.isNaN(index)) return;
    if (!resumeBuilderState[groupName][index]) return;

    resumeBuilderState[groupName][index][fieldName] = value;
  }
}

function addDynamicEntry(groupName) {
  const templates = {
    workExperience: {
      company: "",
      role: "",
      location: "",
      startDate: "",
      endDate: "",
      details: "",
    },
    education: {
      school: "",
      degree: "",
      location: "",
      startDate: "",
      endDate: "",
      details: "",
    },
    projects: {
      name: "",
      link: "",
      description: "",
    },
  };

  const template = templates[groupName];
  if (!template || !Array.isArray(resumeBuilderState[groupName])) return;
  resumeBuilderState[groupName].push({ ...template });
}

function removeDynamicEntry(groupName, index) {
  if (!Array.isArray(resumeBuilderState[groupName])) return;
  if (resumeBuilderState[groupName].length <= 1) return;
  resumeBuilderState[groupName].splice(index, 1);
}

async function fetchAccessState() {
  try {
    const response = await fetch("/api/resume-builder/access");
    const data = await response.json();

    if (response.ok && data && typeof data.isUnlocked === "boolean") {
      resumeBuilderState.hasPaid = data.isUnlocked;
    }
  } catch (_error) {
    resumeBuilderState.hasPaid = false;
  }
}

async function maybeVerifyCheckoutFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const paymentStatus = params.get("payment");
  const sessionId = params.get("session_id");

  if (paymentStatus !== "success" || !sessionId) {
    return;
  }

  try {
    const response = await fetch("/api/resume-builder/verify-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.ok && data && data.isUnlocked === true) {
      resumeBuilderState.hasPaid = true;
    }
  } catch (_error) {
    // Keep locked if verification fails.
  }
}

async function handlePayToUnlock() {
  if (resumeBuilderState.checkoutInProgress) return;

  resumeBuilderState.checkoutInProgress = true;
  resumeBuilderState.checkoutError = "";
  refreshUi();

  try {
    const response = await fetch("/api/resume-builder/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returnUrl: window.location.origin + "/resume-template-builder",
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Checkout is not available yet.");
    }

    // Stripe integration placeholder:
    // When backend is connected to Stripe, this endpoint should return checkoutUrl.
    // Redirecting here keeps unlock enforcement backend-driven.
    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
      return;
    }

    throw new Error("Checkout URL not returned by backend.");
  } catch (error) {
    resumeBuilderState.checkoutError = error.message || "Unable to open checkout.";
  } finally {
    resumeBuilderState.checkoutInProgress = false;
    refreshUi();
  }
}

function updateLockStateUi() {
  const hasPaid = resumeBuilderState.hasPaid;

  if (elementRefs.previewShell) {
    elementRefs.previewShell.classList.toggle("is-locked", !hasPaid);
  }

  if (elementRefs.paymentStatusBadge) {
    elementRefs.paymentStatusBadge.textContent = hasPaid ? "Unlocked" : "Locked";
    elementRefs.paymentStatusBadge.classList.toggle("payment-badge--locked", !hasPaid);
    elementRefs.paymentStatusBadge.classList.toggle("payment-badge--unlocked", hasPaid);
  }

  if (elementRefs.downloadBtn) {
    elementRefs.downloadBtn.disabled = !hasPaid;
  }
}

function bindGlobalEvents() {
  if (elementRefs.downloadBtn) {
    elementRefs.downloadBtn.addEventListener("click", () => {
      if (!resumeBuilderState.hasPaid) return;
      window.print();
    });
  }
}

function refreshUi() {
  ResumeBuilderForm().render();
  ResumePreview().render();
  PaywallOverlay().render();
  updateLockStateUi();
}

async function init() {
  bindGlobalEvents();
  await fetchAccessState();
  await maybeVerifyCheckoutFromUrl();
  refreshUi();
}

init();
