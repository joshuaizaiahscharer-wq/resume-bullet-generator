const SAMPLE_FORM_DATA = {
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

const resumeBuilderState = {
  hasSubmitted: false,
  isUnlocked: false,
  generatedData: null,
  checkoutInProgress: false,
  checkoutError: "",
  resumeStyle: "classic",
  resumeFont: "inter",
  signedInEmail: "",
  formData: {
    fullName: "",
    email: "",
    phone: "",
    location: "",
    professionalSummary: "",
    workExperience: [{ company: "", role: "", location: "", startDate: "", endDate: "", details: "" }],
    education: [{ school: "", degree: "", location: "", startDate: "", endDate: "", details: "" }],
    skills: "",
    certifications: "",
    projects: [{ name: "", link: "", description: "" }],
  },
};

const elementRefs = {
  formRoot: document.getElementById("resumeBuilderFormRoot"),
  previewRoot: document.getElementById("resumePreviewRoot"),
  overlayRoot: document.getElementById("paywallOverlayRoot"),
  previewShell: document.getElementById("resumePreviewShell"),
  previewSection: document.getElementById("generatedResumeSection"),
  heroResumeAccessBtn: document.getElementById("heroResumeAccessBtn"),
  heroResumeAccessStatus: document.getElementById("heroResumeAccessStatus"),
  paymentStatusBadge: document.getElementById("paymentStatusBadge"),
  authStatus: document.getElementById("resumeAuthStatus"),
  authBtn: document.getElementById("resumeAuthBtn"),
  saveBtn: document.getElementById("saveResumeBtn"),
  downloadDocxBtn: document.getElementById("downloadResumeDocxBtn"),
  downloadBtn: document.getElementById("downloadResumeBtn"),
  stylePicker: document.getElementById("stylePickerRoot"),
  fontPicker: document.getElementById("fontPickerRoot"),
};

let resumeAuthClient = null;
let cloudAuthAvailable = false;
const PENDING_AUTH_RESUME_KEY = "resume_builder_pending_auth_resume_v1";
let pendingAuthScrollRestoreY = null;

function cloneFormData() {
  return JSON.parse(JSON.stringify(resumeBuilderState.formData));
}

function getElementValue(element) {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return element.value || "";
  }
  return "";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function getAuthReturnUrl() {
  const currentPath = window.location.pathname || "/resume-template-builder";
  const safePath = currentPath === "/" ? "/resume-template-builder" : currentPath;
  return `${window.location.origin}${safePath}`;
}

function hasMeaningfulLocalResume() {
  if (resumeBuilderState.hasSubmitted || resumeBuilderState.generatedData) return true;

  const formData = resumeBuilderState.formData;
  const simpleFields = [
    formData.fullName,
    formData.email,
    formData.phone,
    formData.location,
    formData.professionalSummary,
    formData.skills,
    formData.certifications,
  ];

  const hasSimpleValue = simpleFields.some((v) => String(v || "").trim().length > 0);
  if (hasSimpleValue) return true;

  const hasWorkValue = (formData.workExperience || []).some((entry) =>
    [entry.company, entry.role, entry.location, entry.startDate, entry.endDate, entry.details]
      .some((v) => String(v || "").trim().length > 0)
  );
  if (hasWorkValue) return true;

  const hasEducationValue = (formData.education || []).some((entry) =>
    [entry.school, entry.degree, entry.location, entry.startDate, entry.endDate, entry.details]
      .some((v) => String(v || "").trim().length > 0)
  );
  if (hasEducationValue) return true;

  const hasProjectValue = (formData.projects || []).some((entry) =>
    [entry.name, entry.link, entry.description].some((v) => String(v || "").trim().length > 0)
  );

  return hasProjectValue;
}

function stashResumeBeforeAuthRedirect() {
  if (!hasMeaningfulLocalResume()) return;

  try {
    const payload = {
      savedAt: Date.now(),
      scrollY: Number(window.scrollY || window.pageYOffset || 0),
      hasSubmitted: resumeBuilderState.hasSubmitted,
      formData: cloneFormData(),
      generatedData: resumeBuilderState.generatedData || null,
      resumeStyle: resumeBuilderState.resumeStyle,
      resumeFont: resumeBuilderState.resumeFont,
    };
    localStorage.setItem(PENDING_AUTH_RESUME_KEY, JSON.stringify(payload));
  } catch (_err) {
    // Ignore localStorage errors to avoid blocking auth.
  }
}

function restoreResumeAfterAuthRedirect() {
  try {
    const raw = localStorage.getItem(PENDING_AUTH_RESUME_KEY);
    if (!raw) return false;

    const saved = JSON.parse(raw);
    const scrollY = Number(saved?.scrollY);
    pendingAuthScrollRestoreY = Number.isFinite(scrollY) ? Math.max(0, scrollY) : null;
    if (saved?.formData) resumeBuilderState.formData = saved.formData;
    if (saved?.generatedData) resumeBuilderState.generatedData = saved.generatedData;
    if (saved?.resumeStyle) resumeBuilderState.resumeStyle = saved.resumeStyle;
    if (saved?.resumeFont) resumeBuilderState.resumeFont = saved.resumeFont;
    if (saved?.hasSubmitted) resumeBuilderState.hasSubmitted = true;

    localStorage.removeItem(PENDING_AUTH_RESUME_KEY);
    return true;
  } catch (_err) {
    return false;
  }
}

function restoreScrollAfterAuthRedirect() {
  if (pendingAuthScrollRestoreY == null) return;
  const targetY = pendingAuthScrollRestoreY;
  pendingAuthScrollRestoreY = null;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.scrollTo({ top: targetY, left: 0, behavior: "auto" });
    });
  });
}

