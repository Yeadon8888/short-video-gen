/* VidClaw — IntersectionObserver scroll animations */

(function () {
  'use strict';

  function initScrollAnimations() {
    // Reduced motion check
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targets = document.querySelectorAll('.fade-up, .scale-in, .slide-right');

    if (prefersReduced) {
      // Instantly show all
      targets.forEach(el => el.classList.add('animate-in'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const el = entry.target;
            // Honor data-delay for staggered children
            const delay = el.dataset.delay ? parseInt(el.dataset.delay) : 0;
            setTimeout(() => {
              el.classList.add('animate-in');
            }, delay);
            observer.unobserve(el);
          }
        });
      },
      {
        threshold: 0.15,
        rootMargin: '0px 0px -40px 0px',
      }
    );

    targets.forEach(el => observer.observe(el));

    // Connector lines use a separate observer (threshold 0.5)
    const connectors = document.querySelectorAll('.workflow__connector-line');
    const connectorObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('animate-in');
            connectorObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.5 }
    );

    connectors.forEach(el => connectorObserver.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollAnimations);
  } else {
    initScrollAnimations();
  }
})();
