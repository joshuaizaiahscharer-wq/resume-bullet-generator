(function () {
  "use strict";

  const textarea = document.getElementById("resumeText");
  const analyzeBtn = document.getElementById("analyzeResumeBtn");
  const statusEl = document.getElementById("checkerStatus");
  const resultEl = document.getElementById("checkerResult");
  const scoreTitleEl = document.getElementById("scoreTitle");
  const scoreBadgeEl = document.getElementById("scoreBadge");
  const scoreProgressEl = document.getElementById("scoreProgress");
  const feedbackListEl = document.getElementById("feedbackList");
  const improvementsListEl = document.getElementById("improvementsList");
  const moreImprovementsEl = document.getElementById("moreImprovementsText");
  const improvementsBlurEl = document.getElementById("improvementsBlurmask");
  const ctaBtn = document.getElementById("rewriteCtaBtn");
  const ctaSubtextEl = document.getElementById("ctaSubtext");
  const paywallModal = document.getElementById("paywallModal");
  const paywallCloseBtn = document.getElementById("paywallCloseBtn");
  const checkoutBtn = document.getElementById("checkoutBtn");

  if (!textarea || !analyzeBtn || !statusEl || !resultEl || !scoreTitleEl || !scoreBadgeEl || !scoreProgressEl || !feedbackListEl || !improvementsListEl || !ctaBtn || !paywallModal) {
    return;
  }

  // Store current resume text and payment status
  let currentResumeText = "";
  let paywallUnlocked = false;
  let latestFeedback = [];

  analyzeBtn.addEventListener("click", analyzeResumeHandler);
  ctaBtn.addEventListener("click", handleCtaClick);
  paywallCloseBtn.addEventListener("click", closePaywallModal);
  checkoutBtn.addEventListener("click", handleCheckout);

  // Close paywall when clicking backdrop
  paywallModal.addEventListener("click", (e) => {
    if (e.target === paywallModal.querySelector(".paywall-backdrop")) {
      closePaywallModal();
    }
  });

  async function analyzeResumeHandler() {
    const resumeText = String(textarea.value || "").trim();

    if (!resumeText) {
      showStatus("Please paste your resume first.", true);
      return;
    }

    currentResumeText = resumeText;
    analyzeBtn.disabled = true;
    showStatus("Analyzing resume...", false);

    try {
      const response = await fetch("/api/analyze-resume", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resume: resumeText.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || `Analysis failed (${response.status}).`);
      }

      renderResult(data.score, data.feedback, data.rating, resumeText);
      showStatus("Analysis complete.", false, true);
    } catch (err) {
      showStatus(err.message || "Unable to analyze resume right now.", true);
    } finally {
      analyzeBtn.disabled = false;
    }
  }

  function renderResult(score, feedback, rating, resumeText) {
    const safeScore = Math.max(0, Math.min(100, Number(score) || 0));
    const safeFeedback = Array.isArray(feedback) ? feedback : [];
    const safeRating = String(rating || "").trim();

    scoreTitleEl.textContent = safeRating
      ? `Resume Score: ${safeScore}% (${safeRating})`
      : `Resume Score: ${safeScore}%`;
    scoreProgressEl.style.width = `${safeScore}%`;
    scoreProgressEl.classList.remove("strong", "decent", "needs-work");
    scoreBadgeEl.classList.remove("strong", "decent", "needs-work");
    scoreBadgeEl.textContent = safeRating || "Needs Improvement";

    if (safeScore >= 80) {
      scoreProgressEl.classList.add("strong");
      scoreBadgeEl.classList.add("strong");
    } else if (safeScore >= 60) {
      scoreProgressEl.classList.add("decent");
      scoreBadgeEl.classList.add("decent");
    } else {
      scoreProgressEl.classList.add("needs-work");
      scoreBadgeEl.classList.add("needs-work");
    }

    latestFeedback = safeFeedback;

    const personalizedFeedback = buildPersonalizedInsights(resumeText, safeFeedback);

    // Render before/after improvement cards (show 2-3, blur the rest)
    renderImprovements(safeFeedback, resumeText);

    // Render detailed feedback
    feedbackListEl.innerHTML = "";
    const items = personalizedFeedback.length
      ? personalizedFeedback
      : ["Great baseline. Add quantified impact and role-specific wins to improve further."];

    items.forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      feedbackListEl.appendChild(li);
    });

    resultEl.classList.remove("hidden");
    resultEl.querySelector(".progress-bar")?.setAttribute("aria-valuenow", String(safeScore));
  }

  function renderImprovements(feedback, resumeText) {
    const maxVisible = 3; // Always show 2-3 improvements before paywall
    const improvements = generateImprovementPairs(feedback, resumeText);

    improvementsListEl.innerHTML = "";

    // Add visible improvement cards
    improvements.slice(0, maxVisible).forEach((improvement) => {
      const card = createImprovementCard(improvement);
      improvementsListEl.appendChild(card);
    });

    // Never show CTA before showing value.
    const visibleCount = Math.min(maxVisible, improvements.length);
    const shouldShowCta = visibleCount >= 2;
    ctaBtn.classList.toggle("hidden", !shouldShowCta);
    if (ctaSubtextEl) {
      ctaSubtextEl.classList.toggle("hidden", !shouldShowCta);
    }

    // Show blur overlay if there are more improvements (locked by paywall)
    if (improvements.length > maxVisible) {
      const remaining = improvements.length - maxVisible;
      if (paywallUnlocked) {
        // If unlocked, show all remaining improvements
        improvements.slice(maxVisible).forEach((improvement) => {
          const card = createImprovementCard(improvement);
          improvementsListEl.appendChild(card);
        });
        improvementsBlurEl.classList.add("hidden");
      } else {
        // If locked, show count in required format.
        moreImprovementsEl.textContent = `+ ${remaining} more ${remaining === 1 ? "improvement" : "improvements"} available`;
        improvementsBlurEl.classList.remove("hidden");
      }
    } else {
      improvementsBlurEl.classList.add("hidden");
    }
  }

  function generateImprovementPairs(feedback, resumeText) {
    const experienceData = extractExperienceData(resumeText);
    const roleType = detectPrimaryRoleType(experienceData.roles, resumeText);
    const experienceBullets = experienceData.bullets;
    const weakBullets = identifyWeakBullets(experienceBullets);
    const fallbackBullets = getFallbackBullets(experienceBullets, weakBullets);
    const candidates = [...weakBullets, ...fallbackBullets].slice(0, 6);

    // If the resume has job titles in Experience but no bullets, generate role-based samples.
    if (!experienceBullets.length && experienceData.roles.length) {
      return ensureMinimumImprovements(
        experienceData.roles.slice(0, 3).map((role) => buildRoleOnlyImprovement(role)),
        experienceData
      );
    }

    const rewrittenPairs = candidates
      .map((bullet) => {
        const improved = improveBullet(bullet, roleType);
        if (!improved) return null;
        return { before: bullet, after: improved };
      })
      .filter(Boolean);

    // If bullets exist but couldn't be rewritten confidently, still provide role-based value.
    if (!rewrittenPairs.length && experienceData.roles.length) {
      return ensureMinimumImprovements(
        experienceData.roles.slice(0, 3).map((role) => buildRoleOnlyImprovement(role)),
        experienceData
      );
    }

    return ensureMinimumImprovements(rewrittenPairs, experienceData);
  }

  function ensureMinimumImprovements(pairs, experienceData) {
    const output = Array.isArray(pairs) ? [...pairs] : [];
    const roles = Array.isArray(experienceData?.roles) ? experienceData.roles : [];

    if (output.length >= 3) {
      return output;
    }

    const roleQueue = roles.length ? [...roles] : ["Professional Role"];
    let idx = 0;
    while (output.length < 3) {
      const role = roleQueue[idx % roleQueue.length] || "Professional Role";
      output.push(buildRoleOnlyImprovement(role));
      idx += 1;
      if (idx > 6) break;
    }

    return output;
  }

  function extractExperienceBullets(resumeText) {
    return extractExperienceData(resumeText).bullets;
  }

  function extractExperienceData(resumeText) {
    if (!resumeText) {
      return { bullets: [], roles: [] };
    }

    const lines = String(resumeText)
      .split(/\r?\n/)
      .map((line) => line.trim());

    const bullets = [];
    const roles = [];
    let activeSection = "other";
    let underJobRole = false;

    lines.forEach((line) => {
      if (!line) {
        underJobRole = false;
        return;
      }

      const detectedSection = detectSection(line);
      if (detectedSection) {
        activeSection = detectedSection;
        underJobRole = false;
        return;
      }

      if (activeSection !== "experience") {
        return;
      }

      if (isSkippableLine(line)) {
        return;
      }

      if (isLikelyJobRoleLine(line)) {
        underJobRole = true;
        roles.push(line);
        return;
      }

      const words = countWords(line);
      const isBullet = /^[-•*–—]\s+/.test(line);
      const cleaned = line.replace(/^[-•*–—]\s+/, "").trim();

      if (isBullet && words > 6) {
        bullets.push(cleaned);
        return;
      }

      // Accept sentence-like lines under a job role as implicit bullets.
      if (underJobRole && words > 6 && /[a-zA-Z]/.test(cleaned)) {
        bullets.push(cleaned);
      }
    });

    return {
      bullets: dedupeList(bullets),
      roles: dedupeList(roles)
    };
  }

  function detectSection(line) {
    const normalized = line.toLowerCase().replace(/[^a-z\s]/g, " ").trim();

    if (/^(contact|contact info|contact information)$/.test(normalized)) return "contact";
    if (/^(summary|professional summary|profile|objective|career objective)$/.test(normalized)) return "summary";
    if (/^(experience|work experience|professional experience|employment|employment history)$/.test(normalized)) return "experience";
    if (/^(education|academic background|certifications?)$/.test(normalized)) return "education";
    return null;
  }

  function isSkippableLine(line) {
    const text = String(line || "").trim();
    if (!text) return true;
    if (countWords(text) < 5) return true;
    if (text.includes("@")) return true;
    if (/(https?:\/\/|www\.|linkedin\.com)/i.test(text)) return true;
    if (/\+?\d?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/.test(text)) return true;
    return false;
  }

  function isLikelyJobRoleLine(line) {
    const text = String(line || "").trim();
    if (!text) return false;
    if (text.includes("@") || /(https?:\/\/|www\.|linkedin\.com)/i.test(text)) return false;
    if (/\b(education|experience|summary|objective|skills?)\b/i.test(text)) return false;
    if (/^[-•*–—]\s+/.test(text)) return false;
    if (countWords(text) > 12) return false;
    if (/\b(19|20)\d{2}\b/.test(text)) return true;
    if (/\b(manager|engineer|analyst|assistant|specialist|coordinator|associate|director|intern)\b/i.test(text)) return true;
    if (/\b(server|nurse|cashier|barista|receptionist|teacher|driver|cook|chef|technician|developer|accountant|consultant|supervisor)\b/i.test(text)) return true;
    return false;
  }

  function buildRoleOnlyImprovement(roleLine) {
    const role = normalizeRoleTitle(roleLine);
    const generatedBullets = generateSampleBulletsForRole(role);
    const after = generatedBullets
      .map((line) => `• ${highlightMetrics(line)}`)
      .join("<br>");

    return {
      before: `${role} (Job Title Only)`,
      after
    };
  }

  function normalizeRoleTitle(roleLine) {
    const clean = String(roleLine || "")
      .replace(/\(.*?\)/g, "")
      .replace(/\b(19|20)\d{2}\b(?:\s*[-–]\s*\b(19|20)?\d{2}|\s*[-–]\s*present)?/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    if (!clean) return "Professional Role";
    return clean;
  }

  function generateSampleBulletsForRole(role, usedBulletIndices = {}) {
    const roleType = getRoleType(role);
    const roleText = String(role || "").toLowerCase();
    
    // Get the comprehensive template set for this role type
    const templates = getRoleTemplates(roleType, roleText);
    
    // Get the next unused bullet index for this role to prevent repetition
    const roleKey = `${roleType}_${roleText}`;
    const startIdx = usedBulletIndices[roleKey] || 0;
    const bulletCount = 3;
    
    // Select the next 3 unique bullets from the template set
    const selectedBullets = [];
    for (let i = 0; i < bulletCount && startIdx + i < templates.length; i++) {
      selectedBullets.push(templates[startIdx + i]);
    }
    
    // Track which bullet was last used for this role
    usedBulletIndices[roleKey] = (startIdx + bulletCount) % templates.length;
    
    // If we don't have enough bullets, fill with remaining templates
    while (selectedBullets.length < bulletCount && selectedBullets.length < templates.length) {
      const remaining = templates.filter(b => !selectedBullets.includes(b));
      if (remaining.length > 0) {
        selectedBullets.push(remaining[0]);
      } else {
        break;
      }
    }
    
    return selectedBullets.length > 0 ? selectedBullets : [
      "Managed core responsibilities for the role while maintaining quality and service standards.",
      "Coordinated with team members to complete high-priority tasks and maintain daily operations.",
      "Handled recurring workflow and documentation duties with strong attention to accuracy and timeliness."
    ];
  }

  function getRoleTemplates(roleType, roleText) {
    // Bartender/Server role templates
    if (roleType === "server_bartender") {
      return [
        "Served 60-100 guests per shift while maintaining order accuracy and delivering high-quality service.",
        "Processed $1,500-$2,800 in food and beverage transactions per shift using POS and cash controls.",
        "Coordinated with kitchen and bar staff to keep average ticket times within 10-14 minutes.",
        "Upsold wine and premium beverages, increasing check averages by $12-18 per table.",
        "Trained 3-5 new team members on service protocols and tableside techniques.",
        "Managed complex orders and special requests for 20-30 tables simultaneously during peak hours.",
        "Maintained full bar knowledge across 80+ cocktail recipes and local specialty drinks.",
        "Handled time-sensitive requests and walk-in guests while prioritizing regulars and large parties."
      ];
    }

    // Nurse/Healthcare role templates
    if (roleType === "nurse") {
      return [
        "Provided direct patient care for 20-40 patients per shift while ensuring timely treatment protocols.",
        "Documented clinical assessments, medication administration, and care plans for 25+ patients daily in the EMR.",
        "Collaborated with physicians, NAs, and care coordinators during shift handoffs for care continuity.",
        "Monitored vital signs and patient status for 30-50 beds, flagging critical changes to nursing staff.",
        "Educated 8-12 patients daily on post-discharge care, medications, and follow-up appointments.",
        "Assisted with 5-10 procedures per shift including wound care, catheter placement, and specimen collection.",
        "Triaged incoming patients using acuity protocols, prioritizing 15-25 cases per shift.",
        "Maintained accurate records for controlled substances across inventory checks and medication administration.",
        "Responded to patient call lights within 5 minutes and resolved concerns on first contact 85%+ of the time.",
        "Led morning huddles with 8-12 team members to review patient updates and assign care responsibilities."
      ];
    }

    // Teacher/Educator role templates
    if (/teacher|instructor|educator|professor/.test(roleText)) {
      return [
        "Designed and delivered daily lesson plans for 90+ students across 4-5 classroom sections.",
        "Increased assessment performance by 15-22% through differentiated instruction and targeted interventions.",
        "Implemented hands-on learning activities that improved student engagement and reduced absenteeism by 12%.",
        "Tracked student progress data weekly to identify gaps and provide targeted tutoring to 8-12 at-risk learners.",
        "Graded and provided detailed feedback on 300-500 assignments per grading cycle.",
        "Organized and led 3-4 classroom projects that connected curriculum to real-world applications.",
        "Communicated with parents through 15-25 progress reports and parent-teacher conferences per quarter.",
        "Created and maintained a structured classroom environment with clear expectations for 30+ diverse learners.",
        "Developed assessments and rubrics aligned to state standards across reading, writing, and math.",
        "Collaborated with special education and ELL specialists to support 5-8 students with individualized accommodations."
      ];
    }

    // Sales/Account Executive role templates
    if (/sales|account executive|business development|retail/.test(roleText)) {
      return [
        "Built and managed a pipeline of 30-50 qualified prospects through cold outreach and warm introductions.",
        "Closed $40K-$80K in monthly sales by conducting consultative demos and addressing customer objections.",
        "Maintained relationships with 10-15 key accounts valued at $50K-$200K annually through regular check-ins.",
        "Exceeded quarterly sales targets by 15-25% through strategic prospecting and deal acceleration.",
        "Negotiated contract terms and pricing for 8-12 enterprise deals, improving deal size by $10K-$30K on average.",
        "Grew territory revenue 35-50% year-over-year by identifying market opportunities and competitive gaps.",
        "Created customized proposals for 15-20 prospects per month addressing specific business needs.",
        "Trained 4-6 new sales reps on account management, objection handling, and closing techniques.",
        "Tracked KPIs across CRM for 60-80 active opportunities and maintained 90%+ forecast accuracy.",
        "Presented product demonstrations to C-level executives and managed approval workflows across 5-8 stakeholders."
      ];
    }

    // Software/Developer role templates
    if (/software|developer|engineer|programmer|it|technician/.test(roleText)) {
      return [
        "Built and deployed 5-10 new features used by 10K-50K+ active users each month.",
        "Resolved production incidents and critical bugs within 2-hour SLAs, maintaining 99.5%+ uptime.",
        "Automated recurring operational tasks, saving the team 10-20 hours per week on deployments and CI/CD.",
        "Designed scalable database schemas and API endpoints supporting 1M+ daily requests.",
        "Conducted code reviews for 15-25 pull requests per week, catching security and performance issues.",
        "Optimized application performance by 25-40%, reducing page load times from 4s to 2.5s.",
        "Led technical architecture discussions with 4-8 engineers, defining standards for 3 new microservices.",
        "Mentored 2-3 junior developers on coding best practices, debugging, and system design.",
        "Integrated third-party APIs and payment systems, handling 50-100 test cases per integration.",
        "Maintained comprehensive documentation for 15-20 technical systems and runbooks."
      ];
    }

    // Customer Service/Support role templates
    if (/customer service|support|call center|representative/.test(roleText)) {
      return [
        "Resolved 50-80 customer inquiries daily across phone, chat, email, and ticketing systems.",
        "Achieved first-call resolution rate of 80-85% by troubleshooting account and service issues thoroughly.",
        "Managed escalations and irate customers, de-escalating 40-60 sensitive situations per month.",
        "Met or exceeded all KPIs including average handle time (5-7 min), quality score (90%+), and CSAT (4.5/5).",
        "Documented recurring problems and submitted 30-50 improvement suggestions to product and operations teams.",
        "Upsold upgrades and add-on services to 15-25% of customers contacted.",
        "Onboarded 80-120 new customers monthly, walking them through product features and account setup.",
        "Achieved employee of the month award 2-3 times per year based on customer feedback and metrics.",
        "Trained 5-8 new support team members on processes, systems, and customer communication skills.",
        "Maintained detailed customer notes and history, enabling seamless handoffs and personalized support."
      ];
    }

    // Receptionist/Medical Office role templates
    if (roleType === "receptionist_clinic") {
      return [
        "Scheduled and confirmed 35-60 appointments daily while optimizing provider availability and patient flow.",
        "Checked in 50-90 patients per day, verifying insurance, updating demographics, and managing wait times.",
        "Maintained accurate and secure patient medical records and administrative files with 99%+ accuracy.",
        "Processed 30-50 insurance claims and authorization requests per week, managing follow-ups and denials.",
        "Answered 80-120 phone calls daily, triaging patient concerns and directing to appropriate clinical staff.",
        "Greeted visitors and escorted 30-40 guests daily while maintaining HIPAA compliance.",
        "Coordinated scheduling for 6-10 providers, managing 200-300 appointments per week.",
        "Processed payments and managed petty cash drawer, reconciling end-of-day transactions.",
        "Prepared 40-60 chart notes and referrals daily using EHR systems.",
        "Resolved patient concerns within 24 hours, maintaining satisfaction scores of 95%+."
      ];
    }

    // Childcare/Preschool role templates
    if (/childcare|preschool|daycare|nanny|child care assistant|teacher assistant/.test(roleText)) {
      return [
        "Supervised 12-18 children ages 2-5, maintaining a safe, clean, and developmentally-appropriate environment.",
        "Implemented 5-7 structured learning activities daily including arts, music, outdoor play, and story time.",
        "Documented daily progress notes for 15-18 children, tracking developmental milestones and behavioral observations.",
        "Communicated with 15-18 parents daily through written updates and brief conversations about their child's day.",
        "Enforced safety protocols including emergency procedures, hand washing, and sanitization 8-10 times daily.",
        "Managed bathroom needs, meals, and nap time for 12-18 children while maintaining routines.",
        "Created bulletin boards and learning displays that reflected current themes and encouraged parental engagement.",
        "Responded to behavioral challenges using positive reinforcement and age-appropriate redirection.",
        "Prepared snacks and meals following 2-3 allergy requirements per class while modeling healthy eating.",
        "Organized 2-3 field trips or special events per quarter involving logistics for 15-18 children."
      ];
    }

    // Administrative/Office Manager role templates
    if (/administrative|office manager|executive assistant|administrative assistant/.test(roleText)) {
      return [
        "Managed calendars and schedules for 3-6 executives, organizing 150-250 meetings per month.",
        "Prepared 40-60 reports, presentations, and meeting agendas weekly for executive leadership.",
        "Processed expense reports and purchase orders, managing 80-120 transactions per month.",
        "Coordinated office operations including supply inventory, vendor relationships, and facility maintenance.",
        "Handled confidential information including contracts, financial records, and personnel files.",
        "Assisted with hiring by conducting interviews, coordinating onboarding, and maintaining personnel files.",
        "Organized 5-10 company events, conferences, and retreats including logistics and budgeting.",
        "Took meeting minutes for 10-15 meetings per month and distributed action items to stakeholders.",
        "Managed office budget of $50K-$150K annually, tracking expenses and identifying cost-saving opportunities.",
        "Onboarded and trained 3-5 new administrative staff members on company procedures and systems."
      ];
    }

    // Marketing/Social Media role templates
    if (/marketing|content|social media|digital|copywriter|brand manager/.test(roleText)) {
      return [
        "Created and published 20-30 posts monthly across Facebook, Instagram, LinkedIn, and Twitter.",
        "Grew social media following by 25-40% through organic content and targeted campaigns.",
        "Developed 5-8 marketing campaigns per quarter with 40-60% engagement rates.",
        "Designed 30-50 visual assets monthly using Canva and graphic design tools.",
        "Managed email marketing campaigns reaching 10K-50K subscribers with 18-25% open rates.",
        "Collaborated with 4-6 team members on content calendars and campaign strategy.",
        "Analyzed monthly analytics and reported on KPIs including reach, engagement, and conversion rates.",
        "Responded to comments and messages within 2-4 hours, building community and brand loyalty.",
        "Coordinated influencer partnerships and product feature opportunities.",
        "Tracked competitor activity and industry trends to inform content strategy."
      ];
    }

    // Default/General role templates
    return [
      "Managed core responsibilities for the role while maintaining quality and service standards.",
      "Coordinated with team members to complete high-priority tasks and maintain daily operations.",
      "Handled recurring workflow and documentation duties with strong attention to accuracy and timeliness.",
      "Supported team goals through consistent performance and dependable communication.",
      "Tracked metrics relevant to role performance and reported outcomes to management.",
      "Resolved issues promptly and escalated concerns appropriately to supervisors.",
      "Completed assigned tasks on schedule while meeting quality standards.",
      "Demonstrated reliability and professional conduct in all interactions."
    ];
  }

  function identifyWeakBullets(bullets) {
    const weakIndicators = [
      "responsible for",
      "worked on",
      "helped with",
      "demonstrated",
      "assisted",
      "participated in",
      "was involved in"
    ];

    const metricsRegex = /(\d+%|\$\d|\d+\+|\d+\s+(hours|days|weeks|months|years|projects|clients|users|employees|tickets|accounts))/i;

    return bullets.filter((bullet) => {
      const lower = bullet.toLowerCase();
      const hasWeakPhrase = weakIndicators.some((phrase) => lower.includes(phrase));
      const lacksMetrics = !metricsRegex.test(bullet);
      return hasWeakPhrase || lacksMetrics;
    });
  }

  function getFallbackBullets(allBullets, weakBullets) {
    const weakSet = new Set(weakBullets);
    return allBullets.filter((line) => !weakSet.has(line) && countWords(line) > 6);
  }

  function improveBullet(bullet, roleHint) {
    const clean = String(bullet || "").replace(/^[-•*–—]\s+/, "").trim();
    if (!clean || countWords(clean) < 6 || isSkippableLine(clean)) {
      return null;
    }

    const core = clean
      .replace(/^(responsible for|worked on|helped with|demonstrated|assisted with|assisted|participated in|was involved in)\s+/i, "")
      .replace(/\.$/, "")
      .trim();

    if (!core || countWords(core) < 3) {
      return null;
    }

    const objectPhrase = normalizeObjectPhrase(core);
    if (!objectPhrase) {
      return null;
    }

    const effectiveRoleType = roleHint || getRoleType(core);
    const rewritten = buildRoleAwareRewrite(objectPhrase, effectiveRoleType, core);
    if (!rewritten) {
      return null;
    }

    const startsWithStrongVerb = /^(Managed|Served|Handled|Processed|Coordinated|Documented|Administered|Supported|Led|Resolved|Maintained|Delivered|Organized|Oversaw|Completed)\b/.test(rewritten);
    if (!startsWithStrongVerb) {
      return null;
    }

    return highlightMetrics(rewritten);
  }

  function detectPrimaryRoleType(roles, resumeText) {
    if (Array.isArray(roles) && roles.length) {
      const detected = getRoleType(roles[0]);
      if (detected !== "general") return detected;
    }
    return getRoleType(resumeText);
  }

  function getRoleType(text) {
    const value = String(text || "").toLowerCase();
    
    // Hospitality & Food Service
    if (/server|waiter|waitress|bartender|barista|bar manager/.test(value)) 
      return "server_bartender";
    
    // Healthcare
    if (/registered nurse|\brn\b|nurse|lpn|cna|nursing|healthcare provider|clinical/) 
      return "nurse";
    
    // Medical Administration
    if (/receptionist|front desk|clinic|medical office|patient access|check.?in/) 
      return "receptionist_clinic";
    
    // Education
    if (/teacher|instructor|educator|professor|tutor|training specialist/) 
      return "teacher";
    
    // Sales/Account Management
    if (/sales|account executive|business development|retail|account manager|sales representative/) 
      return "sales";
    
    // Technology
    if (/software|developer|engineer|programmer|it |technician|coder|full.?stack|frontend|backend/) 
      return "software";
    
    // Customer Support
    if (/customer service|support|call center|representative|help desk|technical support/) 
      return "customer_service";
    
    // Childcare
    if (/childcare|preschool|daycare|nanny|child care|assistant teacher|preschool teacher/) 
      return "childcare";
    
    // Administration
    if (/administrative|office manager|executive assistant|admin|scheduling/) 
      return "administrative";
    
    // Marketing
    if (/marketing|content|social media|digital|copywriter|brand|seo|social/) 
      return "marketing";
    
    // Finance/Accounting
    if (/accountant|bookkeeper|accounting|finance|tax|cpa|financial/) 
      return "finance";
    
    // Operations/Logistics
    if (/operations|logistics|supply chain|inventory|warehouse|distribution/) 
      return "operations";
    
    // HR/Recruiting
    if (/recruiting|recruiter|human resources|hr |talent acquisition|recruiting/) 
      return "hr_recruiting";
    
    return "general";
  }

  function buildRoleAwareRewrite(objectPhrase, roleType, seedText) {
    const phrase = objectPhrase.charAt(0).toLowerCase() + objectPhrase.slice(1);
    
    const templatesByRole = {
      server_bartender: [
        `Served ${phrase} for 60-100 guests per shift while maintaining order accuracy and service quality.`,
        `Processed ${phrase} during peak service windows, handling $1,500-$2,500 in daily transactions.`,
        `Coordinated ${phrase} with kitchen and bar staff to maintain 10-14 minute average ticket times.`,
        `Upsold premium ${phrase} to guests, increasing check averages by $12-18 per table.`,
        `Trained team members on ${phrase} techniques, improving overall service consistency.`,
        `Managed ${phrase} for 20-30 tables simultaneously while prioritizing timing and accuracy.`,
        `Resolved ${phrase} issues promptly, maintaining guest satisfaction scores above 90%.`,
        `Maintained knowledge of ${phrase} including 80+ cocktails and pairing recommendations.`
      ],
      nurse: [
        `Managed ${phrase} for 20-40 patients per shift while adhering to clinical protocols.`,
        `Documented ${phrase} in the EMR for 25+ patients daily, ensuring thorough care records.`,
        `Collaborated on ${phrase} with physicians and nursing staff during shift handoffs.`,
        `Monitored patient responses to ${phrase}, reporting critical changes to clinical team.`,
        `Supported ${phrase} needs for 30+ patients, prioritizing time-sensitive interventions.`,
        `Educated patients on ${phrase} including post-discharge instructions and follow-up care.`,
        `Assisted with ${phrase} procedures using sterile techniques and safety protocols.`,
        `Tracked ${phrase} outcomes across patient population, contributing to quality improvement data.`,
        `Coordinated ${phrase} with specialists and consulting physicians for complex cases.`,
        `Maintained accurate documentation of ${phrase} including start/stop times and patient responses.`
      ],
      teacher: [
        `Designed lessons addressing ${phrase} for 90+ students across 4-5 classroom sections.`,
        `Increased student mastery of ${phrase} by 15-22% through differentiated instruction.`,
        `Created assessments and rubrics measuring ${phrase}, tracking progress for 90+ learners.`,
        `Provided targeted interventions on ${phrase} to 8-12 at-risk students weekly.`,
        `Engaged learners in ${phrase} through hands-on activities increasing attendance by 12%.`,
        `Communicated progress on ${phrase} to 90+ families through reports and conferences.`,
        `Differentiated instruction for ${phrase} across multiple learning levels and modalities.`,
        `Tracked data on student ${phrase} performance, adjusting instruction to meet IEP and 504 goals.`,
        `Collaborated with specialists on ${phrase} interventions for 5-8 students with accommodations.`,
        `Connected lessons about ${phrase} to real-world applications and student interests.`
      ],
      sales: [
        `Built pipeline of 30-50 prospects for ${phrase}, conducting consultative needs analysis.`,
        `Closed deals for ${phrase}, exceeding monthly targets by $20K-$40K consistently.`,
        `Managed relationships with 10-15 key accounts purchasing ${phrase} worth $50K-$200K annually.`,
        `Negotiated favorable terms for ${phrase}, improving deal sizes by $10K-$30K on average.`,
        `Presented solutions for ${phrase} to C-level executives, securing 5-8 approval stakeholders.`,
        `Demonstrated ROI of ${phrase} during sales calls, addressing objections and closing rates.`,
        `Upsold additional ${phrase} services to existing customers, growing account value by 25-40%.`,
        `Trained sales team on positioning ${phrase} and handling common objections.`,
        `Tracked KPIs for ${phrase} pipeline, maintaining 90%+ forecast accuracy monthly.`,
        `Identified market opportunities for new ${phrase} offerings, contributing to product roadmap.`
      ],
      software: [
        `Developed features for ${phrase}, deployed to production serving 10K-50K+ active users.`,
        `Resolved ${phrase} bugs and production issues within 2-hour SLAs, maintaining 99.5%+ uptime.`,
        `Optimized ${phrase} systems, reducing latency by 25-40% and improving user experience.`,
        `Designed the architecture for ${phrase}, scaling to support 1M+ daily requests.`,
        `Automated ${phrase} processes, saving team 10-20 hours per week on operational tasks.`,
        `Reviewed code for ${phrase} implementations, catching security and performance issues.`,
        `Integrated third-party APIs for ${phrase} functionality, testing 50-100 scenarios per integration.`,
        `Mentored junior developers on ${phrase}} best practices and debugging techniques.`,
        `Documented ${phrase} systems and runbooks, maintaining technical knowledge base.`,
        `Led architecture discussions on ${phrase}, defining standards for new microservices.`
      ],
      customer_service: [
        `Resolved 50-80 ${phrase} inquiries daily across phone, chat, email, and ticketing.`,
        `Achieved 80-85% first-contact resolution rate on ${phrase} issues through thorough troubleshooting.`,
        `Managed escalations of ${phrase} complaints, de-escalating 40-60 sensitive cases monthly.`,
        `Met KPIs for ${phrase}} support including handle time, quality scores, and CSAT targets.`,
        `Documented ${phrase} problems and submitted 30-50 improvement suggestions to product teams.`,
        `Onboarded 80-120 new customers on ${phrase}}, walking through features and best practices.`,
        `Upsold upgrades and add-ons for {{${phrase}}}, converting 15-25% of customer contacts.`,
        `Trained 5-8 support team members on ${phrase} processes and customer communication skills.`,
        `Maintained detailed notes on ${phrase}} cases, enabling seamless team handoffs.`,
        `Achieved employee recognition 2-3 times yearly based on ${phrase}} support quality.`
      ],
      receptionist_clinic: [
        `Scheduled and confirmed 35-60 appointments daily for ${phrase}, optimizing provider availability.`,
        `Checked in 50-90 patients for {{${phrase}}}, verifying insurance and updating demographics accurately.`,
        `Maintained protected health records for {{${phrase}}}} with 99%+ accuracy and HIPAA compliance.`,
        `Processed 30-50 {{${phrase}}}} insurance claims and authorizations weekly with 90%+ approval rate.`,
        `Triaged 80-120 {{${phrase}}}} phone calls daily, directing to appropriate clinical staff.`,
        `Coordinated {{${phrase}}}} schedules for 6-10 providers, managing 200-300 appointments weekly.`,
        `Resolved {{${phrase}}}} patient concerns within 24 hours, maintaining 95%+ satisfaction scores.`,
        `Prepared {{${phrase}}}} chart notes and referrals daily using EHR systems.`,
        `Managed {{${phrase}}}} payment processing and reconciled end-of-day transactions.`,
        `Escorted {{${phrase}}}} visitors and maintained professional check-in environment.`
      ],
      childcare: [
        `Supervised {{${phrase}}}} with 12-18 children, maintaining safe and age-appropriate environment.`,
        `Implemented {{${phrase}}}} activities including arts, music, outdoor play, and reading.`,
        `Documented {{${phrase}}}} progress notes for 15-18 children, tracking developmental milestones.`,
        `Communicated {{${phrase}}}} updates to 15-18 parents daily through notes and conversations.`,
        `Enforced {{${phrase}}}} safety protocols including emergency procedures and sanitization.`,
        `Managed {{${phrase}}}} meals, accommodating 2-3 allergy requirements per class.`,
        `Organized {{${phrase}}}} field trips for 15-18 children including logistics and transportation.`,
        `Responded to {{${phrase}}}} behavioral challenges using positive reinforcement and redirection.`,
        `Created {{${phrase}}}} displays reflecting current themes and encouraging engagement.`,
        `Maintained {{${phrase}}}} routines for bathroom needs, meals, and rest time.`
      ],
      administrative: [
        `Managed calendars for {{${phrase}}}} executives, organizing 150-250 meetings monthly.`,
        `Prepared {{${phrase}}}} reports, presentations, and agendas for executive leadership weekly.`,
        `Processed {{${phrase}}}} expense reports and purchase orders, managing 80-120 transactions monthly.`,
        `Coordinated {{${phrase}}}} office operations including supplies, vendors, and facilities.`,
        `Handled {{${phrase}}}} confidential information including contracts and personnel files.`,
        `Assisted with {{${phrase}}}} hiring including interviews, onboarding, and file management.`,
        `Organized {{${phrase}}}} company events, conferences, and retreats including logistics.`,
        `Took {{${phrase}}}} meeting minutes for 10-15 meetings monthly and distributed action items.`,
        `Managed {{${phrase}}}} office budget of $50K-$150K annually, tracking expenses.`,
        `Trained {{${phrase}}}} new administrative staff on procedures and company systems.`
      ],
      marketing: [
        `Created and published {{${phrase}}}} posts 20-30 times monthly across 4-5 social platforms.`,
        `Grew {{${phrase}}}} following by 25-40% through organic content and targeted campaigns.`,
        `Developed {{${phrase}}}} campaigns quarterly with 40-60% engagement and 18-25% conversion.`,
        `Designed {{${phrase}}}} visual assets 30-50 times monthly using graphic design tools.`,
        `Managed {{${phrase}}}} email campaigns reaching 10K-50K subscribers with 18-25% open rates.`,
        `Collaborated with {{${phrase}}}} team on content calendars and campaign strategy.`,
        `Analyzed {{${phrase}}}} metrics and reported on KPIs including reach and engagement.`,
        `Responded to {{${phrase}}}} comments and messages within 2-4 hours, building community.`,
        `Coordinated {{${phrase}}}} influencer partnerships and product features.`,
        `Tracked competitor {{${phrase}}}} activity and industry trends for content strategy.`
      ],
      finance: [
        `Managed {{${phrase}}}} accounts for 50-100 clients, ensuring compliance and accuracy.`,
        `Processed {{${phrase}}}} transactions using QuickBooks and accounting software.`,
        `Reconciled {{${phrase}}}} statements monthly with zero discrepancies.`,
        `Prepared {{${phrase}}}} reports including P&L summaries and variance analyses.`,
        `Supported {{${phrase}}}} audits by organizing documentation and responding to inquiries.`,
        `Entered {{${phrase}}}} data with 99%+ accuracy, processing 200-300 entries daily.`,
        `Calculated {{${phrase}}}} taxes for individuals and small businesses.`,
        `Managed {{${phrase}}}} workflow to meet quarterly deadlines.`,
        `Trained team on {{${phrase}}}} procedures and compliance requirements.`,
        `Identified {{${phrase}}}} cost savings opportunities worth $10K-$50K annually.`
      ],
      operations: [
        `Managed {{${phrase}}}} inventory, maintaining stock levels and minimizing waste.`,
        `Coordinated {{${phrase}}}} logistics across 5-10 distribution centers or locations.`,
        `Optimized {{${phrase}}}} processes, reducing costs by 15-20% annually.`,
        `Tracked {{${phrase}}}} KPIs including efficiency, on-time performance, and error rates.`,
        `Managed {{${phrase}}}} staff of 8-15 people, scheduling shifts and training new hires.`,
        `Resolved {{${phrase}}}} issues and escalations within 4-hour SLAs.`,
        `Maintained {{${phrase}}}} compliance with safety regulations and company standards.`,
        `Negotiated {{${phrase}}}} vendor contracts, securing 10-15% discounts.`,
        `Implemented {{${phrase}}}} systems improvements that reduced cycle time by 20-30%.`,
        `Reported {{${phrase}}}} metrics to management and recommended improvements.`
      ],
      hr_recruiting: [
        `Sourced and screened {{${phrase}}}} candidates through job boards and networking.`,
        `Conducted {{${phrase}}}} interviews for 20-40 candidates monthly.`,
        `Coordinated {{${phrase}}}} offer letters and onboarding for new hires.`,
        `Maintained {{${phrase}}}} recruitment tracking and reporting.`,
        `Reduced {{${phrase}}}} time-to-hire by 20-30% through process improvements.`,
        `Managed {{${phrase}}}} employee relations including performance reviews and documentation.`,
        `Processed {{${phrase}}}} HR transactions including benefits and payroll.`,
        `Trained {{${phrase}}}} managers on hiring best practices and compliance.`,
        `Organized {{${phrase}}}} company programs and team building events.`,
        `Supported {{${phrase}}}} compliance with employment laws and regulations.`
      ],
      general: [
        `Managed ${phrase} as part of daily operations while maintaining quality standards.`,
        `Coordinated ${phrase} with team members to complete high-priority tasks on schedule.`,
        `Handled ${phrase} consistently, supporting accurate documentation and reliable output.`,
        `Supported ${phrase} goals through consistent effort and professional communication.`,
        `Tracked {{${phrase}}}} metrics and reported performance outcomes to management.`,
        `Resolved {{${phrase}}}} issues promptly and escalated concerns appropriately.`,
        `Completed {{${phrase}}}} tasks on schedule while meeting quality expectations.`,
        `Demonstrated reliability and professionalism in all {{${phrase}}}} interactions.`
      ]
    };

    const templates = templatesByRole[roleType] || templatesByRole.general;
    const index = getDeterministicIndex(seedText, templates.length);
    const selected = templates[index] || null;
    
    // Replace template placeholders
    return selected || null;
  }

  function getDeterministicIndex(seedText, modulo) {
    const text = String(seedText || "");
    if (!text || modulo <= 0) return 0;
    let sum = 0;
    for (let i = 0; i < text.length; i += 1) {
      sum += text.charCodeAt(i);
    }
    return sum % modulo;
  }

  function normalizeObjectPhrase(text) {
    let phrase = String(text || "")
      .replace(/^(managing|handling|working on|helping with|assisting with)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!phrase) return "key responsibilities";

    // Remove trailing connectors that create awkward rewrites.
    phrase = phrase.replace(/\b(and|with|for|to)$/i, "").trim();
    return phrase || null;
  }

  function highlightMetrics(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/(\$\d[\d,.]*|\d+%|\d+\+|\d+-\d+|\d+\s*(minutes|patients|customers|appointments|guests))/gi, "<span class='improvement-highlight'>$1</span>");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function countWords(line) {
    return String(line || "").trim().split(/\s+/).filter(Boolean).length;
  }

  function dedupeList(items) {
    return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  }

  function buildPersonalizedInsights(resumeText, apiFeedback) {
    const experienceData = extractExperienceData(resumeText);
    const insights = [];

    if (experienceData.roles.length > 0 && experienceData.bullets.length === 0) {
      insights.push("Your experience section is missing bullet points");
    }

    const metricsRegex = /(\d+%|\$\d|\d+\+|\d+\s+(patients|customers|clients|users|projects|tickets|hours|days|weeks|months|years))/i;
    if (!metricsRegex.test(String(resumeText || ""))) {
      insights.push("Your resume lacks measurable impact");
    }

    apiFeedback.forEach((item) => {
      if (!insights.includes(item)) {
        insights.push(item);
      }
    });

    return insights.slice(0, 4);
  }

  function createImprovementCard(improvement) {
    const card = document.createElement("div");
    card.className = "improvement-card";

    const beforeText = escapeHtml(improvement.before);
    const afterText = String(improvement.after || "");

    card.innerHTML = `
      <div class="improvement-pair">
        <div class="bullet-column">
          <div class="bullet-label">Before</div>
          <div class="bullet-before">${beforeText}</div>
        </div>
        <div class="bullet-column">
          <div class="bullet-label">After</div>
          <div class="bullet-after">${afterText}</div>
        </div>
      </div>
    `;

    return card;
  }

  function handleCtaClick() {
    // Open paywall modal instead of redirecting
    openPaywallModal();
  }

  function openPaywallModal() {
    paywallModal.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closePaywallModal() {
    paywallModal.classList.add("hidden");
    document.body.style.overflow = "";
  }

  function handleCheckout() {
    // Simulate checkout process
    checkoutBtn.disabled = true;
    checkoutBtn.textContent = "Processing...";

    // In production, integrate with Stripe/payment processor
    // For now, simulate successful payment after 1.5 seconds
    setTimeout(() => {
      paywallUnlocked = true;
      sessionStorage.setItem("checkerPaywallUnlocked", "true");

      // Re-render improvements to show all locked ones
      renderImprovements(latestFeedback, currentResumeText);

      // Close modal and show success
      checkoutBtn.disabled = false;
      checkoutBtn.textContent = "Unlock Full Optimization";
      closePaywallModal();

      // Show success message
      showStatus("✨ Payment successful! All improvements unlocked.", false, true);

      // Optional: redirect to generator with resume data after brief delay
      setTimeout(() => {
        if (currentResumeText) {
          sessionStorage.setItem("resumeDataFromChecker", currentResumeText);
        }
        window.location.href = "/index.html";
      }, 1500);
    }, 1500);
  }

  // Check if paywall was previously unlocked
  (function checkPaywallStatus() {
    if (sessionStorage.getItem("checkerPaywallUnlocked") === "true") {
      paywallUnlocked = true;
    }
  })();

  function showStatus(message, isError, isSuccess) {
    statusEl.textContent = message || "";
    statusEl.classList.remove("hidden", "error", "success");
    if (!message) {
      statusEl.classList.add("hidden");
      return;
    }

    if (isError) statusEl.classList.add("error");
    if (isSuccess) statusEl.classList.add("success");
  }
})();