function scrollToResumePreview() {
  const target = elementRefs.previewSection || document.getElementById("builderApp");
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildCloudResumePayload() {
  return {
    savedAt: Date.now(),
    hasSubmitted: resumeBuilderState.hasSubmitted,
    formData: cloneFormData(),
    generatedData: resumeBuilderState.generatedData || null,
    resumeStyle: resumeBuilderState.resumeStyle,
    resumeFont: resumeBuilderState.resumeFont,
  };
}

async function getAuthAccessToken() {
  if (!resumeAuthClient) return "";
  const { data } = await resumeAuthClient.auth.getSession();
  return data?.session?.access_token || "";
}

async function loadSavedResumeForSignedInUser() {
  if (!resumeBuilderState.signedInEmail || !resumeAuthClient) return;

  try {
    const accessToken = await getAuthAccessToken();
    if (!accessToken) return;

    const response = await fetch("/api/resume-builder/load-cloud", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    if (!response.ok || !data?.savedResume) return;

    const saved = data.savedResume;
    if (saved.formData) resumeBuilderState.formData = saved.formData;
    if (saved.generatedData) resumeBuilderState.generatedData = saved.generatedData;
    if (saved.resumeStyle) resumeBuilderState.resumeStyle = saved.resumeStyle;
    if (saved.resumeFont) resumeBuilderState.resumeFont = saved.resumeFont;
    if (saved.hasSubmitted) resumeBuilderState.hasSubmitted = true;
  } catch (_err) {
    // Silent fail to keep builder usable if cloud auth is temporarily unavailable.
  }
}

async function saveCurrentResumeForSignedInUser() {
  if (!resumeBuilderState.signedInEmail || !resumeAuthClient) return false;

  try {
    const accessToken = await getAuthAccessToken();
    if (!accessToken) return false;

    const response = await fetch("/api/resume-builder/save-cloud", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ payload: buildCloudResumePayload() }),
    });

    return response.ok;
  } catch (_err) {
    return false;
  }
}

async function initCloudAuth() {
  try {
    if (!window.supabase?.createClient) return;

    const response = await fetch("/api/public-auth-config");
    const config = await response.json();
    const supabaseUrl = config?.supabaseUrl || "";
    const supabaseKey = config?.supabasePublishableKey || "";
    if (!supabaseUrl || !supabaseKey) return;

    resumeAuthClient = window.supabase.createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    cloudAuthAvailable = true;

    const { data } = await resumeAuthClient.auth.getSession();
    const user = data?.session?.user || null;
    resumeBuilderState.signedInEmail = normalizeEmail(user?.email || "");

    if (resumeBuilderState.signedInEmail) {
      const restoredLocalDraft = restoreResumeAfterAuthRedirect();
      if (restoredLocalDraft) {
        await saveCurrentResumeForSignedInUser();
      } else {
        await loadSavedResumeForSignedInUser();
      }
    }

    resumeAuthClient.auth.onAuthStateChange(async (_event, session) => {
      resumeBuilderState.signedInEmail = normalizeEmail(session?.user?.email || "");
      if (resumeBuilderState.signedInEmail) {
        const restoredLocalDraft = restoreResumeAfterAuthRedirect();
        if (restoredLocalDraft) {
          await saveCurrentResumeForSignedInUser();
        } else {
          await loadSavedResumeForSignedInUser();
        }
      }
      refreshUi();
      restoreScrollAfterAuthRedirect();
    });
  } catch (_err) {
    cloudAuthAvailable = false;
  }
}

function updateAuthUi() {
  const isSignedIn = Boolean(resumeBuilderState.signedInEmail);
  const hasSavedResumeLoaded = Boolean(resumeBuilderState.hasSubmitted);

  if (elementRefs.authStatus) {
    if (!cloudAuthAvailable) {
      elementRefs.authStatus.textContent = "Cloud auth unavailable";
    } else {
      elementRefs.authStatus.textContent = isSignedIn
        ? `Signed in: ${resumeBuilderState.signedInEmail}`
        : "Not signed in";
    }
  }

  if (elementRefs.authBtn) {
    elementRefs.authBtn.textContent = isSignedIn ? "Sign Out" : "Sign In";
    elementRefs.authBtn.disabled = !cloudAuthAvailable;
  }

  if (elementRefs.heroResumeAccessBtn) {
    if (!cloudAuthAvailable) {
      elementRefs.heroResumeAccessBtn.textContent = "Cloud Sign-In Unavailable";
    } else if (!isSignedIn) {
      elementRefs.heroResumeAccessBtn.textContent = "Sign In To View Saved Resumes";
    } else if (hasSavedResumeLoaded) {
      elementRefs.heroResumeAccessBtn.textContent = "View Saved Resume";
    } else {
      elementRefs.heroResumeAccessBtn.textContent = "Start A New Resume";
    }
    elementRefs.heroResumeAccessBtn.disabled = !cloudAuthAvailable;
  }

  if (elementRefs.heroResumeAccessStatus) {
    if (!cloudAuthAvailable) {
      elementRefs.heroResumeAccessStatus.textContent = "Cloud sign-in is unavailable right now.";
    } else if (!isSignedIn) {
      elementRefs.heroResumeAccessStatus.textContent = "Sign in to load a previously saved resume.";
    } else if (hasSavedResumeLoaded) {
      elementRefs.heroResumeAccessStatus.textContent = "Your saved resume is ready below.";
    } else {
      elementRefs.heroResumeAccessStatus.textContent = `Signed in as ${resumeBuilderState.signedInEmail}. No saved resume found yet.`;
    }
  }

  if (elementRefs.saveBtn) {
    elementRefs.saveBtn.disabled = !cloudAuthAvailable || !isSignedIn || !resumeBuilderState.hasSubmitted;
  }
}

async function signInOrOut() {
  if (!cloudAuthAvailable || !resumeAuthClient) return;

  if (resumeBuilderState.signedInEmail) {
    await resumeAuthClient.auth.signOut();
    resumeBuilderState.signedInEmail = "";
    refreshUi();
    return;
  }

  openAuthModal();
}

function openAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-hidden", "false");
  const statusEl = document.getElementById("authModalStatus");
  if (statusEl) { statusEl.textContent = ""; statusEl.className = "auth-modal-status"; }
  const emailBtn = document.getElementById("authModalEmailBtn");
  if (emailBtn) { emailBtn.disabled = false; emailBtn.textContent = "Send magic link"; }
  const emailInput = document.getElementById("authModalEmailInput");
  if (emailInput) { emailInput.value = ""; setTimeout(() => emailInput.focus(), 50); }
}

function closeAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function getResumePdfTheme(style) {
  switch (style) {
    case "modern":
      return {
        heading: [79, 70, 229],
        name: [30, 27, 75],
        body: [51, 65, 85],
        muted: [71, 85, 105],
        divider: [199, 210, 254],
        font: "helvetica",
      };
    case "executive":
      return {
        heading: [15, 23, 42],
        name: [15, 23, 42],
        body: [31, 41, 55],
        muted: [71, 85, 105],
        divider: [203, 213, 225],
        font: "times",
      };
    case "minimal":
      return {
        heading: [55, 65, 81],
        name: [17, 24, 39],
        body: [55, 65, 81],
        muted: [107, 114, 128],
        divider: [229, 231, 235],
        font: "helvetica",
      };
    default:
      return {
        heading: [30, 41, 59],
        name: [11, 19, 37],
        body: [51, 65, 85],
        muted: [71, 85, 105],
        divider: [203, 213, 225],
        font: "helvetica",
      };
  }
}

