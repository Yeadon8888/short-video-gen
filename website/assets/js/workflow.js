/* VidClaw — Workflow terminal typewriter animation */

(function () {
  'use strict';

  // Terminal log lines (6 stages matching generate.py output)
  const LOG_LINES = [
    { text: '$ python3 scripts/generate.py --url "https://v.douyin.com/xxx/" --images ./product --count 3', cls: 'terminal__text--muted', delay: 0 },
    { text: '[1/6] 解析链接...', cls: 'terminal__text--blue', delay: 600 },
    { text: '  ✓ TikHub 解析成功 → aweme_id: 7380123456789', cls: 'terminal__text--green', delay: 1000 },
    { text: '  ✓ 无水印视频下载完成 (18.4 MB)', cls: 'terminal__text--green', delay: 1400 },
    { text: '[2/6] Gemini 分析视频中...', cls: 'terminal__text--blue', delay: 1900 },
    { text: '  → 模型: gemini-3-pro-preview', cls: 'terminal__text--muted', delay: 2200 },
    { text: '  ✓ 视频分析完成，生成 Sora prompt', cls: 'terminal__text--green', delay: 4200 },
    { text: '[3/6] 上传产品图至 R2...', cls: 'terminal__text--blue', delay: 4700 },
    { text: '  ✓ product_01.jpg → r2.example.com/abc123.jpg (cached)', cls: 'terminal__text--green', delay: 5100 },
    { text: '[4/6] 生成中文文案...', cls: 'terminal__text--blue', delay: 5500 },
    { text: '  ✓ 标题/文案/首评 JSON 生成完成', cls: 'terminal__text--green', delay: 6200 },
    { text: '[5/6] 提交 Sora 生成任务 (×3)...', cls: 'terminal__text--blue', delay: 6800 },
    { text: '  → task_id: sora_7a3f9b2c  [1/3]', cls: 'terminal__text--cyan', delay: 7200 },
    { text: '  → task_id: sora_8d1e4c5a  [2/3]', cls: 'terminal__text--cyan', delay: 7500 },
    { text: '  → task_id: sora_2f6a0b8d  [3/3]', cls: 'terminal__text--cyan', delay: 7800 },
    { text: '[6/6] 轮询结果 (每 30s)...', cls: 'terminal__text--blue', delay: 8200 },
    { text: '  ⏳ [30s] sora_7a3f9b2c: processing...', cls: 'terminal__text--yellow', delay: 8700 },
    { text: '  ⏳ [60s] sora_7a3f9b2c: processing...', cls: 'terminal__text--yellow', delay: 9200 },
    { text: '  ✓ sora_7a3f9b2c → https://cdn.example.com/v/7a3f9b2c.mp4', cls: 'terminal__text--green', delay: 10000 },
    { text: '  ✓ sora_8d1e4c5a → https://cdn.example.com/v/8d1e4c5a.mp4', cls: 'terminal__text--green', delay: 10400 },
    { text: '  ✓ sora_2f6a0b8d → https://cdn.example.com/v/2f6a0b8d.mp4', cls: 'terminal__text--green', delay: 10800 },
    { text: '✅ 完成！耗时 3m 42s | 3 条视频已生成', cls: 'terminal__text--purple', delay: 11400 },
  ];

  let started = false;

  function buildLine(item) {
    const div = document.createElement('div');
    div.className = 'terminal__line';

    const isCommand = item.text.startsWith('$');
    if (isCommand) {
      const prompt = document.createElement('span');
      prompt.className = 'terminal__prompt';
      prompt.textContent = '';
      div.appendChild(prompt);
    }

    const text = document.createElement('span');
    text.className = item.cls;
    div.appendChild(text);

    return { div, textEl: text, raw: item.text };
  }

  function typewriterLine(textEl, text, speed, onDone) {
    let i = 0;
    function tick() {
      if (i < text.length) {
        textEl.textContent += text[i];
        i++;
        setTimeout(tick, speed + Math.random() * speed * 0.5);
      } else if (onDone) {
        onDone();
      }
    }
    tick();
  }

  function runTerminal() {
    if (started) return;
    started = true;

    const body = document.querySelector('.terminal__body');
    if (!body) return;

    // Remove cursor placeholder
    const cursor = body.querySelector('.terminal__cursor');

    LOG_LINES.forEach((item, idx) => {
      setTimeout(() => {
        const { div, textEl, raw } = buildLine(item);
        const isCommand = raw.startsWith('$');
        // Insert before cursor
        if (cursor) {
          body.insertBefore(div, cursor);
        } else {
          body.appendChild(div);
        }

        // Fade in
        requestAnimationFrame(() => div.classList.add('visible'));

        // Typewriter for command line, instant for logs
        const displayText = isCommand ? raw.replace(/^\$\s*/, '') : raw;
        if (isCommand) {
          typewriterLine(textEl, displayText, 18);
        } else {
          textEl.textContent = displayText;
        }

        // Auto-scroll terminal
        body.scrollTop = body.scrollHeight;

        // After last line, hide cursor
        if (idx === LOG_LINES.length - 1 && cursor) {
          setTimeout(() => { cursor.style.display = 'none'; }, 800);
        }
      }, item.delay);
    });
  }

  function initTerminal() {
    const terminal = document.querySelector('.workflow__terminal');
    if (!terminal) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced) {
      // Show all lines instantly
      const body = terminal.querySelector('.terminal__body');
      if (!body) return;
      const cursor = body.querySelector('.terminal__cursor');
      LOG_LINES.forEach(item => {
        const div = document.createElement('div');
        div.className = 'terminal__line visible';
        const span = document.createElement('span');
        span.className = item.cls;
        span.textContent = item.text;
        div.appendChild(span);
        if (cursor) body.insertBefore(div, cursor);
        else body.appendChild(div);
      });
      if (cursor) cursor.style.display = 'none';
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            runTerminal();
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.3 }
    );

    observer.observe(terminal);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTerminal);
  } else {
    initTerminal();
  }
})();
