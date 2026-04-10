/**
 * auth.js — Universal BulletAI auth module
 *
 * Loaded on every page. Initialises a Supabase client, exposes
 * window.BulletAuth, manages the #navAuthBtn in every nav, and
 * injects + owns the sign-in modal on pages that don't already
 * have one (i.e. every page except resume-template-builder.html,
 * which embeds the modal directly and binds its own form handlers).
 *
 * Dispatches a 'bulletauth:change' CustomEvent on document whenever
 * auth state changes so other page scripts can react without coupling.
 */
(function () {
  'use strict';

  if (window.__bulletAuthBootstrapped) {
    return;
  }
  window.__bulletAuthBootstrapped = true;

  /* ── Modal HTML injected on non-builder pages ── */
  var MODAL_HTML = [
    '<div id="authModal" class="auth-modal-overlay" hidden aria-hidden="true">',
    '  <div class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="authModalTitle">',
    '    <button class="auth-modal-close" id="authModalClose" type="button" aria-label="Close sign-in dialog">&#10005;</button>',
    '    <h2 class="auth-modal-title" id="authModalTitle">Sign in to BulletAI</h2>',
    '    <p class="auth-modal-subtitle">We\u2019ll email you a one-time link \u2014 no password needed.</p>',
    '    <div class="auth-modal-email-section">',
    '      <input id="authModalEmailInput" type="email" class="auth-modal-email-input" placeholder="you@example.com" autocomplete="email" />',
    '      <button id="authModalEmailBtn" class="auth-modal-submit-btn" type="button">Send magic link</button>',
    '    </div>',
    '    <div class="auth-modal-divider"><span>or</span></div>',
    '    <button id="authModalGoogleBtn" class="auth-modal-oauth-btn auth-modal-google-btn" type="button">',
    '      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">',
    '        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>',
    '        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>',
    '        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>',
    '        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>',
    '      </svg>',
    '      Continue with Google',
    '    </button>',
    '    <p class="auth-modal-status" id="authModalStatus"></p>',
    '  </div>',
    '</div>',
  ].join('\n');

  /* ── Helpers ── */
  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isBuilderPage() {
    return Boolean(document.getElementById('resumeBuilderFormRoot'));
  }

  var previousSyncedUserId = null;

  async function updateUserLogoutState(userId) {
    if (!BulletAuth._supabase) return;
    try {
      var targetUserId = userId || previousSyncedUserId;
      if (!targetUserId) return;

      const { error: updateError } = await BulletAuth._supabase
        .from('users')
        .update({
          is_logged_in: false,
          last_active: new Date().toISOString(),
        })
        .eq('id', targetUserId);

      if (updateError) {
        console.error('Update error:', updateError);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  async function syncUserWithDatabase(user) {
    if (!BulletAuth._supabase) return;

    try {
      const authUser = user || (await BulletAuth._supabase.auth.getUser())?.data?.user || null;
      if (!authUser) return;

      console.log('Syncing user:', authUser.id);

      const nowIso = new Date().toISOString();
      const safeEmail = normalizeEmail(authUser.email || authUser.user_metadata?.email || '');
      const { data: existingUser, error: fetchError } = await BulletAuth._supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
      }

      if (!existingUser) {
        console.warn('No users row found yet for auth user. Expected DB trigger to create it:', authUser.id);
        return;
      } else {
        console.log('Updating existing user');

        const { error: updateError } = await BulletAuth._supabase
          .from('users')
          .update({
            email: safeEmail,
            is_logged_in: true,
            last_active: nowIso,
          })
          .eq('id', authUser.id);

        if (updateError) {
          console.error('Update error:', updateError);
          return;
        }

        console.log('User updated successfully');
      }

      previousSyncedUserId = authUser.id;
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  }

  /* ── Core auth object ── */
  var BulletAuth = {
    _supabase: null,
    _user: null,
    _listeners: [],

    isSignedIn: function () {
      return Boolean(this._user);
    },

    getEmail: function () {
      return normalizeEmail(this._user ? this._user.email : '');
    },

    getUser: function () {
      return this._user;
    },

    signOut: async function () {
      if (this._supabase) {
        await this._supabase.auth.signOut();
      }
    },

    openAuthModal: function () {
      var modal = document.getElementById('authModal');
      if (!modal) return;
      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');
      var statusEl = document.getElementById('authModalStatus');
      if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'auth-modal-status';
      }
      var emailBtn = document.getElementById('authModalEmailBtn');
      if (emailBtn) {
        emailBtn.disabled = false;
        emailBtn.textContent = 'Send magic link';
      }
      var emailInput = document.getElementById('authModalEmailInput');
      if (emailInput) {
        emailInput.value = '';
        setTimeout(function () { emailInput.focus(); }, 50);
      }
    },

    closeAuthModal: function () {
      var modal = document.getElementById('authModal');
      if (!modal) return;
      modal.hidden = true;
      modal.setAttribute('aria-hidden', 'true');
    },

    onAuthChange: function (fn) {
      this._listeners.push(fn);
    },

    _notify: function () {
      var user = this._user;
      for (var i = 0; i < this._listeners.length; i++) {
        try { this._listeners[i](user); } catch (_) {}
      }
      document.dispatchEvent(new CustomEvent('bulletauth:change', {
        detail: { user: user, email: this.getEmail() },
      }));
    },

    _updateNavBtn: function () {
      var btn = document.getElementById('navAuthBtn');
      if (!btn) return;
      if (this._user) {
        var email = this.getEmail();
        btn.textContent = email;
        btn.dataset.state = 'signed-in';
        btn.setAttribute('aria-label', 'Signed in as ' + email + '. Click to sign out.');
        btn.title = 'Sign out';
      } else {
        btn.textContent = 'Sign In';
        btn.dataset.state = 'signed-out';
        btn.setAttribute('aria-label', 'Sign in to BulletAI');
        btn.title = '';
      }
    },
  };

  window.BulletAuth = BulletAuth;

  /* ── Modal injection (non-builder pages only) ── */
  function injectModal() {
    if (document.getElementById('authModal')) return false;
    document.body.insertAdjacentHTML('beforeend', MODAL_HTML);
    return true;
  }

  /* ── Modal form bindings (only when auth.js owns the modal) ── */
  function bindModalForm(client) {
    var emailInput = document.getElementById('authModalEmailInput');
    var emailBtn = document.getElementById('authModalEmailBtn');
    var statusEl = document.getElementById('authModalStatus');
    var googleBtn = document.getElementById('authModalGoogleBtn');

    if (emailInput && emailBtn) {
      emailInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') emailBtn.click();
      });

      emailBtn.addEventListener('click', async function () {
        var email = normalizeEmail(emailInput.value || '');
        if (!email || !email.includes('@')) {
          if (statusEl) statusEl.textContent = 'Please enter a valid email address.';
          return;
        }
        emailBtn.disabled = true;
        if (statusEl) {
          statusEl.textContent = 'Sending\u2026';
          statusEl.className = 'auth-modal-status';
        }
        try {
          await client.auth.signInWithOtp({
            email: email,
            options: { emailRedirectTo: window.location.origin + window.location.pathname },
          });
          emailBtn.textContent = 'Link sent \u2713';
          if (statusEl) {
            statusEl.textContent = 'Check your email for the sign-in link!';
            statusEl.className = 'auth-modal-status auth-modal-status--success';
          }
        } catch (_err) {
          if (statusEl) statusEl.textContent = 'Something went wrong. Please try again.';
          emailBtn.disabled = false;
        }
      });
    }

    if (googleBtn) {
      googleBtn.addEventListener('click', async function () {
        try {
          await client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname },
          });
        } catch (err) {
          var message = String((err && err.message) || '').toLowerCase();
          if (statusEl) {
            statusEl.className = 'auth-modal-status';
            statusEl.textContent = message.includes('provider is not enabled')
              ? 'Google sign-in is not enabled yet. Use email for now.'
              : 'Google sign-in failed. Please try again.';
          }
        }
      });
    }
  }

  /* ── Modal dismiss wiring (all pages — builder page already does this too,
        which is fine; duplicate listeners on close/overlay-click are harmless) ── */
  function setupModalDismiss() {
    // Close button — only bind from auth.js on non-builder pages to avoid
    // double-binding. Builder's initAuthModal() also binds this.
    if (!isBuilderPage()) {
      var closeBtn = document.getElementById('authModalClose');
      if (closeBtn) {
        closeBtn.addEventListener('click', function () { BulletAuth.closeAuthModal(); });
      }
      var overlay = document.getElementById('authModal');
      if (overlay) {
        overlay.addEventListener('click', function (e) {
          if (e.target === e.currentTarget) BulletAuth.closeAuthModal();
        });
      }
      document.addEventListener('keydown', function (e) {
        var modal = document.getElementById('authModal');
        if (e.key === 'Escape' && modal && !modal.hidden) BulletAuth.closeAuthModal();
      });
    }
  }

  /* ── Nav auth button click handler ── */
  function setupNavBtn() {
    var btn = document.getElementById('navAuthBtn');
    if (!btn) return;
    btn.addEventListener('click', async function () {
      if (BulletAuth.isSignedIn()) {
        await BulletAuth.signOut();
      } else {
        BulletAuth.openAuthModal();
      }
    });
  }

  /* ── Supabase initialisation ── */
  async function initSupabase(ownsModal) {
    try {
      if (!window.supabase || !window.supabase.createClient) return;

      var resp = await fetch('/api/public-auth-config');
      if (!resp.ok) return;
      var config = await resp.json();

      var supabaseUrl = (config && config.supabaseUrl) || '';
      var supabaseKey = (config && config.supabasePublishableKey) || '';
      if (!supabaseUrl || !supabaseKey) return;

      if (window.__bulletSupabaseClient) {
        BulletAuth._supabase = window.__bulletSupabaseClient;
      } else {
        BulletAuth._supabase = window.supabase.createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        });
        window.__bulletSupabaseClient = BulletAuth._supabase;
      }

      var sessionResult = await BulletAuth._supabase.auth.getSession();
      BulletAuth._user = (sessionResult.data && sessionResult.data.session && sessionResult.data.session.user) || null;
      BulletAuth._updateNavBtn();

      if (BulletAuth._user) {
        await syncUserWithDatabase(BulletAuth._user);
      }

      if (ownsModal) {
        bindModalForm(BulletAuth._supabase);
      }

      BulletAuth._supabase.auth.onAuthStateChange(async function (event, session) {
        console.log('Auth event:', event);
        BulletAuth._user = (session && session.user) || null;

        if (session && session.user) {
          console.log('User detected:', session.user.id);
          await syncUserWithDatabase(session.user);
        }

        if (event === 'SIGNED_OUT') {
          console.log('User signed out');
          await updateUserLogoutState();
          previousSyncedUserId = null;
        }

        if (session && session.user && previousSyncedUserId && previousSyncedUserId !== session.user.id) {
          await updateUserLogoutState(previousSyncedUserId);
        }

        BulletAuth._updateNavBtn();
        BulletAuth._notify();
        if (!BulletAuth._user) BulletAuth.closeAuthModal();
      });
    } catch (e) {
      console.error('Unexpected error:', e);
    }
  }

  /* ── Bootstrap ── */
  function run() {
    var onBuilder = isBuilderPage();
    var ownsModal = !onBuilder && injectModal();
    setupModalDismiss();
    setupNavBtn();
    initSupabase(ownsModal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