function getPdfExportClient() {
  return window.jspdf?.jsPDF || window.jsPDF || null;
}

function getDocxExportClient() {
  return window.docx || null;
}

function buildResumePdfData() {
  return resumeBuilderState.generatedData || cloneFormData();
}

function downloadBlobFile(blob, fileName) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function drawResumePdf(doc, previewData, filenameBase) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 54;
  const topMargin = 52;
  const bottomMargin = 44;
  const contentWidth = pageWidth - marginX * 2;
  const theme = getResumePdfTheme(resumeBuilderState.resumeStyle);

  let y = topMargin;

  const ensureSpace = (heightNeeded = 18) => {
    if (y + heightNeeded <= pageHeight - bottomMargin) return;
    doc.addPage();
    y = topMargin;
  };

  const drawWrappedText = (text, options = {}) => {
    const {
      x = marginX,
      maxWidth = contentWidth,
      font = theme.font,
      fontStyle = "normal",
      fontSize = 10.5,
      color = theme.body,
      lineHeight = 14,
      gapAfter = 0,
    } = options;

    const rawText = String(text || "").trim();
    if (!rawText) return;

    doc.setFont(font, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);

    const paragraphs = rawText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    paragraphs.forEach((paragraph, index) => {
      const isBullet = /^[•\-]/.test(paragraph);
      const bulletPrefix = isBullet ? "• " : "";
      const textContent = isBullet ? paragraph.replace(/^[•\-]\s*/, "") : paragraph;
      const indentX = isBullet ? x + 10 : x;
      const lines = doc.splitTextToSize(textContent, maxWidth - (isBullet ? 10 : 0));

      ensureSpace(lines.length * lineHeight + lineHeight);
      if (isBullet) {
        doc.text(bulletPrefix, x, y);
      }
      doc.text(lines, indentX, y);
      y += lines.length * lineHeight;
      if (index < paragraphs.length - 1) {
        y += 2;
      }
    });

    y += gapAfter;
  };

  const drawSectionHeading = (label) => {
    ensureSpace(28);
    doc.setDrawColor(theme.divider[0], theme.divider[1], theme.divider[2]);
    doc.setLineWidth(1);
    doc.line(marginX, y + 4, pageWidth - marginX, y + 4);
    doc.setFont(theme.font, "bold");
    doc.setFontSize(11);
    doc.setTextColor(theme.heading[0], theme.heading[1], theme.heading[2]);
    doc.text(String(label || "").toUpperCase(), marginX, y);
    y += 20;
  };

  const drawItemHeader = (leftText, rightText) => {
    ensureSpace(18);
    doc.setFont(theme.font, "bold");
    doc.setFontSize(11);
    doc.setTextColor(theme.name[0], theme.name[1], theme.name[2]);
    const safeLeft = String(leftText || "").trim() || " ";
    doc.text(safeLeft, marginX, y);

    const safeRight = String(rightText || "").trim();
    if (safeRight) {
      doc.setFont(theme.font, "normal");
      doc.setFontSize(10);
      doc.setTextColor(theme.muted[0], theme.muted[1], theme.muted[2]);
      const textWidth = doc.getTextWidth(safeRight);
      doc.text(safeRight, pageWidth - marginX - textWidth, y);
    }

    y += 14;
  };

  doc.setProperties({
    title: `${filenameBase}.pdf`,
    subject: "Resume",
    author: previewData.fullName || "BulletAI",
    creator: "BulletAI",
  });

  doc.setFont(theme.font, "bold");
  doc.setFontSize(24);
  doc.setTextColor(theme.name[0], theme.name[1], theme.name[2]);
  doc.text(String(previewData.fullName || "Your Name"), marginX, y);
  y += 22;

  const contactParts = [previewData.email, previewData.phone, previewData.location].filter(Boolean);
  if (contactParts.length) {
    doc.setFont(theme.font, "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(theme.muted[0], theme.muted[1], theme.muted[2]);
    drawWrappedText(contactParts.join(" | "), {
      font: theme.font,
      fontSize: 10.5,
      color: theme.muted,
      lineHeight: 13,
      gapAfter: 6,
    });
  }

  drawSectionHeading("Professional Summary");
  drawWrappedText(previewData.professionalSummary, { gapAfter: 8 });

  drawSectionHeading("Work Experience");
  (previewData.workExperience || []).forEach((item) => {
    const hasContent = [item.role, item.company, item.location, item.startDate, item.endDate, item.details]
      .some((value) => String(value || "").trim());
    if (!hasContent) return;
    drawItemHeader(item.role || "Role", formatDateRange(item.startDate, item.endDate));
    const companyLine = [item.company, item.location].filter(Boolean).join(" | ");
    if (companyLine) {
      drawWrappedText(companyLine, {
        fontStyle: "italic",
        fontSize: 10,
        color: theme.muted,
        lineHeight: 12,
        gapAfter: 4,
      });
    }
    drawWrappedText(item.details, { gapAfter: 10 });
  });

  drawSectionHeading("Education");
  (previewData.education || []).forEach((item) => {
    const hasContent = [item.degree, item.school, item.location, item.startDate, item.endDate, item.details]
      .some((value) => String(value || "").trim());
    if (!hasContent) return;
    drawItemHeader(item.degree || "Degree", formatDateRange(item.startDate, item.endDate));
    const schoolLine = [item.school, item.location].filter(Boolean).join(" | ");
    if (schoolLine) {
      drawWrappedText(schoolLine, {
        fontStyle: "italic",
        fontSize: 10,
        color: theme.muted,
        lineHeight: 12,
        gapAfter: 4,
      });
    }
    drawWrappedText(item.details, { gapAfter: 10 });
  });

  if (String(previewData.skills || "").trim()) {
    drawSectionHeading("Skills");
    drawWrappedText(previewData.skills, { gapAfter: 8 });
  }

  if (String(previewData.certifications || "").trim()) {
    drawSectionHeading("Certifications");
    drawWrappedText(previewData.certifications, { gapAfter: 8 });
  }

  const projects = (previewData.projects || []).filter((item) =>
    [item.name, item.link, item.description].some((value) => String(value || "").trim())
  );

  if (projects.length) {
    drawSectionHeading("Projects");
    projects.forEach((item) => {
      drawItemHeader(item.name || "Project", item.link || "");
      if (item.link) {
        drawWrappedText(item.link, {
          fontSize: 9.5,
          color: theme.muted,
          lineHeight: 12,
          gapAfter: 3,
        });
      }
      drawWrappedText(item.description, { gapAfter: 10 });
    });
  }

  doc.save(`${filenameBase}.pdf`);
}

