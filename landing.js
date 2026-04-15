(function () {
  const resumeInput = document.getElementById("resumeInput");
  const generateBtn = document.getElementById("generateBtn");
  const pricingButtons = document.querySelectorAll(".btn-pricing");

  // Handle Generate Bullets button
  if (generateBtn && resumeInput) {
    generateBtn.addEventListener("click", function () {
      const text = resumeInput.value.trim();
      if (text) {
        // Store the resume text and redirect to the builder
        try {
          sessionStorage.setItem("pendingResumeText", text);
        } catch (e) {
          // Ignore storage errors
        }
        window.location.href = "/resume-template-builder";
      }
    });

    // Enable/disable button based on input
    resumeInput.addEventListener("input", function () {
      generateBtn.disabled = !resumeInput.value.trim();
    });

    // Initial state
    generateBtn.disabled = !resumeInput.value.trim();
  }

  // Handle Pricing button clicks - redirect to Stripe checkout
  pricingButtons.forEach(function (btn) {
    btn.addEventListener("click", async function () {
      const productId = btn.getAttribute("data-product");
      if (!productId) return;

      btn.disabled = true;
      btn.textContent = "Redirecting...";

      try {
        const response = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId }),
        });

        const data = await response.json().catch(function () {
          return {};
        });

        if (!response.ok || !data.url) {
          throw new Error(data.error || "Unable to start checkout.");
        }

        window.location.href = data.url;
      } catch (error) {
        console.error("Checkout error:", error);
        btn.disabled = false;
        btn.textContent = "Get Started";
        alert("Unable to start checkout. Please try again.");
      }
    });
  });

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
    anchor.addEventListener("click", function (e) {
      const href = this.getAttribute("href");
      if (href === "#") return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
})();
