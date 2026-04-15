(function () {
  "use strict";

  var GA_ID = "G-F702GZNWHB";

  if (typeof window === "undefined") return;
  if (window.__BULLETAI_GA_INIT__) return;
  window.__BULLETAI_GA_INIT__ = true;

  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;

  var script = document.createElement("script");
  script.async = true;
  script.src = "https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_ID);
  document.head.appendChild(script);

  gtag("js", new Date());
  gtag("config", GA_ID, {
    page_path: window.location.pathname,
  });
})();