async function downloadResumeAsDocx() {
  if (!resumeBuilderState.hasSubmitted || !resumeBuilderState.isUnlocked) return;

  const filenameBase = (resumeBuilderState.generatedData?.fullName || resumeBuilderState.formData.fullName || "resume")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resume";

  const docxClient = getDocxExportClient();
  if (!docxClient) return;

  const {
    BorderStyle,
    Document,
    HeadingLevel,
    Packer,
    Paragraph,
    TextRun,
  } = docxClient;

  const previewData = buildResumePdfData();
  const children = [];

  const addTextParagraph = (text, options = {}) => {
    const value = String(text || "").trim();
    if (!value) return;

    const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line) => {
      const isBullet = /^[•\-]/.test(line);
      children.push(
        new Paragraph({
          text: isBullet ? line.replace(/^[•\-]\s*/, "") : line,
          bullet: isBullet ? { level: 0 } : undefined,
          spacing: { after: options.after ?? 70, line: 300 },
        })
      );
    });
  };

  const addSectionHeading = (label) => {
    children.push(
      new Paragraph({
        text: label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 220, after: 80 },
      })
    );
  };

  children.push(
    new Paragraph({
      children: [new TextRun({ text: previewData.fullName || "Your Name", bold: true, size: 30 * 2 })],
      spacing: { after: 80 },
    })
  );

  const contactLine = [previewData.email, previewData.phone, previewData.location].filter(Boolean).join(" | ");
  if (contactLine) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: contactLine, color: "475569", size: 10 * 2 })],
        spacing: { after: 180 },
      })
    );
  }

  addSectionHeading("Professional Summary");
  addTextParagraph(previewData.professionalSummary, { after: 90 });

  addSectionHeading("Work Experience");
  (previewData.workExperience || []).forEach((item) => {
    const hasContent = [item.role, item.company, item.location, item.startDate, item.endDate, item.details]
      .some((value) => String(value || "").trim());
    if (!hasContent) return;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: item.role || "Role", bold: true, size: 11 * 2 }),
          new TextRun({ text: formatDateRange(item.startDate, item.endDate) ? `    ${formatDateRange(item.startDate, item.endDate)}` : "", color: "64748b", size: 10 * 2 }),
        ],
        spacing: { after: 40 },
      })
    );

    const companyLine = [item.company, item.location].filter(Boolean).join(" | ");
    if (companyLine) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: companyLine, italics: true, color: "64748b", size: 10 * 2 })],
          spacing: { after: 40 },
        })
      );
    }

    addTextParagraph(item.details, { after: 100 });
  });

  addSectionHeading("Education");
  (previewData.education || []).forEach((item) => {
    const hasContent = [item.degree, item.school, item.location, item.startDate, item.endDate, item.details]
      .some((value) => String(value || "").trim());
    if (!hasContent) return;

    children.push(
      new Paragraph({
        children: [
          new TextRun({ text: item.degree || "Degree", bold: true, size: 11 * 2 }),
          new TextRun({ text: formatDateRange(item.startDate, item.endDate) ? `    ${formatDateRange(item.startDate, item.endDate)}` : "", color: "64748b", size: 10 * 2 }),
        ],
        spacing: { after: 40 },
      })
    );

    const schoolLine = [item.school, item.location].filter(Boolean).join(" | ");
    if (schoolLine) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: schoolLine, italics: true, color: "64748b", size: 10 * 2 })],
          spacing: { after: 40 },
        })
      );
    }

    addTextParagraph(item.details, { after: 100 });
  });

  if (String(previewData.skills || "").trim()) {
    addSectionHeading("Skills");
    addTextParagraph(previewData.skills, { after: 90 });
  }

  if (String(previewData.certifications || "").trim()) {
    addSectionHeading("Certifications");
    addTextParagraph(previewData.certifications, { after: 90 });
  }

  const projects = (previewData.projects || []).filter((item) =>
    [item.name, item.link, item.description].some((value) => String(value || "").trim())
  );

  if (projects.length) {
    addSectionHeading("Projects");
    projects.forEach((item) => {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: item.name || "Project", bold: true, size: 11 * 2 })],
          spacing: { after: 40 },
        })
      );

      if (item.link) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: item.link, color: "2563eb", underline: {} })],
            spacing: { after: 40 },
          })
        );
      }

      addTextParagraph(item.description, { after: 100 });
    });
  }

  const doc = new Document({
    creator: "BulletAI",
    title: previewData.fullName || "Resume",
    description: "Resume export",
    styles: {
      paragraphStyles: [
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { bold: true, size: 22, color: "1e293b" },
          paragraph: {
            spacing: { before: 220, after: 80 },
            border: {
              bottom: { color: "cbd5e1", style: BorderStyle.SINGLE, size: 6, space: 1 },
            },
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlobFile(blob, `${filenameBase}.docx`);
}

function initAuthModal() {
  const modal = document.getElementById("authModal");
  if (!modal) return;

  document.getElementById("authModalClose")?.addEventListener("click", closeAuthModal);

  modal.addEventListener("click", (e) => { if (e.target === modal) closeAuthModal(); });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) closeAuthModal();
  });

  const emailInput = document.getElementById("authModalEmailInput");
  const emailBtn = document.getElementById("authModalEmailBtn");
  const statusEl = document.getElementById("authModalStatus");

  emailInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") emailBtn?.click(); });

  emailBtn?.addEventListener("click", async () => {
    if (!resumeAuthClient) return;
    const email = normalizeEmail(emailInput?.value || "");
    if (!email || !email.includes("@")) {
      if (statusEl) statusEl.textContent = "Please enter a valid email address.";
      return;
    }
    emailBtn.disabled = true;
    if (statusEl) { statusEl.textContent = "Sending\u2026"; statusEl.className = "auth-modal-status"; }
    try {
      stashResumeBeforeAuthRedirect();
      await resumeAuthClient.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: getAuthReturnUrl() },
      });
      emailBtn.textContent = "Link sent \u2713";
      if (statusEl) {
        statusEl.textContent = "Check your email for the sign-in link!";
        statusEl.className = "auth-modal-status auth-modal-status--success";
      }
    } catch (_err) {
      if (statusEl) statusEl.textContent = "Something went wrong. Please try again.";
      emailBtn.disabled = false;
    }
  });

  document.getElementById("authModalGoogleBtn")?.addEventListener("click", async () => {
    if (!resumeAuthClient) return;
    try {
      stashResumeBeforeAuthRedirect();
      await resumeAuthClient.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: getAuthReturnUrl() },
      });
    } catch (err) {
      const message = String(err?.message || "").toLowerCase();
      if (statusEl) {
        statusEl.className = "auth-modal-status";
        statusEl.textContent = message.includes("provider is not enabled")
          ? "Google sign-in is not enabled yet. Use email for now."
          : "Google sign-in failed. Please try again.";
      }
    }
  });
}

