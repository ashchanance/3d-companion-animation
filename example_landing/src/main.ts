// Custom Cursor
const cursorDot = document.getElementById("cursorDot");
const cursorRing = document.getElementById("cursorRing");
let mouseX = 0,
  mouseY = 0,
  ringX = 0,
  ringY = 0;

if (cursorDot && cursorRing) {
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursorDot.style.left = mouseX + "px";
    cursorDot.style.top = mouseY + "px";
  });

  function animateCursor() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    cursorRing!.style.left = ringX + "px";
    cursorRing!.style.top = ringY + "px";
    requestAnimationFrame(animateCursor);
  }
  animateCursor();

  document
    .querySelectorAll("a, button, .feature-card, .tech-chip")
    .forEach((el) => {
      el.addEventListener("mouseenter", () =>
        cursorRing!.classList.add("hovering"),
      );
      el.addEventListener("mouseleave", () =>
        cursorRing!.classList.remove("hovering"),
      );
    });
}

// Mobile Menu
const mobileMenuBtn = document.getElementById("mobileMenuBtn");
if (mobileMenuBtn) {
  mobileMenuBtn.addEventListener("click", () => {
    const navLinks = document.querySelector(".nav-links") as HTMLElement;
    if (navLinks) {
      navLinks.style.display =
        navLinks.style.display === "flex" ? "none" : "flex";
    }
  });
}

// Intersection Observer for scroll animations
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("animate");
        (entry.target as HTMLElement).style.animationDelay = `${index * 0.1}s`;
      }
    });
  },
  { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
);

document
  .querySelectorAll(".stat-item, .feature-card, .step")
  .forEach((el) => observer.observe(el));

// VRM initialization is handled by React component (`VRMAvatar`).
// Keep main entry free from global avatar bootstrapping to avoid duplicate renderers/conflicts.
