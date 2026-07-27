"use strict";

(function () {
  const selector = 'button:not(:disabled), a.btn, [role="button"]';
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (reduced) return;

  document.addEventListener("pointerdown", function (event) {
    const target = event.target.closest(selector);
    if (!target || target.getAttribute("aria-disabled") === "true") return;
    target.classList.remove("is-tap");
    requestAnimationFrame(function () {
      target.classList.add("is-tap");
    });
    window.setTimeout(function () {
      target.classList.remove("is-tap");
    }, 280);
  }, { passive: true });
})();