async function downloadResumeAsPdf() {
  if (!resumeBuilderState.hasSubmitted || !resumeBuilderState.isUnlocked) return;

  const filenameBase = (resumeBuilderState.generatedData?.fullName || resumeBuilderState.formData.fullName || "resume")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "resume";

  const jsPdfClient = getPdfExportClient();
  if (jsPdfClient) {
    const previewData = buildResumePdfData();
    const doc = new jsPdfClient({ unit: "pt", format: "letter", orientation: "portrait" });
    drawResumePdf(doc, previewData, filenameBase);
    return;
  }

  const documentRoot = elementRefs.previewRoot?.querySelector(".resume-preview-document");
  if (!documentRoot) return;

  if (typeof window.html2pdf === "function") {
    // Clone into an isolated offscreen container. This avoids html2canvas
    // blank captures caused by transforms/filters/layout constraints.
    const exportHost = document.createElement("div");
    exportHost.style.position = "fixed";
    exportHost.style.left = "-99999px";
    exportHost.style.top = "0";
    exportHost.style.width = "8.5in";
    exportHost.style.background = "#ffffff";
    exportHost.style.padding = "0";
    exportHost.style.margin = "0";
    exportHost.style.zIndex = "-1";

    const exportNode = documentRoot.cloneNode(true);
    exportNode.setAttribute("data-export", "pdf");
    exportNode.style.width = "8.5in";
    exportNode.style.minHeight = "11in";
    exportNode.style.maxWidth = "none";
    exportNode.style.filter = "none";
    exportNode.style.transform = "none";
    exportNode.style.boxShadow = "none";
    exportNode.style.background = "#ffffff";
    exportNode.style.borderRadius = "0";
    exportNode.style.margin = "0";
    exportNode.style.boxSizing = "border-box";

    exportHost.appendChild(exportNode);
    document.body.appendChild(exportHost);

    try {
      if (document.fonts?.ready) {
        await document.fonts.ready;
      }

      await new Promise((resolve) => requestAnimationFrame(resolve));

      const options = {
        margin: 0,
        filename: `${filenameBase}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          width: exportNode.scrollWidth,
          windowWidth: exportNode.scrollWidth,
        },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
        pagebreak: {
          mode: ["avoid-all", "css", "legacy"],
          avoid: [".resume-header", ".resume-block", ".resume-item"],
        },
      };

      await window.html2pdf().set(options).from(exportNode).save();
      return;
    } finally {
      exportHost.remove();
    }
  }

  // Fallback for environments where the PDF library fails to load.
  window.print();
}

const REVISABLE_KEYS = new Set(["professionalSummary"]);
const REVISABLE_SUFFIXES = [".details", ".description"];

function isRevisableField(key, multiline) {
  if (!multiline) return false;
  if (REVISABLE_KEYS.has(key)) return true;
  return REVISABLE_SUFFIXES.some((s) => key.endsWith(s));
}

function fieldTypeFromKey(key) {
  if (key === "professionalSummary") return "summary";
  if (key.endsWith(".description")) return "description";
  if (key.includes("education") && key.endsWith(".details")) return "education";
  return "details";
}

// Per-field undo storage: { [dataKey]: previousValue }
const reviseUndoMap = {};

function createField({ label, key, value, type = "text", multiline = false, placeholder = "" }) {
  const isLocation = !multiline && (key === "location" || key.endsWith(".location"));
  const dropdownId = `acdrop_${key.replace(/\./g, "_")}`;

  const inputMarkup = multiline
    ? `<textarea data-key="${escapeHtml(key)}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>`
    : `<input type="${escapeHtml(type)}" data-key="${escapeHtml(key)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}"${isLocation ? ` data-address-autocomplete autocomplete="off"` : ""} />`;

  const fieldContent = isLocation
    ? `<div class="autocomplete-wrapper">${inputMarkup}<div class="autocomplete-dropdown" id="${dropdownId}"></div></div>`
    : inputMarkup;

  const reviseBar = isRevisableField(key, multiline) ? `
    <div class="revise-bar" data-revise-key="${escapeHtml(key)}">
      <button class="revise-btn" type="button" data-revise="${escapeHtml(key)}" data-field-type="${escapeHtml(fieldTypeFromKey(key))}">&#10022; Revise with AI</button>
      <button class="revise-undo-btn" type="button" data-undo-revise="${escapeHtml(key)}" hidden>&#8630; Undo</button>
      <span class="revise-status" data-revise-status="${escapeHtml(key)}"></span>
    </div>` : "";

  return `
    <div class="form-field">
      <label>${escapeHtml(label)}</label>
      ${fieldContent}${reviseBar}
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
      ${groupName === "workExperience" ? `
      <div class="bullet-assistant" data-entry-index="${index}">
        <div class="bullet-assistant-header">
          <span class="bullet-assistant-label">&#10022; Bullet Assistant</span>
          <span class="bullet-assistant-hint">Generate AI bullet points for this role and click to add them</span>
        </div>
        <div class="bullet-assistant-input-row">
          <input
            class="bullet-assistant-job-input"
            type="text"
            placeholder="e.g. Product Marketing Manager"
            aria-label="Job title for bullet generation"
          />
          <button class="bullet-assistant-generate-btn" type="button" data-generate-index="${index}">Generate</button>
        </div>
        <div class="bullet-assistant-results" id="bulletResults_${index}" aria-live="polite"></div>
      </div>
      ` : ""}
    </div>
  `;
}

function ResumeBuilderForm() {
  function render() {
    if (!elementRefs.formRoot) return;

    const data = resumeBuilderState.formData;

    const experienceEntries = data.workExperience
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

    const educationEntries = data.education
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

    const projectEntries = data.projects
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
          ${createField({ label: "Full name", key: "fullName", value: data.fullName, placeholder: "Your full name" })}
          ${createField({ label: "Email", key: "email", value: data.email, type: "email", placeholder: "you@example.com" })}
        </div>

        <div class="form-grid-two">
          ${createField({ label: "Phone number", key: "phone", value: data.phone, placeholder: "(555) 123-4567" })}
          ${createField({ label: "Location", key: "location", value: data.location, placeholder: "City, State" })}
        </div>

        ${createField({
          label: "Professional summary",
          key: "professionalSummary",
          value: data.professionalSummary,
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
          value: data.skills,
          multiline: true,
          placeholder: "List your strongest skills separated by commas",
        })}

        ${createField({
          label: "Certifications",
          key: "certifications",
          value: data.certifications,
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

        <div class="form-actions">
          <button class="generate-resume-btn" type="submit">Generate Resume</button>
          <button class="load-sample-btn" type="button" id="loadSampleDataBtn">Load Sample Data</button>
        </div>
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
      const value = getElementValue(target);
      updateFormDataByKey(key, value);

      // Address autocomplete debounce
      if (target.hasAttribute("data-address-autocomplete")) {
        clearTimeout(_locationDebounceTimer);
        const query = value.trim();
        if (query.length < 2) {
          hideAutocompleteDropdown(target);
          return;
        }
        _locationDebounceTimer = setTimeout(async () => {
          const suggestions = await fetchLocationSuggestions(query).catch(() => []);
          showAutocompleteDropdown(target, suggestions);
        }, 380);
      }
    });

    form.addEventListener("blur", (event) => {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.hasAttribute("data-address-autocomplete")) {
        // Small delay so a click on an option registers before hiding
        setTimeout(() => hideAutocompleteDropdown(target), 180);
      }
    }, true);

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      syncFormDataFromDom(form);
      resumeBuilderState.generatedData = cloneFormData();
      resumeBuilderState.hasSubmitted = true;
      resumeBuilderState.checkoutError = "";
      refreshUi({ animatePreview: true });
    });

    form.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;

      const addGroup = target.getAttribute("data-add-group");
      if (addGroup) {
        event.preventDefault();
        addDynamicEntry(addGroup);
        render();
        return;
      }

      const removeGroup = target.getAttribute("data-remove-group");
      const removeIndex = target.getAttribute("data-remove-index");
      if (removeGroup && removeIndex !== null) {
        event.preventDefault();
        removeDynamicEntry(removeGroup, Number(removeIndex));
        render();
        return;
      }

      if (target.id === "loadSampleDataBtn" || target.closest("#loadSampleDataBtn")) {
        event.preventDefault();
        resumeBuilderState.formData = JSON.parse(JSON.stringify(SAMPLE_FORM_DATA));
        render();
        return;
      }

      // Bullet Assistant — Generate button
      const generateIndex = target.getAttribute("data-generate-index");
      if (generateIndex !== null) {
        event.preventDefault();
        const entryIndex = Number(generateIndex);
        const assistant = target.closest(".bullet-assistant");
        if (!assistant) return;
        const jobInput = assistant.querySelector(".bullet-assistant-job-input");
        const jobTitle = jobInput ? jobInput.value.trim() : "";
        if (!jobTitle) {
          jobInput && jobInput.focus();
          return;
        }
        handleBulletAssistantGenerate(jobTitle, entryIndex, target);
        return;
      }

      // Bullet Assistant — Add bullet chip
      const bulletText = target.getAttribute("data-bullet-text");
      if (bulletText !== null) {
        event.preventDefault();
        const entryIndex = Number(target.getAttribute("data-bullet-index"));
        appendBulletToExperience(bulletText, entryIndex, form);
        target.classList.add("bullet-chip--added");
        target.textContent = "Added ✓";
        target.disabled = true;
        return;
      }

      // Address autocomplete — option selected
      const option = target.closest(".autocomplete-option");
      if (option) {
        event.preventDefault();
        const wrapper = option.closest(".autocomplete-wrapper");
        const input = wrapper && wrapper.querySelector("[data-address-autocomplete]");
        if (input) {
          input.value = option.textContent;
          const key = input.getAttribute("data-key");
          if (key) updateFormDataByKey(key, input.value);
          hideAutocompleteDropdown(input);
        }
        return;
      }

      // AI Revise button
      const reviseKey = target.getAttribute("data-revise");
      if (reviseKey !== null) {
        event.preventDefault();
        const fieldType = target.getAttribute("data-field-type") || "details";
        handleRevise(reviseKey, fieldType, target, form);
        return;
      }

      // AI Revise — Undo button
      const undoKey = target.getAttribute("data-undo-revise");
      if (undoKey !== null) {
        event.preventDefault();
        handleUndoRevise(undoKey, form);
        return;
      }
    });
  }

  return { render };
}

