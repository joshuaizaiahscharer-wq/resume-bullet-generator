// ─── Job data ────────────────────────────────────────────────────────────────
// Each entry generates a page at:
//   /resume-bullet-points-for-<slug>
//
// To add a new job, copy one object, update the fields, and add it to the array.

const baseJobs = [
  {
    slug: "bartender",
    title: "Bartender",
    metaDescription:
      "10 professional resume bullet points for a Bartender — plus a free AI generator to create custom bullets for your resume instantly.",
    intro:
      "Whether you're applying to a craft cocktail bar or a high-volume restaurant, strong resume bullets make a real difference. Below are 10 polished example bullet points for a Bartender. Scroll down to generate a custom set tailored to your own experience.",
    bullets: [
      "Crafted and served 150+ cocktails per shift, maintaining quality and speed during peak hours",
      "Memorized a rotating menu of 40+ specialty drinks and recommended options based on guest preferences",
      "Processed cash and card transactions accurately, closing nightly totals with zero discrepancies",
      "Maintained a clean, organized bar area in full compliance with health and safety regulations",
      "Trained and mentored 3 new bartenders on house recipes, POS systems, and service standards",
      "Resolved guest complaints promptly, consistently turning negative experiences into repeat visits",
      "Collaborated with kitchen and floor staff to ensure seamless service during high-volume events",
      "Managed weekly bar inventory and reduced waste by 15% through precise ordering and stock rotation",
      "Upsold premium spirits and cocktail upgrades, increasing average ticket value by 20%",
      "Cultivated a loyal customer base through personalized service, contributing to a 4.8-star rating",
    ],
  },
  {
    slug: "cashier",
    title: "Cashier",
    metaDescription:
      "10 professional resume bullet points for a Cashier — plus a free AI generator to create custom bullets for your resume instantly.",
    intro:
      "A great cashier resume goes beyond simply listing \"operated register.\" These 10 example bullet points highlight the accuracy, speed, and customer-service skills that hiring managers look for. Generate your own personalized set below.",
    bullets: [
      "Processed 200+ customer transactions per shift with 99.9% accuracy across cash, card, and digital payments",
      "Balanced cash drawer and reconciled daily totals at shift close, maintaining zero variance over 6 months",
      "Delivered fast, friendly service by resolving product inquiries and checkout issues efficiently",
      "Enrolled customers in the store loyalty program, achieving a 25% sign-up rate among eligible shoppers",
      "Operated POS systems, barcode scanners, and payment terminals with full proficiency",
      "Maintained a clean, organized checkout lane to reduce wait times during peak shopping hours",
      "Identified and reported pricing discrepancies, improving inventory accuracy across 500+ SKUs",
      "Handled customer complaints and returns professionally, ensuring consistently high satisfaction",
      "Supported floor staff during high-traffic periods with restocking, bagging, and product location",
      "Trained 5 new cashiers on register operations, store policies, and customer service best practices",
    ],
  },
  {
    slug: "sales-associate",
    title: "Sales Associate",
    metaDescription:
      "10 professional resume bullet points for a Sales Associate — plus a free AI generator to create custom bullets for your resume instantly.",
    intro:
      "Sales associate roles are competitive — your resume needs to show measurable results, not just duties. These 10 example bullet points highlight the performance metrics and teamwork skills employers want to see. Generate your own custom set below.",
    bullets: [
      "Achieved 115% of monthly sales quota consistently over a 12-month period",
      "Assisted 80+ customers per shift with personalized product recommendations and expert advice",
      "Maintained deep product knowledge across 200+ SKUs to answer questions confidently and close sales",
      "Processed transactions, returns, and exchanges accurately using the store's POS system",
      "Built lasting customer relationships that drove a 30% repeat purchase rate",
      "Organized and replenished merchandise displays to maximize visual appeal and product accessibility",
      "Executed seasonal floor sets and promotional changes in collaboration with the visual team",
      "Resolved escalated customer concerns with empathy and efficiency, maintaining a 95% satisfaction score",
      "Participated in weekly inventory counts and flagged shrinkage concerns to store management",
      "Onboarded 4 new associates, sharing product knowledge, selling techniques, and store procedures",
    ],
  },
  {
    slug: "barista",
    title: "Barista",
    metaDescription:
      "10 professional resume bullet points for a Barista — copy strong barista resume bullets or generate custom ones with AI instantly.",
    intro:
      "Whether you're applying to a specialty coffee shop or a high-volume chain, these 10 example bullet points for a Barista show the skills and results employers look for. Generate a personalized set below.",
    bullets: [
      "Prepared and served 200+ espresso-based drinks per shift with consistent quality and latte art",
      "Maintained expert knowledge of single-origin beans, brewing methods, and flavor profiles",
      "Delivered fast, friendly service that contributed to a 4.9-star Google rating",
      "Operated and calibrated commercial espresso machines, grinders, and brewing equipment daily",
      "Managed opening and closing duties including cash counts, cleaning, and supply restocking",
      "Trained 6 new baristas on drink preparation, customer service standards, and food safety",
      "Upsold seasonal beverages and food pairings, increasing average ticket by 18%",
      "Maintained compliance with health and safety regulations across all food handling processes",
      "Processed 150+ transactions per shift accurately using a digital POS system",
      "Contributed to a welcoming café atmosphere that drove a 25% increase in repeat customer visits",
    ],
  },
  {
    slug: "server",
    title: "Server",
    metaDescription:
      "10 professional resume bullet points for a Server — copy strong restaurant server resume bullets or generate custom ones with AI.",
    intro:
      "A strong server resume goes beyond taking orders — it shows your ability to deliver great experiences and drive revenue. Use these 10 example bullet points as a starting point and generate your own below.",
    bullets: [
      "Delivered attentive table service to an average of 6 tables simultaneously in a high-volume restaurant",
      "Achieved the highest upsell rate on the team three months in a row by recommending wine pairings and appetizers",
      "Maintained thorough knowledge of a seasonal menu with 60+ items including allergen and dietary information",
      "Processed orders and payments accurately through a Toast POS system with zero end-of-night discrepancies",
      "Resolved guest concerns quickly and professionally, receiving consistent 5-star feedback on review platforms",
      "Collaborated with kitchen and host staff to coordinate seating and manage wait times during peak service",
      "Trained and mentored 4 new servers on menu knowledge, table service standards, and POS procedures",
      "Contributed to 20% growth in monthly catering revenue by proactively promoting group dining packages",
      "Ensured compliance with health code and alcohol service regulations at all times",
      "Maintained a clean and organized section throughout service, meeting all sanitation standards",
    ],
  },
  {
    slug: "receptionist",
    title: "Receptionist",
    metaDescription:
      "10 professional resume bullet points for a Receptionist — copy strong receptionist resume bullets or generate custom ones with AI.",
    intro:
      "Receptionists are the first impression of any organization. These 10 bullet points highlight the communication, organization, and multitasking skills hiring managers look for. Generate your own below.",
    bullets: [
      "Greeted and directed 100+ visitors daily, creating a welcoming and professional front-desk experience",
      "Managed a multi-line phone system, routing 200+ calls per day with accuracy and professionalism",
      "Scheduled and confirmed appointments for a team of 12 staff using an electronic calendar system",
      "Maintained organized filing systems for confidential records, contracts, and correspondence",
      "Prepared and distributed daily mail, packages, and internal communications across departments",
      "Coordinated conference room bookings and ensured AV equipment was set up for all meetings",
      "Processed visitor check-ins and issued security badges in compliance with building access protocols",
      "Drafted professional emails and memos on behalf of senior management with high accuracy",
      "Restocked and managed office supply inventory, reducing procurement costs by 12%",
      "Supported administrative team with data entry, document formatting, and calendar management",
    ],
  },
  {
    slug: "administrative-assistant",
    title: "Administrative Assistant",
    metaDescription:
      "10 professional resume bullet points for an Administrative Assistant — copy strong admin resume bullets or generate custom ones with AI.",
    intro:
      "Administrative Assistants keep organizations running smoothly. These 10 example bullet points show the organizational and communication skills employers want. Generate your own personalized set below.",
    bullets: [
      "Managed executive calendars, coordinating 50+ internal and external meetings per week across time zones",
      "Prepared reports, presentations, and correspondence for senior leadership with a consistent turnaround time under 24 hours",
      "Processed expense reports and reconciled corporate credit card statements totaling $50K+ monthly",
      "Maintained and organized digital and physical filing systems for contracts, HR documents, and project files",
      "Coordinated domestic and international travel arrangements including flights, hotels, and itineraries",
      "Acted as primary point of contact for vendors, clients, and internal staff inquiries",
      "Assisted with onboarding of new employees by preparing welcome materials and scheduling orientations",
      "Tracked project timelines and deliverables using project management tools, flagging risks proactively",
      "Drafted and proofread professional communications including emails, memos, and proposals",
      "Reduced office supply costs by 20% by implementing a centralized ordering and inventory tracking system",
    ],
  },
  {
    slug: "warehouse-worker",
    title: "Warehouse Worker",
    metaDescription:
      "10 professional resume bullet points for a Warehouse Worker — copy strong warehouse resume bullets or generate custom ones with AI.",
    intro:
      "Warehouse roles require speed, accuracy, and safety awareness. These 10 bullet points highlight the physical and operational skills employers look for. Generate your own customized set below.",
    bullets: [
      "Picked, packed, and shipped 300+ orders per shift with a 99.8% accuracy rate",
      "Operated forklifts, pallet jacks, and electric hand trucks safely in compliance with OSHA standards",
      "Received and verified inbound shipments of 1,000+ units daily against purchase orders",
      "Maintained organized inventory across 50,000 sq ft warehouse using an RF scanning system",
      "Performed cycle counts and resolved discrepancies, improving inventory accuracy by 12%",
      "Loaded and unloaded delivery trucks, ensuring proper weight distribution and load security",
      "Collaborated with logistics team to meet same-day shipping deadlines during peak season",
      "Trained 8 new warehouse associates on safety protocols, equipment operation, and picking procedures",
      "Maintained a clean and hazard-free work environment with zero safety incidents over 18 months",
      "Reduced average pick time by 10% by optimizing travel routes within the warehouse floor",
    ],
  },
  {
    slug: "retail-associate",
    title: "Retail Associate",
    metaDescription:
      "10 professional resume bullet points for a Retail Associate — copy strong retail resume bullets or generate custom ones with AI.",
    intro:
      "Retail Associates drive sales and shape the customer experience. These 10 bullet points emphasize service, sales skills, and teamwork. Generate a personalized set below.",
    bullets: [
      "Assisted 100+ customers daily with product selection, delivering a consultative and friendly experience",
      "Achieved personal sales targets every quarter, ranking in the top 15% of in-store associates",
      "Operated POS system to process sales, exchanges, and returns accurately and efficiently",
      "Maintained visually appealing merchandise displays in alignment with company planogram standards",
      "Performed daily stock replenishment and floor recovery to ensure product availability at all times",
      "Participated in bi-weekly inventory counts and reported shrinkage concerns to store management",
      "Built rapport with repeat customers, contributing to a 35% loyalty program enrollment rate",
      "Resolved customer complaints with professionalism, de-escalating situations to preserve satisfaction",
      "Supported loss prevention efforts by following proper cash handling and security procedures",
      "Trained 3 seasonal associates on product knowledge, service standards, and store operations",
    ],
  },
  {
    slug: "office-assistant",
    title: "Office Assistant",
    metaDescription:
      "10 professional resume bullet points for an Office Assistant — copy strong office assistant resume bullets or generate custom ones with AI.",
    intro:
      "Office Assistants keep day-to-day operations running efficiently. These 10 bullet points show the reliability, communication, and organizational skills hiring managers want to see. Generate your own below.",
    bullets: [
      "Supported a team of 15 staff with scheduling, document preparation, and general administrative tasks",
      "Managed incoming and outgoing correspondence including email, mail, and courier packages",
      "Maintained organized physical and digital filing systems for contracts, invoices, and HR records",
      "Ordered and tracked office supplies, keeping inventory stocked while staying within monthly budget",
      "Answered and routed incoming phone calls professionally using a multi-line phone system",
      "Formatted and proofread reports, presentations, and business documents for senior staff",
      "Coordinated meeting logistics including room reservations, catering, and AV equipment setup",
      "Entered data into spreadsheets and company databases with high accuracy and attention to detail",
      "Assisted with onboarding by preparing workstations, access credentials, and welcome packets",
      "Performed scanning, copying, and filing tasks to maintain a paperless-ready document system",
    ],
  },
  {
    slug: "delivery-driver",
    title: "Delivery Driver",
    metaDescription:
      "10 professional resume bullet points for a Delivery Driver — copy strong driver resume bullets or generate custom ones with AI.",
    intro:
      "Delivery Drivers are essential to customer satisfaction and logistics efficiency. These 10 bullet points highlight the reliability, navigation, and safety skills employers value most. Generate your own below.",
    bullets: [
      "Completed 50+ deliveries per shift on schedule with a 98% on-time delivery rate",
      "Navigated optimized delivery routes using GPS technology to minimize travel time and fuel costs",
      "Maintained a clean driving record with zero at-fault incidents over 3 years of commercial driving",
      "Verified delivery accuracy by scanning packages and collecting recipient signatures at each stop",
      "Conducted pre-trip and post-trip vehicle inspections in compliance with DOT safety requirements",
      "Communicated delivery ETAs and exceptions to dispatch and customers in real time",
      "Loaded and organized cargo for maximum efficiency, reducing damage during transit",
      "Handled customer inquiries and resolved delivery issues promptly and professionally",
      "Managed cash-on-delivery transactions and reconciled receipts accurately at end of shift",
      "Supported warehouse team during off-peak hours with sorting, staging, and inventory tasks",
    ],
  },
  {
    slug: "security-guard",
    title: "Security Guard",
    metaDescription:
      "10 professional resume bullet points for a Security Guard — copy strong security guard resume bullets or generate custom ones with AI.",
    intro:
      "Security Guards protect people, property, and assets. These 10 bullet points highlight the vigilance, communication, and emergency response skills that stand out on a resume. Generate your own below.",
    bullets: [
      "Monitored a 200,000 sq ft commercial facility via CCTV, access control systems, and foot patrols",
      "Responded to security incidents and emergencies following established protocols with composure",
      "Conducted thorough entry screening and visitor check-in procedures at multiple access points",
      "Prepared detailed incident reports documenting security breaches, accidents, and unusual activity",
      "Coordinated with local law enforcement and emergency services during critical situations",
      "Deterred theft and unauthorized access through regular patrols and proactive presence",
      "Maintained accurate security logs and shift handover documentation for all incidents",
      "Enforced building safety and evacuation procedures during drills and actual emergencies",
      "Assisted visitors and staff with directions, information, and access badge management",
      "Completed annual training in first aid, CPR, and emergency response procedures",
    ],
  },
  {
    slug: "housekeeper",
    title: "Housekeeper",
    metaDescription:
      "10 professional resume bullet points for a Housekeeper — copy strong housekeeper resume bullets or generate custom ones with AI.",
    intro:
      "Housekeepers ensure clean, safe, and welcoming environments. These 10 bullet points showcase the attention to detail, time management, and professionalism hiring managers look for. Generate your own below.",
    bullets: [
      "Cleaned and serviced 18+ guest rooms per shift in compliance with hotel brand standards",
      "Restocked amenities, linens, and toiletries efficiently to minimize guest disruption",
      "Reported maintenance issues and safety hazards promptly to the facilities team",
      "Maintained cleanliness of common areas including lobbies, hallways, and public restrooms",
      "Used commercial cleaning equipment and chemical products safely per OSHA and MSDS guidelines",
      "Achieved a 96% guest satisfaction score for room cleanliness as tracked by post-stay surveys",
      "Completed all assigned rooms within shift timeframe, regularly assisting teammates with overflow",
      "Followed strict lost-and-found procedures and returned 100% of guest items to the front desk",
      "Maintained accurate room status communication with front desk using radio and housekeeping carts",
      "Trained 4 new housekeeping staff on cleaning standards, room sequencing, and safety protocols",
    ],
  },
  {
    slug: "line-cook",
    title: "Line Cook",
    metaDescription:
      "10 professional resume bullet points for a Line Cook — copy strong line cook resume bullets or generate custom ones with AI.",
    intro:
      "Line Cooks keep kitchens running at peak performance. These 10 bullet points highlight the speed, consistency, and food safety skills that make a strong culinary resume. Generate your own below.",
    bullets: [
      "Prepared and plated 200+ dishes per service on a fast-paced grill and sauté station",
      "Maintained strict adherence to recipe specs, portion sizes, and plating standards",
      "Ensured all food items met temperature, quality, and presentation standards before expediting",
      "Followed HACCP food safety protocols, maintaining a pass record on all health inspections",
      "Executed prep work including butchering, portioning, and mise en place for daily service",
      "Communicated effectively with line team to coordinate timing and minimize ticket times",
      "Managed station cleanliness and organized coolers to maintain proper food storage and rotation",
      "Adapted quickly to menu changes and specials, learning new recipes within 24 hours",
      "Assisted in training 3 junior cooks on station procedures, knife skills, and food safety",
      "Reduced food waste by 15% through accurate prep forecasting and proper FIFO rotation",
    ],
  },
  {
    slug: "dishwasher",
    title: "Dishwasher",
    metaDescription:
      "10 professional resume bullet points for a Dishwasher — copy strong dishwasher resume bullets or generate custom ones with AI.",
    intro:
      "Dishwashers are the backbone of any kitchen operation. These 10 bullet points show the reliability, speed, and sanitation standards that help this role stand out on a resume. Generate your own below.",
    bullets: [
      "Washed, sanitized, and organized 500+ pieces of cookware, serviceware, and utensils per shift",
      "Maintained dish output pace to meet kitchen demand during high-volume service periods",
      "Complied with all sanitation and hygiene standards, contributing to passing health inspections",
      "Operated commercial dishwashers, ensuring proper chemical levels and water temperature at all times",
      "Restocked clean dishware, glasses, and utensils to service stations throughout service",
      "Removed and disposed of kitchen waste and maintained clean trash and recycling areas",
      "Assisted line cooks with basic prep tasks during slow periods including peeling, chopping, and portioning",
      "Maintained a clean and organized dish pit throughout each shift with zero backlog",
      "Reported equipment malfunctions to kitchen management for prompt repair",
      "Demonstrated reliability with a strong attendance record over 12 consecutive months",
    ],
  },
  {
    slug: "construction-worker",
    title: "Construction Worker",
    metaDescription:
      "10 professional resume bullet points for a Construction Worker — copy strong construction resume bullets or generate custom ones with AI.",
    intro:
      "Construction Workers form the foundation of every build. These 10 bullet points highlight the strength, safety awareness, and trade skills that get you hired. Generate a custom set below.",
    bullets: [
      "Performed concrete pouring, framing, and finishing tasks on residential and commercial projects",
      "Operated heavy equipment including excavators, skid steers, and compactors safely and efficiently",
      "Followed project blueprints and engineering specifications with precision to meet quality standards",
      "Maintained full compliance with OSHA safety regulations across all active job sites",
      "Completed jobsite setup, cleanup, and material staging to keep work areas organized and hazard-free",
      "Collaborated with subcontractors and tradespeople to coordinate tasks and meet project milestones",
      "Assisted in the installation of plumbing, electrical conduit, and structural steel components",
      "Identified and reported site hazards, contributing to zero lost-time injuries on the team",
      "Transported and positioned materials using hand trucks, forklifts, and rigging equipment",
      "Completed projects on schedule by efficiently managing daily tasks and adapting to scope changes",
    ],
  },
  {
    slug: "landscaper",
    title: "Landscaper",
    metaDescription:
      "10 professional resume bullet points for a Landscaper — copy strong landscaping resume bullets or generate custom ones with AI.",
    intro:
      "Landscapers transform outdoor spaces and maintain property curb appeal. These 10 bullet points highlight the skills and professionalism that impress employers. Generate a custom set below.",
    bullets: [
      "Maintained lawns, gardens, and grounds for 30+ residential and commercial properties on a weekly schedule",
      "Operated mowers, trimmers, edgers, blowers, and other power equipment safely and efficiently",
      "Planted, pruned, and fertilized trees, shrubs, and seasonal flowers per client specifications",
      "Designed and installed irrigation systems, reducing client water usage by an average of 20%",
      "Performed snow removal using plows, salt spreaders, and shovels during winter service contracts",
      "Delivered mulching, aeration, and overseeding services to improve soil health and lawn appearance",
      "Communicated directly with clients to understand preferences and deliver results that exceeded expectations",
      "Maintained all equipment through regular inspection, cleaning, and scheduling of professional service",
      "Loaded and managed tools and materials on crew vehicles to ensure efficient daily routing",
      "Trained 3 crew members on proper planting techniques, equipment use, and safety procedures",
    ],
  },
  {
    slug: "project-coordinator",
    title: "Project Coordinator",
    metaDescription:
      "10 professional resume bullet points for a Project Coordinator — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Project Coordinators keep teams aligned and projects on track. These 10 bullet points demonstrate the organizational, communication, and planning skills employers want. Generate your own below.",
    bullets: [
      "Coordinated cross-functional project teams of 10+ members across design, engineering, and marketing",
      "Maintained project schedules, budgets, and status reports using Asana, Jira, and Smartsheet",
      "Facilitated weekly stand-ups and stakeholder meetings, preparing agendas and distributing action items",
      "Tracked project milestones and proactively flagged risks to prevent timeline slippage",
      "Processed purchase orders and tracked invoices to ensure projects stayed within approved budgets",
      "Managed vendor relationships and coordinated external deliverables aligned with project deadlines",
      "Created and maintained detailed project documentation including SOPs, RAID logs, and meeting notes",
      "Supported the delivery of 12 concurrent projects with a combined budget of $2M+",
      "Implemented a new project tracking dashboard that reduced status update meetings by 30%",
      "Ensured compliance with internal processes and quality standards across all delivered projects",
    ],
  },
  {
    slug: "marketing-assistant",
    title: "Marketing Assistant",
    metaDescription:
      "10 professional resume bullet points for a Marketing Assistant — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Marketing Assistants support campaigns and content across channels. These 10 bullet points show the creativity and analytical skills that stand out on a marketing resume. Generate your own below.",
    bullets: [
      "Assisted in the execution of multi-channel marketing campaigns across email, social media, and paid ads",
      "Created and scheduled social media content for Instagram, LinkedIn, and Facebook, growing followers by 22%",
      "Drafted blog posts, email newsletters, and promotional copy aligned with brand voice and SEO guidelines",
      "Compiled weekly performance reports on campaign KPIs using Google Analytics and HubSpot",
      "Coordinated with designers and external vendors to deliver campaign assets on schedule",
      "Maintained the marketing calendar and tracked deadlines across 5 concurrent campaigns",
      "Conducted competitive research and summarized findings in actionable reports for the marketing team",
      "Supported trade show and event logistics including booth setup, materials, and post-event follow-up",
      "Updated website content and landing pages using WordPress and Webflow CMS platforms",
      "Managed the marketing asset library, ensuring all files were properly named, versioned, and archived",
    ],
  },
  {
    slug: "call-center-agent",
    title: "Call Center Agent",
    metaDescription:
      "10 professional resume bullet points for a Call Center Agent — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Call Center Agents are the voice of any brand. These 10 bullet points highlight the communication, problem-solving, and performance metrics that matter most on a call center resume. Generate yours below.",
    bullets: [
      "Handled 80+ inbound customer calls per day, resolving inquiries related to billing, orders, and technical issues",
      "Maintained an average handle time of 4.5 minutes while achieving a 94% first-call resolution rate",
      "Delivered consistent customer satisfaction scores above 90% across a 12-month evaluation period",
      "Navigated multiple CRM systems simultaneously to retrieve account data and log interaction notes",
      "Processed orders, refunds, and account changes accurately following company policies and procedures",
      "Identified upsell and cross-sell opportunities during service calls, generating an additional $8K in monthly revenue",
      "Escalated complex issues to Tier 2 support with full documentation to ensure seamless handoffs",
      "Participated in quality calibration sessions and incorporated supervisor feedback to improve call scores",
      "Maintained composure and professionalism when handling frustrated or difficult customers",
      "Trained 5 new agents on call scripting, CRM tools, and escalation procedures during onboarding",
    ],
  },
  {
    slug: "data-entry-clerk",
    title: "Data Entry Clerk",
    metaDescription:
      "10 professional resume bullet points for a Data Entry Clerk — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Data Entry Clerks keep business records accurate and up to date. These 10 bullet points showcase the speed, precision, and organizational skills employers look for. Generate your own below.",
    bullets: [
      "Entered 10,000+ records per week into company databases with a 99.9% accuracy rate",
      "Verified and cleaned incoming data to ensure consistency and integrity across all systems",
      "Processed invoices, purchase orders, and customer information using SAP and Salesforce",
      "Identified and corrected data discrepancies by cross-referencing source documents with database records",
      "Maintained organized digital filing systems for contracts, reports, and transactional records",
      "Converted paper-based forms and records into electronic format, improving retrieval efficiency by 40%",
      "Met daily data entry quotas consistently, supporting team throughput goals quarter over quarter",
      "Collaborated with accounting and operations teams to resolve data conflicts in a timely manner",
      "Assisted in auditing database records and generating compliance reports for quarterly reviews",
      "Trained 3 junior clerks on data entry standards, software navigation, and quality control procedures",
    ],
  },
  {
    slug: "shift-supervisor",
    title: "Shift Supervisor",
    metaDescription:
      "10 professional resume bullet points for a Shift Supervisor — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Shift Supervisors lead teams and keep operations running smoothly. These 10 bullet points demonstrate the leadership and operational skills that hiring managers want. Generate your own below.",
    bullets: [
      "Supervised a team of 12 associates per shift, delegating tasks and ensuring all targets were met",
      "Opened and closed the store following all cash handling, security, and safety protocols",
      "Resolved customer escalations quickly and professionally, maintaining a high satisfaction rating",
      "Monitored team performance and provided real-time coaching to improve productivity and quality",
      "Coordinated daily scheduling, break coverage, and task assignments to maintain optimal staffing",
      "Conducted pre-shift briefings to align the team on goals, promotions, and operational priorities",
      "Processed end-of-shift reports and communicated key metrics to store management",
      "Reduced shrinkage by 10% through consistent enforcement of loss prevention procedures",
      "Maintained compliance with food safety, labor, and health regulations across all shift operations",
      "Trained and mentored new team members, reducing average onboarding time by two weeks",
    ],
  },
  {
    slug: "sales-manager",
    title: "Sales Manager",
    metaDescription:
      "10 professional resume bullet points for a Sales Manager — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Sales Managers drive revenue and develop high-performing teams. These 10 bullet points highlight the leadership, strategy, and results-focused approach employers want. Generate your own below.",
    bullets: [
      "Led a team of 10 sales representatives to achieve 125% of annual revenue target, generating $4.2M",
      "Developed and executed territory sales plans that increased net new customer acquisition by 40%",
      "Implemented a structured sales coaching program that improved team close rate from 18% to 27%",
      "Recruited, hired, and onboarded 6 sales reps, reducing average ramp time by 30%",
      "Managed a pipeline of $2M+ in opportunities, providing accurate monthly and quarterly forecasts",
      "Collaborated with marketing on campaign alignment, driving a 35% increase in inbound qualified leads",
      "Negotiated and closed enterprise deals ranging from $50K to $500K in annual contract value",
      "Analyzed sales data and CRM metrics to identify performance trends and optimize rep activity",
      "Presented quarterly business reviews to senior leadership, highlighting wins, risks, and growth strategies",
      "Maintained a team retention rate of 85% by fostering a culture of recognition and development",
    ],
  },
  {
    slug: "customer-service-representative",
    title: "Customer Service Representative",
    metaDescription:
      "10 professional resume bullet points for a Customer Service Representative — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Customer Service Representatives are the frontline of any brand experience. These 10 bullet points show the empathy, problem-solving, and performance that employers value. Generate your own below.",
    bullets: [
      "Responded to 60+ customer inquiries daily via phone, email, and live chat with professionalism and empathy",
      "Achieved a customer satisfaction score of 96% over a 12-month period based on post-interaction surveys",
      "Resolved billing disputes, return requests, and account issues with a 92% first-contact resolution rate",
      "Maintained accurate records of all customer interactions and outcomes in Zendesk CRM",
      "Identified and escalated complex technical issues to the appropriate support tier with full documentation",
      "Processed orders, refunds, and subscription changes in compliance with company policy",
      "Proactively communicated service disruptions and resolutions, reducing inbound complaint volume by 18%",
      "Contributed to a knowledge base of 50+ help articles used by the team to resolve common issues faster",
      "Exceeded monthly NPS target by 12 points for three consecutive quarters",
      "Mentored 4 new team members on customer handling techniques, system navigation, and de-escalation",
    ],
  },
  {
    slug: "tutor",
    title: "Tutor",
    metaDescription:
      "10 professional resume bullet points for a Tutor — copy strong tutoring resume bullets or generate custom ones with AI.",
    intro:
      "Tutors make a measurable difference in student outcomes. These 10 bullet points highlight the teaching methods, subject expertise, and results that make a strong tutoring resume. Generate your own below.",
    bullets: [
      "Provided one-on-one and small group tutoring in mathematics and science to students in grades 6-12",
      "Improved average student grade by two letter grades over the course of an academic semester",
      "Developed personalized lesson plans and practice materials tailored to each student's learning gaps",
      "Supported 15+ students simultaneously with weekly sessions, maintaining consistent attendance and engagement",
      "Prepared students for standardized tests including SAT, ACT, and AP examinations",
      "Utilized diagnostic assessments to identify learning barriers and adjust instructional strategies accordingly",
      "Communicated student progress and actionable feedback to parents and guardians on a regular basis",
      "Incorporated visual aids, interactive tools, and real-world examples to improve concept retention",
      "Maintained detailed session notes and tracked individual progress toward academic goals",
      "Built strong rapport with students, creating a supportive and confidence-boosting learning environment",
    ],
  },
  {
    slug: "dental-assistant",
    title: "Dental Assistant",
    metaDescription:
      "10 professional resume bullet points for a Dental Assistant — copy strong dental assistant resume bullets or generate custom ones with AI.",
    intro:
      "Dental Assistants support clinical care and keep practices running smoothly. These 10 bullet points highlight the technical skills and patient care that employers look for. Generate your own below.",
    bullets: [
      "Assisted dentists with routine examinations, fillings, extractions, and crown preparations",
      "Prepared and sterilized instruments and operatories in compliance with OSHA and ADA infection control standards",
      "Took and developed full-mouth X-rays and periapical radiographs with precision and patient comfort in mind",
      "Recorded detailed patient medical histories, treatment notes, and chart updates in Dentrix and Eaglesoft",
      "Managed scheduling, appointment reminders, and patient communications to optimize daily clinic workflow",
      "Educated patients on post-procedure care and oral hygiene best practices, improving treatment adherence",
      "Processed insurance pre-authorizations and submitted claims, reducing billing errors by 15%",
      "Maintained and restocked clinical supplies, ensuring all treatment rooms were fully prepared at all times",
      "Supported patient comfort and anxiety management through clear communication and reassuring care",
      "Trained 2 new dental assistants on clinical procedures, software systems, and sterilization protocols",
    ],
  },
  {
    slug: "medical-assistant",
    title: "Medical Assistant",
    metaDescription:
      "10 professional resume bullet points for a Medical Assistant — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Medical Assistants bridge clinical care and administrative operations. These 10 bullet points highlight the versatile skills that make a standout medical assistant resume. Generate your own below.",
    bullets: [
      "Performed patient intake including vital signs, medical history reviews, and chief complaint documentation",
      "Administered injections, drew blood, and collected specimens following sterile technique and safety protocols",
      "Prepared examination rooms between patients and ensured all supplies were properly stocked and organized",
      "Assisted physicians with minor procedures, wound care, and physical examinations",
      "Scheduled appointments, referrals, and follow-up visits to maintain an efficient daily patient flow",
      "Processed prior authorizations and submitted insurance documentation, reducing turnaround by 20%",
      "Maintained accurate electronic health records in Epic and Athenahealth with zero documentation errors",
      "Educated patients on medication instructions, diet modifications, and post-visit care plans",
      "Coordinated lab orders, tracked results, and communicated abnormal findings to supervising physicians",
      "Maintained compliance with HIPAA regulations in all patient communication and records management",
    ],
  },
  {
    slug: "social-worker",
    title: "Social Worker",
    metaDescription:
      "10 professional resume bullet points for a Social Worker — copy strong social work resume bullets or generate custom ones with AI.",
    intro:
      "Social Workers advocate for clients and connect them with life-changing resources. These 10 bullet points highlight the skills and impact that define an exceptional social work resume. Generate your own below.",
    bullets: [
      "Managed a caseload of 45+ clients, providing ongoing assessment, intervention, and service coordination",
      "Conducted biopsychosocial assessments and developed individualized service plans in collaboration with clients",
      "Connected clients to housing, food assistance, mental health, and employment resources in the community",
      "Advocated on behalf of at-risk youth and families in court proceedings and interdisciplinary team meetings",
      "Facilitated weekly support groups for individuals dealing with trauma, addiction, and family conflict",
      "Maintained detailed case notes and documentation in compliance with agency and regulatory standards",
      "Collaborated with healthcare providers, schools, and legal professionals to deliver coordinated care",
      "Conducted home visits to assess client safety, living conditions, and compliance with service plans",
      "Responded to crisis situations using evidence-based de-escalation and intervention techniques",
      "Reduced client recidivism by 25% through proactive follow-up and long-term case management strategies",
    ],
  },
  {
    slug: "human-resources-assistant",
    title: "Human Resources Assistant",
    metaDescription:
      "10 professional resume bullet points for a Human Resources Assistant — copy strong HR resume bullets or generate custom ones with AI.",
    intro:
      "HR Assistants support the full employee lifecycle from recruiting to offboarding. These 10 bullet points show the organizational and interpersonal skills employers want. Generate your own below.",
    bullets: [
      "Supported full-cycle recruiting by posting jobs, screening resumes, and scheduling interviews for 20+ open roles",
      "Processed new hire paperwork, background checks, and onboarding documentation for 50+ employees annually",
      "Maintained accurate employee records in ADP and Workday, ensuring compliance with data privacy standards",
      "Coordinated employee orientation sessions and prepared welcome materials for new team members",
      "Assisted with payroll processing by verifying timesheets and resolving discrepancies before submission",
      "Responded to employee inquiries regarding benefits, PTO, and HR policies with timely and accurate information",
      "Organized and tracked performance review schedules, sending reminders and collecting completed forms",
      "Supported open enrollment administration for health, dental, and vision benefits for 200+ employees",
      "Maintained compliance tracking for mandatory training, certifications, and policy acknowledgments",
      "Assisted in drafting job descriptions, offer letters, and internal HR communications",
    ],
  },
  {
    slug: "software-engineer",
    title: "Software Engineer",
    metaDescription:
      "10 professional resume bullet points for a Software Engineer — copy strong engineering resume bullets or generate custom ones with AI.",
    intro:
      "Software Engineers build products that scale. These 10 bullet points highlight the technical skills, collaboration, and impact that make a strong engineering resume. Generate your own below.",
    bullets: [
      "Designed and implemented RESTful APIs serving 10M+ daily requests with 99.9% uptime",
      "Reduced page load time by 45% through code splitting, lazy loading, and caching optimizations",
      "Built and maintained microservices using Node.js, Python, and Go deployed on AWS ECS",
      "Led migration of monolithic application to microservices architecture, improving deployment frequency by 3x",
      "Wrote unit, integration, and end-to-end tests achieving 90%+ code coverage across core services",
      "Collaborated with product managers and designers in Agile sprints to deliver features on schedule",
      "Mentored 2 junior engineers through code reviews, pair programming, and weekly 1-on-1 sessions",
      "Identified and resolved a critical memory leak that reduced server costs by $12K per month",
      "Contributed to open source libraries used by 5,000+ developers in the community",
      "Participated in on-call rotation, resolving production incidents with an average MTTR of 18 minutes",
    ],
  },
  {
    slug: "graphic-designer",
    title: "Graphic Designer",
    metaDescription:
      "10 professional resume bullet points for a Graphic Designer — copy strong design resume bullets or generate custom ones with AI.",
    intro:
      "Graphic Designers bring ideas to life visually. These 10 bullet points highlight the creative, technical, and collaborative skills employers look for in a strong design portfolio and resume. Generate your own below.",
    bullets: [
      "Designed brand identities, logos, and visual systems for 30+ clients across retail, tech, and nonprofit sectors",
      "Produced print and digital assets including brochures, social media graphics, and display advertising",
      "Developed UI mockups and design prototypes in Figma to support product and web development teams",
      "Managed multiple design projects simultaneously, consistently delivering high-quality work on deadline",
      "Collaborated with marketing and copywriting teams to align visual design with campaign messaging",
      "Reduced design revision cycles by 25% by implementing a structured brief and feedback process",
      "Built and maintained a comprehensive brand style guide used across all company marketing materials",
      "Designed email templates that achieved a 32% click-through rate, exceeding industry benchmark by 12%",
      "Presented design concepts to stakeholders and incorporated feedback while preserving design integrity",
      "Proficient in Adobe Creative Suite (Photoshop, Illustrator, InDesign), Figma, and Canva",
    ],
  },
  {
    slug: "account-manager",
    title: "Account Manager",
    metaDescription:
      "10 professional resume bullet points for an Account Manager — copy strong account management resume bullets or generate custom ones with AI.",
    intro:
      "Account Managers grow revenue and build long-term client relationships. These 10 bullet points show the strategic and interpersonal skills that top account managers demonstrate on their resumes. Generate yours below.",
    bullets: [
      "Managed a portfolio of 40 enterprise accounts generating $6.5M in annual recurring revenue",
      "Achieved 118% of net revenue retention goal by identifying and closing upsell opportunities within existing accounts",
      "Conducted quarterly business reviews with C-suite stakeholders to align on goals and demonstrate product ROI",
      "Reduced churn by 22% through proactive health monitoring, executive engagement, and rapid issue resolution",
      "Negotiated multi-year contract renewals with an average deal size of $180K, maintaining a 95% renewal rate",
      "Partnered with sales engineers and product teams to scope and deliver custom implementation plans",
      "Built executive-level relationships that generated 15 referrals resulting in $1.2M in new business",
      "Maintained accurate pipeline forecasting and account data in Salesforce, achieving 90%+ forecast accuracy",
      "Developed account expansion playbooks adopted by the broader customer success team",
      "Onboarded 8 new enterprise clients, delivering time-to-value within 30 days for each account",
    ],
  },
  {
    slug: "business-analyst",
    title: "Business Analyst",
    metaDescription:
      "10 professional resume bullet points for a Business Analyst — copy strong BA resume bullets or generate custom ones with AI.",
    intro:
      "Business Analysts translate data and business needs into actionable solutions. These 10 bullet points highlight the analytical and communication skills that define top BA resumes. Generate your own below.",
    bullets: [
      "Gathered and documented business requirements from stakeholders across operations, finance, and IT",
      "Analyzed process workflows and identified inefficiencies that generated $400K in annual cost savings",
      "Created detailed functional specifications, user stories, and acceptance criteria for development teams",
      "Built dashboards and reports in Tableau and Power BI to track KPIs for senior leadership",
      "Facilitated requirements workshops and stakeholder interviews to define project scope and success metrics",
      "Managed backlog grooming and sprint planning activities in collaboration with Agile development teams",
      "Conducted gap analyses comparing current-state and future-state processes for ERP implementation",
      "Produced business cases with ROI projections that secured executive approval for 4 strategic initiatives",
      "Performed UAT coordination, documenting test cases and tracking defect resolution to project closure",
      "Delivered post-implementation reviews that measured benefit realization against original business case projections",
    ],
  },
  {
    slug: "it-support-specialist",
    title: "IT Support Specialist",
    metaDescription:
      "10 professional resume bullet points for an IT Support Specialist — copy strong IT resume bullets or generate custom ones with AI.",
    intro:
      "IT Support Specialists keep systems running and users productive. These 10 bullet points highlight the technical depth and customer focus that make a strong help desk or IT support resume. Generate yours below.",
    bullets: [
      "Resolved 50+ IT support tickets per day with an average first-response time of under 15 minutes",
      "Maintained a ticket resolution rate of 95% within SLA targets across all priority levels",
      "Configured and deployed 200+ workstations, laptops, and mobile devices for new hires and office expansions",
      "Administered Active Directory, managing user accounts, group policies, and access permissions for 500+ users",
      "Diagnosed and resolved hardware, software, networking, and VPN connectivity issues for remote and on-site staff",
      "Deployed software updates, security patches, and antivirus tools using SCCM and Intune",
      "Documented detailed troubleshooting guides and knowledge base articles, reducing repeat ticket volume by 30%",
      "Supported AV and conferencing systems for executive presentations and all-hands meetings",
      "Collaborated with the security team on phishing awareness training and endpoint protection initiatives",
      "Managed IT asset inventory, ensuring accurate tracking of 1,000+ hardware and software licenses",
    ],
  },
  {
    slug: "project-manager",
    title: "Project Manager",
    metaDescription:
      "10 professional resume bullet points for a Project Manager — copy strong PM resume bullets or generate custom ones with AI.",
    intro:
      "Project Managers deliver results on time and within budget. These 10 bullet points highlight the leadership, planning, and stakeholder skills that make a top-tier PM resume. Generate your own below.",
    bullets: [
      "Delivered 15 cross-functional projects on time and within budget with a combined scope of $8M",
      "Led teams of up to 25 members across engineering, design, marketing, and operations departments",
      "Developed comprehensive project plans, risk registers, and communication matrices for each initiative",
      "Implemented Agile and Scrum methodologies, improving sprint velocity by 35% within two quarters",
      "Managed stakeholder communications and executive reporting for projects with C-suite visibility",
      "Resolved scope creep and resource conflicts through structured change control and negotiation",
      "Reduced average project delivery timeline by 20% through process improvements and workflow automation",
      "Maintained project budgets with 98% forecast accuracy and zero unplanned overruns across 12 projects",
      "Conducted post-project retrospectives and implemented lessons learned to improve future delivery",
      "Mentored 3 junior project coordinators, supporting their growth and PMP certification preparation",
    ],
  },
  {
    slug: "operations-manager",
    title: "Operations Manager",
    metaDescription:
      "10 professional resume bullet points for an Operations Manager — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Operations Managers optimize the systems and people that power a business. These 10 bullet points highlight the efficiency, leadership, and strategic thinking employers look for. Generate your own below.",
    bullets: [
      "Oversaw daily operations for a 200-person facility, managing workflows across production, logistics, and quality control",
      "Reduced operating costs by $1.8M annually through process redesign, vendor renegotiation, and waste elimination",
      "Implemented a lean manufacturing initiative that increased throughput by 28% in six months",
      "Developed and tracked departmental KPIs, presenting weekly dashboards to executive leadership",
      "Led a team of 8 supervisors and 120 frontline employees, fostering a culture of accountability",
      "Managed vendor relationships and negotiated contracts, reducing supply chain costs by 15%",
      "Redesigned onboarding and training programs, cutting time-to-productivity for new hires by 35%",
      "Ensured 100% compliance with safety regulations, achieving zero recordable incidents over 24 months",
      "Directed inventory management improvements that reduced stockouts by 40% and carrying costs by 20%",
      "Collaborated with finance and HR to develop annual budgets, workforce plans, and capital expenditure proposals",
    ],
  },
  {
    slug: "customer-success-manager",
    title: "Customer Success Manager",
    metaDescription:
      "10 professional resume bullet points for a Customer Success Manager — copy strong CSM resume bullets or generate custom ones with AI.",
    intro:
      "Customer Success Managers drive retention and growth. These 10 bullet points highlight the strategic relationship management and revenue skills that top CSMs demonstrate. Generate your own below.",
    bullets: [
      "Managed a portfolio of 60 mid-market accounts with $4M in ARR, maintaining a 95% net revenue retention rate",
      "Drove upsell and expansion revenue of $800K by identifying growth opportunities within existing accounts",
      "Conducted executive business reviews that aligned product usage with customer ROI and strategic goals",
      "Reduced time-to-value for new customers from 45 days to 21 days by redesigning the onboarding process",
      "Proactively identified at-risk accounts using health score data and executed intervention strategies to prevent churn",
      "Collaborated with product and engineering teams to advocate for customer-requested features, influencing the roadmap",
      "Built and maintained executive relationships at Director, VP, and C-suite levels across all assigned accounts",
      "Created customer success resources including playbooks, training materials, and best practice documentation",
      "Achieved an NPS score of 72 across managed accounts, compared to a company average of 55",
      "Mentored 3 junior CSMs on account planning, executive communication, and renewal negotiation strategies",
    ],
  },
  {
    slug: "product-manager",
    title: "Product Manager",
    metaDescription:
      "10 professional resume bullet points for a Product Manager — copy strong PM resume bullets or generate custom ones with AI.",
    intro:
      "Product Managers define what gets built and why. These 10 bullet points highlight the strategy, execution, and cross-functional leadership that make a standout PM resume. Generate your own below.",
    bullets: [
      "Owned the product roadmap for a SaaS platform with 500K+ active users, prioritizing features by business impact",
      "Launched 3 major product features that contributed to a 30% increase in user activation rate",
      "Defined and tracked product OKRs, reporting progress to executive leadership on a monthly basis",
      "Conducted 100+ user interviews and synthesized insights to inform product strategy and backlog priorities",
      "Collaborated with engineering, design, and data teams in Agile sprints to deliver features on schedule",
      "Reduced customer-reported bug rate by 40% by implementing structured QA gates in the release process",
      "Developed go-to-market strategy for new product tier, working cross-functionally with sales and marketing",
      "Analyzed product usage data in Mixpanel and Amplitude to identify drop-off points and drive retention improvements",
      "Led competitive analysis that identified a positioning gap, informing a product pivot that boosted win rate by 18%",
      "Mentored 2 associate PMs, supporting their growth in discovery, prioritization, and stakeholder communication",
    ],
  },
  {
    slug: "ux-designer",
    title: "UX Designer",
    metaDescription:
      "10 professional resume bullet points for a UX Designer — copy strong UX design resume bullets or generate custom ones with AI.",
    intro:
      "UX Designers create experiences that are intuitive, useful, and delightful. These 10 bullet points highlight the research, design, and collaboration skills that define a strong UX portfolio and resume. Generate yours below.",
    bullets: [
      "Designed end-to-end user experiences for a mobile app with 2M+ downloads, from discovery through usability testing",
      "Conducted 50+ user interviews and usability tests that directly informed product decisions and reduced support tickets by 28%",
      "Created low-fidelity wireframes and high-fidelity prototypes in Figma for 10+ product initiatives",
      "Built and maintained a comprehensive design system that improved design consistency and engineering handoff efficiency",
      "Collaborated with product managers and engineers in Agile sprints to deliver user-centered features on schedule",
      "Reduced user task completion time by 35% through a redesigned onboarding flow based on behavioral analysis",
      "Performed competitive UX analysis and synthesized findings into strategic design recommendations for leadership",
      "Facilitated design thinking workshops and stakeholder reviews to align teams on user needs and priorities",
      "Defined and tracked UX success metrics including task success rate, time-on-task, and SUS scores",
      "Advocated for accessibility by implementing WCAG 2.1 AA standards across all new product designs",
    ],
  },
  {
    slug: "content-writer",
    title: "Content Writer",
    metaDescription:
      "10 professional resume bullet points for a Content Writer — copy strong writing resume bullets or generate custom ones with AI.",
    intro:
      "Content Writers inform, engage, and convert audiences. These 10 bullet points highlight the writing skills, SEO knowledge, and measurable results that employers look for. Generate your own below.",
    bullets: [
      "Produced 20+ SEO-optimized blog posts per month that drove a 65% increase in organic traffic over 12 months",
      "Wrote long-form guides, case studies, and whitepapers that generated 3,000+ leads per quarter",
      "Collaborated with SEO and content strategy teams to target high-intent keywords and improve SERP rankings",
      "Managed editorial calendar and maintained consistent publishing schedule across blog, email, and social channels",
      "Interviewed subject matter experts and translated complex topics into clear, engaging content for general audiences",
      "Improved email open rates by 22% through compelling subject line testing and audience segmentation",
      "Edited and proofread content from freelance contributors, ensuring brand voice and quality standards were met",
      "Developed product pages and landing page copy that contributed to a 15% conversion rate improvement",
      "Monitored content performance using Google Analytics and SEMrush, adjusting strategy based on data insights",
      "Built a library of 200+ reusable content assets including templates, FAQs, and email sequences",
    ],
  },
  {
    slug: "copywriter",
    title: "Copywriter",
    metaDescription:
      "10 professional resume bullet points for a Copywriter — copy strong copywriting resume bullets or generate custom ones with AI.",
    intro:
      "Copywriters turn words into revenue. These 10 bullet points highlight the persuasive writing, brand voice, and campaign impact that define an exceptional copywriter resume. Generate your own below.",
    bullets: [
      "Wrote conversion-focused copy for landing pages, email campaigns, and paid ads with measurable ROI",
      "Developed brand messaging frameworks and taglines for 15+ clients across SaaS, retail, and consumer goods",
      "Increased email click-through rates by 34% through A/B testing of subject lines, CTAs, and body copy",
      "Produced direct response copy for Facebook and Google ad campaigns generating $2M+ in attributed revenue",
      "Collaborated with art directors and designers to ensure seamless integration of copy and visual concepts",
      "Crafted long-form sales letters and lead generation pages with conversion rates above industry benchmarks",
      "Maintained and evolved brand voice guidelines used across all marketing and communications channels",
      "Wrote product launch copy including press releases, product descriptions, and launch email sequences",
      "Adapted messaging and tone for diverse audience segments including B2B, B2C, and technical buyers",
      "Delivered all projects on time with minimal revisions by developing thorough creative briefs upfront",
    ],
  },
  {
    slug: "digital-marketing-specialist",
    title: "Digital Marketing Specialist",
    metaDescription:
      "10 professional resume bullet points for a Digital Marketing Specialist — copy strong resume bullets or generate custom ones with AI.",
    intro:
      "Digital Marketing Specialists drive growth across paid, owned, and earned channels. These 10 bullet points highlight the strategy, execution, and analytics skills employers want. Generate your own below.",
    bullets: [
      "Managed $500K+ in annual paid media budget across Google Ads, Meta, and LinkedIn, achieving a 4.2x ROAS",
      "Grew organic social media following by 85% in 12 months through data-driven content strategy and community engagement",
      "Designed and launched email marketing campaigns achieving a 38% open rate and 6.2% click-through rate",
      "Built and optimized multi-channel marketing funnels that contributed to a 47% increase in qualified leads",
      "Analyzed campaign performance using Google Analytics, HubSpot, and GA4 to identify trends and optimize spend",
      "Conducted A/B testing on ad creatives, landing pages, and email sequences to improve conversion rates by 25%",
      "Developed monthly performance reports for senior leadership, translating data into clear strategic recommendations",
      "Collaborated with content, design, and product teams to align campaigns with product launches and promotions",
      "Implemented marketing automation workflows that reduced lead response time from 6 hours to under 10 minutes",
      "Executed influencer marketing partnerships that generated 2M+ impressions and 15K new email subscribers",
    ],
  },
  {
    slug: "seo-specialist",
    title: "SEO Specialist",
    metaDescription:
      "10 professional resume bullet points for an SEO Specialist — copy strong SEO resume bullets or generate custom ones with AI.",
    intro:
      "SEO Specialists build organic visibility that compounds over time. These 10 bullet points highlight the technical, content, and analytical skills that define a high-performing SEO resume. Generate your own below.",
    bullets: [
      "Grew organic search traffic by 210% over 18 months through an integrated on-page, technical, and link-building strategy",
      "Conducted comprehensive keyword research identifying 500+ high-intent target terms across priority content clusters",
      "Performed technical SEO audits and resolved critical issues including crawl errors, duplicate content, and Core Web Vitals",
      "Built 200+ high-authority backlinks through digital PR, guest posting, and strategic outreach campaigns",
      "Optimized 150+ landing pages for target keywords, improving average ranking position by 14 places",
      "Collaborated with content and development teams to implement schema markup, internal linking, and page speed improvements",
      "Monitored and reported on organic KPIs using Google Search Console, Ahrefs, and SEMrush on a weekly basis",
      "Developed and executed a local SEO strategy that increased Google Business Profile impressions by 320%",
      "Produced monthly SEO performance reports for executive stakeholders with clear attribution and next-step recommendations",
      "Led site migration planning and execution for a redesign, preserving 98% of pre-migration organic traffic",
    ],
  },
];

