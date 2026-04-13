/**
 * Replit Auth module — JavaScript implementation.
 *
 * Sets up Passport + OIDC, session middleware, and an isAuthenticated guard.
 * Wired into api/index.js before any other routes.
 */

const oidcClient = require("openid-client");
const { Strategy } = require("openid-client/passport");
const passport = require("passport");
const session = require("express-session");
const memoize = require("memoizee");
const connectPg = require("connect-pg-simple");
const supabase = require("../supabase");

const getOidcConfig = memoize(
  async () => {
    return await oidcClient.discovery(
      new URL(process.env.ISSUER_URL || "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1000 }
);

function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const PgStore = connectPg(session);
  const sessionStore = new PgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims && user.claims.exp;
}

async function setupAuth(app) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);

    const claims = user.claims || {};
    const replitSub = claims.sub;
    const replitEmail = claims.email || null;

    if (replitSub) {
      console.log(`[auth] LOGIN SUCCESS - replit_sub: ${replitSub} email: ${replitEmail}`);
      const nowIso = new Date().toISOString();
      supabase
        .from("users")
        .upsert(
          {
            replit_sub: replitSub,
            email: replitEmail ? String(replitEmail).trim().toLowerCase() : null,
            last_active: nowIso,
          },
          { onConflict: "replit_sub", ignoreDuplicates: false }
        )
        .then(({ error }) => {
          if (error) {
            console.error("[auth] login upsert error:", error.message);
          }
        })
        .catch((err) => {
          console.error("[auth] login upsert unexpected error:", err.message);
        });
    }

    verified(null, user);
  };

  const registeredStrategies = new Set();

  const ensureStrategy = (domain) => {
    const strategyName = `replitauth:${domain}`;
    if (!registeredStrategies.has(strategyName)) {
      const strategy = new Strategy(
        {
          name: strategyName,
          config,
          scope: "openid email profile offline_access",
          callbackURL: `https://${domain}/api/callback`,
        },
        verify
      );
      passport.use(strategy);
      registeredStrategies.add(strategyName);
    }
  };

  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    ensureStrategy(req.hostname);
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        oidcClient.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

async function syncReplitUserToSupabase(claims) {
  try {
    const replitSub = String(claims.sub || "").trim();
    const email = String(claims.email || "").trim().toLowerCase() || null;
    const now = new Date().toISOString();

    // 1) Look up by replit_sub first
    let { data: existing } = await supabase
      .from("users")
      .select("id, replit_sub, email")
      .eq("replit_sub", replitSub)
      .maybeSingle();

    // 2) Fallback: look up by email
    if (!existing && email) {
      const { data: byEmail } = await supabase
        .from("users")
        .select("id, replit_sub, email")
        .ilike("email", email)
        .maybeSingle();
      existing = byEmail || null;
    }

    if (existing) {
      // Update last_active and back-fill replit_sub if missing
      const updates = { is_logged_in: true, last_active: now };
      if (!existing.replit_sub) updates.replit_sub = replitSub;
      await supabase.from("users").update(updates).eq("id", existing.id);
    } else {
      // Insert a new user row
      const { randomUUID } = require("crypto");
      await supabase.from("users").insert({
        id: randomUUID(),
        email,
        replit_sub: replitSub,
        is_logged_in: true,
        has_paid: false,
        plan: "free",
        last_active: now,
      });
    }
  } catch (err) {
    console.error("[syncReplitUser] Failed to sync user to Supabase:", err.message);
  }
}

function registerAuthRoutes(app) {
  app.get("/api/auth/user", async (req, res) => {
    try {
      if (req.session && req.session.adminPasswordAuth === true) {
        return res.json({ id: "admin", email: "admin", firstName: "Admin", lastName: null, profileImageUrl: null });
      }
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      const claims = req.user && req.user.claims;
      if (!claims) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Sync Replit user into the Supabase users table (non-blocking)
      syncReplitUserToSupabase(claims).catch(() => {});

      return res.json({
        id: claims.sub,
        email: claims.email || null,
        firstName: claims.first_name || null,
        lastName: claims.last_name || null,
        profileImageUrl: claims.profile_image_url || null,
      });
    } catch (err) {
      console.error("[/api/auth/user] error:", err.message);
      return res.status(500).json({ message: "Failed to fetch user" });
    }
  });
}

async function isAuthenticated(req, res, next) {
  const user = req.user;

  if (!req.isAuthenticated || !req.isAuthenticated() || !user || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await oidcClient.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (_err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { setupAuth, registerAuthRoutes, isAuthenticated };