function ResumePreview() {
  function render() {
    if (!elementRefs.previewRoot || !resumeBuilderState.hasSubmitted) return;

    const previewData = resumeBuilderState.generatedData || cloneFormData();

    const workMarkup = previewData.workExperience
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

    const educationMarkup = previewData.education
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

    const projectMarkup = previewData.projects
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
      <article class="resume-preview-document" aria-label="Generated Resume Preview" data-theme="${resumeBuilderState.resumeStyle}" data-font="${resumeBuilderState.resumeFont}">
        <header class="resume-header">
          <h3>${escapeHtml(previewData.fullName || "Your Name")}</h3>
          <p class="resume-contact">
            ${escapeHtml(previewData.email)}
            ${previewData.phone ? ` | ${escapeHtml(previewData.phone)}` : ""}
            ${previewData.location ? ` | ${escapeHtml(previewData.location)}` : ""}
          </p>
        </header>

        <section class="resume-block">
          <h4>Professional Summary</h4>
          <p class="resume-summary-text">${escapeHtml(previewData.professionalSummary)}</p>
        </section>

        <div class="resume-locked-body">
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
            <p class="resume-skills-text">${escapeHtml(previewData.skills)}</p>
          </section>

          <section class="resume-block">
            <h4>Certifications</h4>
            <p class="resume-certs-text">${escapeHtml(previewData.certifications)}</p>
          </section>

          <section class="resume-block">
            <h4>Projects</h4>
            ${projectMarkup}
          </section>
        </div>
      </article>
    `;
  }

  return { render };
}

function PaywallOverlay() {
  function render() {
    if (!elementRefs.overlayRoot) return;

    if (!resumeBuilderState.hasSubmitted || resumeBuilderState.isUnlocked) {
      elementRefs.overlayRoot.innerHTML = "";
      return;
    }

    elementRefs.overlayRoot.innerHTML = `
      <div class="paywall-overlay" aria-label="Locked Resume Preview">
        <div class="paywall-card">
          <h4>Your Resume Is Ready</h4>
          <p>Unlock your professional resume to view and download.</p>
          <div class="wallet-badge" aria-label="Apple Pay available">
            <span class="wallet-badge-icon" aria-hidden="true">&#63743;</span>
            <span>Apple Pay available</span>
          </div>
          <button id="payToUnlockBtn" class="paywall-cta" type="button" ${
            resumeBuilderState.checkoutInProgress ? "disabled" : ""
          }>
            ${resumeBuilderState.checkoutInProgress ? "Opening Checkout..." : "Unlock Resume"}
          </button>
          <button id="editInfoBtn" class="paywall-secondary" type="button">Edit Information</button>
          <p class="paywall-subtext">Secure unlock flow. Supports card checkout with Apple Pay on supported devices.</p>
          ${
            resumeBuilderState.checkoutError
              ? `<p class="paywall-error">${escapeHtml(resumeBuilderState.checkoutError)}</p>`
              : ""
          }
        </div>
      </div>
    `;

    const payToUnlockBtn = document.getElementById("payToUnlockBtn");
    const editInfoBtn = document.getElementById("editInfoBtn");
    if (payToUnlockBtn) {
      payToUnlockBtn.addEventListener("click", handlePayToUnlock);
    }
    if (editInfoBtn) {
      editInfoBtn.addEventListener("click", () => {
        const form = document.getElementById("resumeBuilderForm");
        if (!form) return;
        form.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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

function updateFormDataByKey(key, value) {
  const parts = key.split(".");
  if (parts.length === 1) {
    resumeBuilderState.formData[parts[0]] = value;
    return;
  }

  if (parts.length === 3) {
    const groupName = parts[0];
    const index = Number(parts[1]);
    const fieldName = parts[2];

    if (!Array.isArray(resumeBuilderState.formData[groupName]) || Number.isNaN(index)) return;
    if (!resumeBuilderState.formData[groupName][index]) return;

    resumeBuilderState.formData[groupName][index][fieldName] = value;
  }
}

function syncFormDataFromDom(formElement) {
  const fields = formElement.querySelectorAll("[data-key]");
  fields.forEach((field) => {
    const key = field.getAttribute("data-key");
    if (!key) return;
    updateFormDataByKey(key, getElementValue(field));
  });
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
  if (!template || !Array.isArray(resumeBuilderState.formData[groupName])) return;
  resumeBuilderState.formData[groupName].push({ ...template });
}

function removeDynamicEntry(groupName, index) {
  if (!Array.isArray(resumeBuilderState.formData[groupName])) return;
  if (resumeBuilderState.formData[groupName].length <= 1) return;
  resumeBuilderState.formData[groupName].splice(index, 1);
}

async function fetchAccessState() {
  try {
    const response = await fetch("/api/resume-builder/access");
    const data = await response.json();

    if (response.ok && data && typeof data.isUnlocked === "boolean") {
      resumeBuilderState.isUnlocked = data.isUnlocked;
    }
  } catch (_error) {
    resumeBuilderState.isUnlocked = false;
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
      resumeBuilderState.isUnlocked = true;
      resumeBuilderState.hasSubmitted = true;
      if (!resumeBuilderState.generatedData) {
        resumeBuilderState.generatedData = cloneFormData();
      }
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

function updatePreviewVisibility(animatePreview = false) {
  if (!elementRefs.previewSection) return;

  if (!resumeBuilderState.hasSubmitted) {
    elementRefs.previewSection.classList.add("hidden");
    elementRefs.previewSection.classList.remove("preview-enter-active");
    return;
  }

  elementRefs.previewSection.classList.remove("hidden");
  if (animatePreview) {
    elementRefs.previewSection.classList.remove("preview-enter-active");
    requestAnimationFrame(() => {
      elementRefs.previewSection.classList.add("preview-enter-active");
    });
  } else {
    elementRefs.previewSection.classList.add("preview-enter-active");
  }
}

function updateLockStateUi() {
  const isUnlocked = resumeBuilderState.isUnlocked;

  if (elementRefs.previewShell) {
    elementRefs.previewShell.classList.toggle("is-locked", !isUnlocked);
  }

  if (elementRefs.paymentStatusBadge) {
    elementRefs.paymentStatusBadge.textContent = isUnlocked ? "Unlocked" : "Locked";
    elementRefs.paymentStatusBadge.classList.toggle("payment-badge--locked", !isUnlocked);
    elementRefs.paymentStatusBadge.classList.toggle("payment-badge--unlocked", isUnlocked);
  }

  if (elementRefs.downloadBtn) {
    elementRefs.downloadBtn.disabled = !resumeBuilderState.hasSubmitted || !isUnlocked;
  }

  if (elementRefs.downloadDocxBtn) {
    elementRefs.downloadDocxBtn.disabled = !resumeBuilderState.hasSubmitted || !isUnlocked;
  }

  updateAuthUi();
}

function bindGlobalEvents() {
  initAuthModal();

  if (elementRefs.downloadBtn) {
    elementRefs.downloadBtn.addEventListener("click", async () => {
      await downloadResumeAsPdf();
    });
  }

  if (elementRefs.downloadDocxBtn) {
    elementRefs.downloadDocxBtn.addEventListener("click", async () => {
      await downloadResumeAsDocx();
    });
  }

  if (elementRefs.authBtn) {
    elementRefs.authBtn.addEventListener("click", async () => {
      await signInOrOut();
    });
  }

  if (elementRefs.heroResumeAccessBtn) {
    elementRefs.heroResumeAccessBtn.addEventListener("click", async () => {
      if (!resumeBuilderState.signedInEmail) {
        await signInOrOut();
        return;
      }

      scrollToResumePreview();
    });
  }

  if (elementRefs.saveBtn) {
    elementRefs.saveBtn.addEventListener("click", async () => {
      if (!resumeBuilderState.signedInEmail) {
        await signInOrOut();
        return;
      }
      if (!resumeBuilderState.hasSubmitted) return;

      const saved = await saveCurrentResumeForSignedInUser();
      if (saved && elementRefs.authStatus) {
        elementRefs.authStatus.textContent = `Saved at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
        setTimeout(updateAuthUi, 1800);
      }
    });
  }

  if (elementRefs.stylePicker) {
    elementRefs.stylePicker.addEventListener("click", (event) => {
      const pill = event.target.closest(".style-pill");
      if (!pill) return;
      const style = pill.getAttribute("data-style");
      if (!style || style === resumeBuilderState.resumeStyle) return;
      resumeBuilderState.resumeStyle = style;
      elementRefs.stylePicker.querySelectorAll(".style-pill").forEach((btn) => {
        btn.classList.toggle("style-pill--active", btn.getAttribute("data-style") === style);
      });
      ResumePreview().render();
    });
  }

  if (elementRefs.fontPicker) {
    elementRefs.fontPicker.addEventListener("click", (event) => {
      const pill = event.target.closest(".style-pill");
      if (!pill) return;
      const font = pill.getAttribute("data-font");
      if (!font || font === resumeBuilderState.resumeFont) return;
      resumeBuilderState.resumeFont = font;
      elementRefs.fontPicker.querySelectorAll(".style-pill").forEach((btn) => {
        btn.classList.toggle("style-pill--active", btn.getAttribute("data-font") === font);
      });
      ResumePreview().render();
    });
  }
}