const VARIANT_CONFIGS = [
  {
    key: "entry-level",
    titlePrefix: "Entry Level",
    introTemplate:
      "Breaking into %ROLE% can feel competitive, but a strong resume helps you stand out quickly. These 10 entry-level %ROLE% resume bullet examples are designed to highlight transferable skills, reliability, and growth potential.",
    metaTemplate:
      "10 entry level %ROLE% resume bullet points plus a free AI generator to create tailored %ROLE% bullets instantly.",
    bullets: (role) => [
      `Completed role-specific onboarding in ${role} procedures, tools, and safety standards within the first 30 days`,
      `Supported day-to-day ${role} operations with a strong focus on consistency, punctuality, and attention to detail`,
      `Applied company SOPs in ${role} workflows to maintain quality and reduce avoidable errors`,
      `Collaborated with team members to handle high-volume periods and keep ${role} priorities on track`,
      `Communicated professionally with customers, coworkers, and supervisors while learning core ${role} responsibilities`,
      `Used feedback from managers to improve ${role} performance and meet weekly productivity expectations`,
      `Maintained organized records and clean work areas aligned with ${role} compliance and safety requirements`,
      `Demonstrated adaptability by learning new ${role} tasks quickly and supporting cross-functional needs`,
      `Contributed to positive team culture by taking initiative and assisting with additional ${role} duties as needed`,
      `Built a dependable foundation in ${role} best practices to prepare for increased responsibility and advancement`,
    ],
  },
  {
    key: "no-experience",
    titlePrefix: "No Experience",
    introTemplate:
      "If you are applying to %ROLE% jobs without direct experience, your resume should emphasize transferable strengths and work ethic. These 10 no-experience %ROLE% bullets help frame your potential in a professional, employer-friendly way.",
    metaTemplate:
      "10 no experience %ROLE% resume bullet points plus a free AI generator to build personalized %ROLE% bullets fast.",
    bullets: (role) => [
      `Leveraged transferable skills from school, volunteer work, and personal projects to support core ${role} tasks`,
      `Demonstrated strong reliability and attendance while learning foundational ${role} responsibilities from scratch`,
      `Learned new ${role} systems and workflows quickly through observation, documentation, and hands-on practice`,
      `Followed detailed instructions and checklists to deliver accurate results in entry ${role} assignments`,
      `Maintained clear and respectful communication with teammates and customers in a fast-paced ${role} environment`,
      `Stayed organized under pressure by prioritizing tasks and meeting deadlines related to ${role} operations`,
      `Applied problem-solving and critical thinking to resolve routine ${role} challenges with minimal supervision`,
      `Demonstrated professionalism by accepting coaching and implementing feedback to improve ${role} performance`,
      `Supported team goals by volunteering for additional ${role} duties during peak demand periods`,
      `Built confidence and practical capability in ${role} through continuous learning and consistent execution`,
    ],
  },
  {
    key: "experienced",
    titlePrefix: "Experienced",
    introTemplate:
      "Experienced %ROLE% candidates need resume bullets that show measurable impact and leadership. These 10 examples are tailored to highlight results, process improvements, and high-level execution in %ROLE% roles.",
    metaTemplate:
      "10 experienced %ROLE% resume bullet points plus a free AI generator to create advanced %ROLE% bullets in seconds.",
    bullets: (role) => [
      `Led high-impact ${role} initiatives that improved operational efficiency and elevated service quality`,
      `Optimized ${role} workflows by identifying bottlenecks and implementing scalable process improvements`,
      `Exceeded performance benchmarks in ${role} execution through strong planning, prioritization, and follow-through`,
      `Mentored junior team members in ${role} best practices, reducing ramp time and improving consistency`,
      `Collaborated cross-functionally to align ${role} deliverables with broader business objectives and timelines`,
      `Maintained advanced proficiency in ${role} tools and systems to drive faster, more accurate outcomes`,
      `Resolved complex ${role} issues proactively, minimizing disruptions and preserving stakeholder satisfaction`,
      `Improved KPI performance in ${role} responsibilities through data-informed decision making and accountability`,
      `Established quality standards and documentation that strengthened long-term ${role} process reliability`,
      `Delivered sustained results in ${role} leadership and execution across high-volume, high-pressure environments`,
    ],
  },
];

function sentenceCaseRole(role) {
  return role;
}

function createVariantJob(baseJob, variant) {
  const role = sentenceCaseRole(baseJob.title);
  const prefixTitle = `${variant.titlePrefix} ${baseJob.title}`;

  return {
    slug: `${baseJob.slug}-${variant.key}`,
    title: prefixTitle,
    metaDescription: variant.metaTemplate.replaceAll("%ROLE%", role),
    intro: variant.introTemplate.replaceAll("%ROLE%", role),
    bullets: variant.bullets(role),
  };
}

const variantJobs = baseJobs.flatMap((job) =>
  VARIANT_CONFIGS.map((variant) => createVariantJob(job, variant))
);

const exportedJobs = [...baseJobs, ...variantJobs];
exportedJobs.baseJobs = baseJobs;
module.exports = exportedJobs;
