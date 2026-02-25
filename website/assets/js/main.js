/* VidClaw — Navigation, mobile menu, smooth scroll */

(function () {
  'use strict';

  // ── Nav scroll effect ──
  function initNav() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    function onScroll() {
      if (window.scrollY > 80) {
        nav.classList.add('scrolled');
      } else {
        nav.classList.remove('scrolled');
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll(); // initial check
  }

  // ── Mobile hamburger menu ──
  function initMobileMenu() {
    const hamburger = document.querySelector('.nav__hamburger');
    const mobileNav = document.querySelector('.nav__mobile');
    const closeBtn = document.querySelector('.nav__mobile-close');
    const mobileLinks = document.querySelectorAll('.nav__mobile .nav__link');

    if (!hamburger || !mobileNav) return;

    function openMenu() {
      mobileNav.classList.add('open');
      document.body.style.overflow = 'hidden';
      hamburger.setAttribute('aria-expanded', 'true');
    }

    function closeMenu() {
      mobileNav.classList.remove('open');
      document.body.style.overflow = '';
      hamburger.setAttribute('aria-expanded', 'false');
    }

    hamburger.addEventListener('click', openMenu);
    if (closeBtn) closeBtn.addEventListener('click', closeMenu);

    // Close on link click
    mobileLinks.forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        closeMenu();
      }
    });
  }

  // ── Smooth anchor scroll ──
  function initAnchorScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        const href = anchor.getAttribute('href');
        if (href === '#') return;

        const target = document.querySelector(href);
        if (!target) return;

        e.preventDefault();

        const navHeight = document.querySelector('.nav')?.offsetHeight || 70;
        const top = target.getBoundingClientRect().top + window.scrollY - navHeight - 16;

        window.scrollTo({
          top: Math.max(0, top),
          behavior: 'smooth',
        });
      });
    });
  }

  // ── Active nav link highlight ──
  function initActiveNav() {
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav__link[href^="#"]');

    if (!sections.length || !navLinks.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = entry.target.id;
            navLinks.forEach(link => {
              link.classList.toggle(
                'nav__link--active',
                link.getAttribute('href') === '#' + id
              );
            });
          }
        });
      },
      {
        threshold: 0.4,
        rootMargin: '-80px 0px 0px 0px',
      }
    );

    sections.forEach(s => observer.observe(s));
  }

  // ── QR Modal (global so inline onclick works) ──
  window.openQrModal = function () {
    const modal = document.getElementById('qr-modal');
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeQrModal = function () {
    const modal = document.getElementById('qr-modal');
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  };

  function initQrModal() {
    const backdrop = document.getElementById('qr-modal-backdrop');
    const closeBtn = document.getElementById('qr-modal-close');
    if (backdrop) backdrop.addEventListener('click', window.closeQrModal);
    if (closeBtn) closeBtn.addEventListener('click', window.closeQrModal);
  }

  // Close QR modal on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeQrModal && window.closeQrModal();
    }
  });

  // ── Init ──
  function init() {
    initNav();
    initMobileMenu();
    initAnchorScroll();
    initActiveNav();
    initQrModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