// ── AI Revise ────────────────────────────────────────────────────────────────

async function handleRevise(key, fieldType, btn, form) {
  const textarea = form.querySelector(`[data-key="${key}"]`);
  if (!textarea) return;
  const currentText = textarea.value.trim();
  if (!currentText) return;

  const statusEl = form.querySelector(`[data-revise-status="${key}"]`);
  const undoBtn = form.querySelector(`[data-undo-revise="${key}"]`);

  btn.disabled = true;
  btn.textContent = "Revising…";
  if (statusEl) statusEl.textContent = "";

  try {
    const response = await fetch("/api/resume-builder/revise", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: currentText, fieldType }),
    });
    const data = await response.json();
    if (!response.ok || !data.revised) throw new Error(data.error || "Revision failed.");

    // Save current value for undo before overwriting
    reviseUndoMap[key] = currentText;

    textarea.value = data.revised;
    updateFormDataByKey(key, data.revised);

    if (undoBtn) undoBtn.hidden = false;
    if (statusEl) {
      statusEl.textContent = "Revised!";
      setTimeout(() => { statusEl.textContent = ""; }, 2500);
    }
  } catch (err) {
    if (statusEl) {
      statusEl.textContent = err.message || "Error revising.";
      statusEl.classList.add("revise-status--error");
      setTimeout(() => {
        statusEl.textContent = "";
        statusEl.classList.remove("revise-status--error");
      }, 3500);
    }
  } finally {
    btn.disabled = false;
    btn.textContent = "✦ Revise with AI";
  }
}

