/* VidClaw — Canvas Particle System */

(function () {
  'use strict';

  const COLORS = ['#7C3AED', '#2563EB', '#06B6D4'];
  const DESKTOP_COUNT = 120;
  const MOBILE_COUNT = 60;
  const CONNECT_DIST = 120;
  const REPEL_RADIUS = 100;
  const REPEL_STRENGTH = 0.5;

  let canvas, ctx, particles, animId, mouse;
  const isMobile = () => window.innerWidth <= 768;

  function init() {
    canvas = document.getElementById('particles-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    mouse = { x: -9999, y: -9999 };
    particles = [];

    resize();
    createParticles();
    bindEvents();
    animate();
  }

  function resize() {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }

  function createParticles() {
    particles = [];
    const count = isMobile() ? MOBILE_COUNT : DESKTOP_COUNT;
    for (let i = 0; i < count; i++) {
      particles.push(makeParticle());
    }
  }

  function makeParticle() {
    const speed = 0.2 + Math.random() * 0.3;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: 1.2 + Math.random() * 1.8,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      alpha: 0.4 + Math.random() * 0.4,
    };
  }

  function update() {
    const mobile = isMobile();
    for (const p of particles) {
      // Normal movement
      p.x += p.vx;
      p.y += p.vy;

      // Repel from mouse (desktop only)
      if (!mobile) {
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPEL_RADIUS && dist > 0) {
          const force = (REPEL_RADIUS - dist) / REPEL_RADIUS;
          p.vx += (dx / dist) * force * REPEL_STRENGTH * 0.05;
          p.vy += (dy / dist) * force * REPEL_STRENGTH * 0.05;
        }
      }

      // Speed cap
      const spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > 1.2) {
        p.vx *= 0.98;
        p.vy *= 0.98;
      }

      // Wrap edges
      if (p.x < 0) p.x += canvas.width;
      if (p.x > canvas.width) p.x -= canvas.width;
      if (p.y < 0) p.y += canvas.height;
      if (p.y > canvas.height) p.y -= canvas.height;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i];
        const b = particles[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          const alpha = (1 - dist / CONNECT_DIST) * 0.25;
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.strokeStyle = a.color;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Draw particles
    for (const p of particles) {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 8;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function animate() {
    update();
    draw();
    animId = requestAnimationFrame(animate);
  }

  function bindEvents() {
    // Mouse move (desktop only)
    window.addEventListener('mousemove', (e) => {
      if (isMobile()) return;
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });

    // Resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        createParticles();
      }, 150);
    }, { passive: true });
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
