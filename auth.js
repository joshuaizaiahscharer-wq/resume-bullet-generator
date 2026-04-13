/**
 * auth.js — Universal BulletAI auth module (Replit Auth)
 *
 * Loaded on every page. Exposes window.BulletAuth, manages the #navAuthBtn
 * in every nav, and (where applicable) handles sign-in prompts by redirecting
 * to /api/login.
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

  /* ── Core auth object ── */
  var BulletAuth = {
    _user: null,
    _listeners: [],

    isSignedIn: function () {
      return Boolean(this._user);
    },

    getEmail: function () {
      return (this._user && (this._user.email || '')) || '';
    },

    getUser: function () {
      return this._user;
    },

    signOut: function () {
      window.location.href = '/api/logout';
    },

    openAuthModal: function () {
      window.location.href = '/api/login';
    },

    closeAuthModal: function () {
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
        btn.textContent = 'Sign Out';
        btn.dataset.state = 'signed-in';
        btn.setAttribute('aria-label', 'Signed in' + (email ? ' as ' + email : '') + '. Click to sign out.');
        btn.title = 'Sign out';
        btn.href = '/api/logout';
      } else {
        btn.textContent = 'Sign In';
        btn.dataset.state = 'signed-out';
        btn.setAttribute('aria-label', 'Sign in to BulletAI');
        btn.title = '';
        btn.href = '/api/login';
      }
    },
  };

  window.BulletAuth = BulletAuth;

  /* ── Nav auth button click handler ── */
  function setupNavBtn() {
    if (window.__bulletNavBtnBound) return;
    window.__bulletNavBtnBound = true;

    document.addEventListener('click', function (event) {
      var target = event.target;
      if (!target || !target.closest) return;
      var btn = target.closest('#navAuthBtn');
      if (!btn) return;

      event.preventDefault();
      if (BulletAuth.isSignedIn()) {
        BulletAuth.signOut();
      } else {
        window.location.href = '/api/login';
      }
    });
  }

  /* ── Fetch auth state from server ── */
  async function initAuth() {
    try {
      var resp = await fetch('/api/auth/user', { credentials: 'include' });
      if (resp.ok) {
        var data = await resp.json();
        BulletAuth._user = data || null;
      } else {
        BulletAuth._user = null;
      }
    } catch (_err) {
      BulletAuth._user = null;
    }

    BulletAuth._updateNavBtn();
    BulletAuth._notify();
  }

  /* ── Bootstrap ── */
  function run() {
    setupNavBtn();
    initAuth();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