function handleUndoRevise(key, form) {
  const previous = reviseUndoMap[key];
  if (previous === undefined) return;
  const textarea = form.querySelector(`[data-key="${key}"]`);
  if (!textarea) return;
  textarea.value = previous;
  updateFormDataByKey(key, previous);
  delete reviseUndoMap[key];
  const undoBtn = form.querySelector(`[data-undo-revise="${key}"]`);
  if (undoBtn) undoBtn.hidden = true;
  const statusEl = form.querySelector(`[data-revise-status="${key}"]`);
  if (statusEl) {
    statusEl.textContent = "Restored.";
    setTimeout(() => { statusEl.textContent = ""; }, 1800);
  }
}

// ── Address Autocomplete ─────────────────────────────────────────────────────

let _locationDebounceTimer = null;

async function fetchLocationSuggestions(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`;
  const response = await fetch(url, { headers: { "Accept-Language": "en" } });
  if (!response.ok) return [];
  const results = await response.json();
  const seen = new Set();
  const suggestions = [];
  for (const r of results) {
    const a = r.address || {};
    const city = a.city || a.town || a.village || a.municipality || a.county || "";
    const state = a.state || a.region || "";
    const countryCode = (a.country_code || "").toUpperCase();
    let label;
    if (city && state) {
      label = `${city}, ${state}`;
    } else if (city && countryCode) {
      label = `${city}, ${countryCode}`;
    } else {
      label = r.display_name.split(",").slice(0, 2).join(",").trim();
    }
    if (label && !seen.has(label)) {
      seen.add(label);
      suggestions.push(label);
    }
  }
  return suggestions.slice(0, 5);
}

function showAutocompleteDropdown(input, suggestions) {
  const dropdown = input.parentElement && input.parentElement.querySelector(".autocomplete-dropdown");
  if (!dropdown) return;
  if (suggestions.length === 0) {
    hideAutocompleteDropdown(input);
    return;
  }
  dropdown.innerHTML = suggestions
    .map((s) => `<button class="autocomplete-option" type="button">${escapeHtml(s)}</button>`)
    .join("");
  dropdown.classList.add("is-open");
}

function hideAutocompleteDropdown(input) {
  const dropdown = input.parentElement && input.parentElement.querySelector(".autocomplete-dropdown");
  if (!dropdown) return;
  dropdown.innerHTML = "";
  dropdown.classList.remove("is-open");
}

// ── Bullet Assistant ──────────────────────────────────────────────────────────

async function handleBulletAssistantGenerate(jobTitle, entryIndex, btn) {
  const resultsEl = document.getElementById(`bulletResults_${entryIndex}`);
  if (!resultsEl) return;

  btn.disabled = true;
  btn.textContent = "Generating…";
  resultsEl.innerHTML = `<p class="bullet-assistant-loading">Generating bullet points for <strong>${escapeHtml(jobTitle)}</strong>…</p>`;

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobTitle, pageType: "resume-builder" }),
    });
    const data = await response.json();

    if (!response.ok || !data.bullets || data.bullets.length === 0) {
      throw new Error(data.error || "No bullets returned.");
    }

    const chipsHtml = data.bullets
      .map(
        (text) =>
          `<button class="bullet-chip" type="button" data-bullet-text="${escapeHtml(text)}" data-bullet-index="${entryIndex}">${escapeHtml(text)}</button>`
      )
      .join("");

    resultsEl.innerHTML = `<div class="bullet-chip-list">${chipsHtml}</div>`;
  } catch (err) {
    resultsEl.innerHTML = `<p class="bullet-assistant-error">${escapeHtml(err.message || "Something went wrong.")}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Generate";
  }
}

function appendBulletToExperience(bulletText, entryIndex, form) {
  const key = `workExperience.${entryIndex}.details`;
  const textarea = form.querySelector(`[data-key="${key}"]`);
  if (!textarea) return;

  const current = textarea.value.trim();
  textarea.value = current ? `${current}\n• ${bulletText}` : `• ${bulletText}`;
  updateFormDataByKey(key, textarea.value);
}

function refreshUi(options = {}) {
  const animatePreview = Boolean(options.animatePreview);
  ResumeBuilderForm().render();
  updatePreviewVisibility(animatePreview);
  ResumePreview().render();
  PaywallOverlay().render();
  updateLockStateUi();
}

async function init() {
  bindGlobalEvents();
  await initCloudAuth();
  await fetchAccessState();
  await maybeVerifyCheckoutFromUrl();
  refreshUi();
  restoreScrollAfterAuthRedirect();
}

init();
