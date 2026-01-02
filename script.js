// script.js
(function () {
  // -----------------------
  // Sound players
  // -----------------------
  // Put these files in /sounds next to index.html:
  // - click.mp3
  // - click_close.mp3
  // - click_link.mp3
  // - click_copy.mp3
  // - click_download.mp3
  // - click_toggle.mp3   <-- new toggle sound
  //
  // Put these images in /textures:
  // - sounds_switch_on.png
  // - sounds_switch_off.png

  const soundFiles = {
    click: 'sounds/click.mp3',
    close: 'sounds/click_close.mp3',
    link:  'sounds/click_link.mp3',
    copy:  'sounds/click_copy.mp3',
    download: 'sounds/click_download.mp3',
    toggle: 'sounds/click_toggle.mp3' // toggle sound (always played on mute/unmute)
  };

  // preload base Audio objects
  const sounds = {};
  Object.keys(soundFiles).forEach(k => {
    try {
      const a = new Audio(soundFiles[k]);
      a.preload = 'auto';
      sounds[k] = a;
    } catch (e) {
      sounds[k] = null;
    }
  });

  // persisted sound enabled flag (default true)
  let soundEnabled = localStorage.getItem('pp_sounds_enabled') !== 'false';

  function setSoundEnabled(enabled) {
    soundEnabled = !!enabled;
    try {
      localStorage.setItem('pp_sounds_enabled', soundEnabled ? 'true' : 'false');
    } catch (e) { /* ignore storage errors */ }
    if (!soundEnabled) {
      // stop/reset base audio nodes (do not worry about toggle here; we'll play toggle after)
      Object.keys(sounds).forEach(key => {
        try {
          const a = sounds[key];
          if (a && !a.paused) {
            a.pause();
            a.currentTime = 0;
          }
        } catch (e) {}
      });
    }
    updateSoundToggleUI();
  }

  // Helper: play sound by key (respects soundEnabled)
  function playSound(key) {
    if (!soundEnabled) return;
    const base = sounds[key];
    if (!base) return;
    try {
      base.currentTime = 0;
      const p = base.play();
      if (p && p.catch) {
        p.catch(() => {
          try {
            const clone = base.cloneNode();
            clone.play().catch(() => {});
          } catch (e) {}
        });
      }
    } catch (err) {
      try {
        const a = new Audio(soundFiles[key]);
        a.play().catch(() => {});
      } catch (e) {}
    }
  }

  // Play toggle sound regardless of soundEnabled (we want audible feedback even when muting)
  function playToggleSound() {
    const base = sounds.toggle;
    if (!base) return;
    try {
      base.currentTime = 0;
      const p = base.play();
      if (p && p.catch) {
        p.catch(() => {
          try {
            const clone = base.cloneNode();
            clone.play().catch(() => {});
          } catch (e) {}
        });
      }
    } catch (err) {
      try {
        const a = new Audio(soundFiles.toggle);
        a.play().catch(() => {});
      } catch (e) {}
    }
  }

  function playClick() { playSound('click'); }
  function playClose() { playSound('close'); }
  function playLink() { playSound('link'); }
  function playCopy() { playSound('copy'); }
  function playDownload() { playSound('download'); }

  // -----------------------
  // Sound toggle UI helpers
  // -----------------------
  const SWITCH_ON = 'textures/sounds_switch_on.png';
  const SWITCH_OFF = 'textures/sounds_switch_off.png';
  function updateSoundToggleUI() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const img = btn.querySelector('img');
    if (soundEnabled) {
      btn.classList.remove('muted');
      btn.setAttribute('aria-pressed', 'false');
      btn.title = 'Sounds: ON — click to mute';
      if (img) img.src = SWITCH_ON;
    } else {
      btn.classList.add('muted');
      btn.setAttribute('aria-pressed', 'true');
      btn.title = 'Sounds: OFF — click to unmute';
      if (img) img.src = SWITCH_OFF;
    }
  }

  function wireSoundToggleButton() {
    const btn = document.getElementById('sound-toggle');
    if (!btn) return;
    const img = btn.querySelector('img');
    if (img) img.draggable = false;

    btn.addEventListener('click', (ev) => {
      ev.preventDefault();
      const newState = !soundEnabled;
      setSoundEnabled(newState);
      // play toggle sound regardless of whether we've enabled or disabled
      playToggleSound();
    });
    updateSoundToggleUI();
  }

  // -----------------------
  // Main app (preserves user's original code + wiring)
  // -----------------------
  document.addEventListener('DOMContentLoaded', () => {
    wireSoundToggleButton();

    // play link sound for links opening in new tabs
    document.addEventListener('click', (ev) => {
      const a = ev.target.closest('a[target="_blank"]');
      if (a) {
        playLink();
      }
    }, { capture: true });

    // username copy-to-clipboard + cooldown (plays copy sound on success)
    document.addEventListener('click', (ev) => {
      const el = ev.target.closest('.username');
      if (!el) return;

      ev.stopPropagation();

      if (el.dataset.cooldown === 'true') return;

      const originalText = el.dataset.originalText || el.innerText.trim();
      if (!originalText) return;

      el.dataset.originalText = originalText;

      navigator.clipboard.writeText(originalText).then(() => {
        playCopy();

        el.dataset.cooldown = 'true';
        el.innerText = 'Copied';
        el.classList.add('copied');

        setTimeout(() => {
          el.innerText = el.dataset.originalText;
          el.classList.remove('copied');
          el.dataset.cooldown = 'false';
        }, 1000);
      }).catch(err => {
        console.error('Copy failed:', err);
      });
    });

    const MAX_WINDOWS_INCLUDING_MAIN = 5;
    let zIndexCounter = 10;
    const openTypes = new Set();

    let imageModalOpen = false;
    let recipeModalEl = null;
    let recipeContentEl = null;
    let recipeDownloadBlob = null;

    function escapeHtml(str) {
      return String(str).replace(/[&<>"']/g, c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[c]));
    }

    /* small markdown renderer */
    function renderMarkdown(md) {
      const lines = md.replace(/\r\n/g, '\n').split('\n');
      let html = '';
      let inCode = false;
      let inList = false;

      const closeList = () => {
        if (inList) {
          html += '</ul>';
          inList = false;
        }
      };

      const inline = (s) => {
        s = escapeHtml(s);
        s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
        s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
        s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
          (_, t, u) => `<a class="is-link" href="${escapeHtml(u)}" target="_blank">${t}</a>`
        );
        return s;
      };

      for (const line of lines) {
        if (line.trim().startsWith('```')) {
          if (!inCode) {
            inCode = true;
            html += '<pre><code>';
          } else {
            inCode = false;
            html += '</code></pre>';
          }
          continue;
        }

        if (inCode) {
          html += escapeHtml(line) + '\n';
          continue;
        }

        const h = line.match(/^(#{1,6})\s+(.*)$/);
        if (h) {
          closeList();
          html += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`;
          continue;
        }

        const li = line.match(/^\s*[-*]\s+(.*)$/);
        if (li) {
          if (!inList) {
            inList = true;
            html += '<ul>';
          }
          html += `<li>${inline(li[1])}</li>`;
          continue;
        }

        if (line.trim() === '') {
          closeList();
          html += '<br>';
          continue;
        }

        closeList();
        html += `<p>${inline(line)}</p>`;
      }

      closeList();
      if (inCode) html += '</code></pre>';

      return html;
    }

    function createRecipeModalIfNeeded() {
      if (recipeModalEl) return recipeModalEl;

      const overlay = document.createElement('div');
      overlay.className = 'pp-modal-overlay';
      overlay.style.display = 'none';
      overlay.style.zIndex = String(zIndexCounter + 1000);

      const inner = document.createElement('div');
      inner.className = 'pp-recipe-inner';
      inner.style.position = 'relative';
      inner.style.maxWidth = '900px';
      inner.style.maxHeight = '85vh';
      inner.style.display = 'flex';
      inner.style.flexDirection = 'column';

      /* close button */
      const closeBtn = document.createElement('button');
      closeBtn.className = 'pp-recipe-close-btn';
      const closeImg = document.createElement('img');
      closeImg.src = 'textures/close.png';
      closeImg.draggable = false;
      closeBtn.appendChild(closeImg);

      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeRecipeModal(); // plays close sound in closeRecipeModal
      });

      /* content */
      const content = document.createElement('div');
      content.className = 'pp-recipe-content';
      content.style.flex = '1';
      content.style.overflow = 'auto';
      content.style.padding = '22px';
      content.style.color = 'var(--text)';
      content.style.fontFamily = 'Micro 5, sans-serif';
      content.style.fontSize = '26px';
      recipeContentEl = content;

      /* download button (bottom) */
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'pp-recipe-download-btn';
      const downloadImg = document.createElement('img');
      downloadImg.src = 'textures/download.png';
      downloadImg.draggable = false;
      downloadBtn.appendChild(downloadImg);

      downloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!recipeDownloadBlob) return;

        // play the download sound
        playDownload();

        const url = URL.createObjectURL(recipeDownloadBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'recipe.md';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });

      inner.appendChild(closeBtn);
      inner.appendChild(content);
      inner.appendChild(downloadBtn);
      overlay.appendChild(inner);

      inner.addEventListener('click', e => e.stopPropagation());
      overlay.addEventListener('click', e => e.stopPropagation());

      /* escape key */
      window.addEventListener('keydown', (e) => {
        if (!imageModalOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeRecipeModal();
        }
      });

      document.body.appendChild(overlay);
      recipeModalEl = overlay;
      return overlay;
    }

    function openRecipeModal(path = '/recipe.md') {
      if (imageModalOpen) return;

      const modal = createRecipeModalIfNeeded();
      modal.style.display = 'flex';
      modal.style.zIndex = String(zIndexCounter + 1000);

      imageModalOpen = true;
      document.body.classList.add('pp-modal-open');
      windows.forEach(w => w.dataset.modalOpen = 'true');

      fetch(path, { cache: 'no-cache' })
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.text();
        })
        .then(text => {
          recipeDownloadBlob = new Blob([text], { type: 'text/markdown' });
          recipeContentEl.innerHTML = renderMarkdown(text);
        })
        .catch(err => {
          recipeContentEl.innerHTML =
            `<p><strong>Failed to load recipe.md</strong></p><pre>${escapeHtml(err)}</pre>`;
          recipeDownloadBlob = null;
        });
    }

    function closeRecipeModal() {
      // play close sound for recipe close
      playClose();

      if (!recipeModalEl) return;
      recipeModalEl.style.display = 'none';
      imageModalOpen = false;
      document.body.classList.remove('pp-modal-open');
      windows.forEach(w => delete w.dataset.modalOpen);
      recipeContentEl.innerHTML = '';
      recipeDownloadBlob = null;
    }

    document.querySelectorAll('.main-window-description').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        // play click for "view recipe" action
        playClick();
        openRecipeModal('/recipe.md');
      });
    });

    const PROJECT_IMAGES = [
        { src: 'textures/projects/project_1.png', name: 'expanded v2' },
        { src: 'textures/projects/project_2.png', name: 'mossy tools' },
        { src: 'textures/projects/project_3.png', name: 'just discs' },
        { src: 'textures/projects/project_4.png', name: 'just icons' },
        { src: 'textures/projects/project_5.png', name: 'just crates v2' }
    ];

    let currentImageIndex = -1;

    const mainWindow = document.querySelector('.main-window');
    if (mainWindow) {
      mainWindow.style.zIndex = 1;
      if (!['absolute', 'fixed', 'relative'].includes(getComputedStyle(mainWindow).position)) {
        mainWindow.style.position = 'relative';
      }
    }

    const windows = Array.from(document.querySelectorAll('.window'));
    const dockProjects = document.querySelector('.projects-button');
    const dockLinks = document.querySelector('.links-button');
    const dockSupport = document.querySelector('.support-button');
    const dockDiscord = document.querySelector('.discord-button');
    const dockMCSkin = document.querySelector('.mc-skin-button');

    let modalOverlayEl = null;
    let modalImgEl = null;
    let prevArrowBtn = null;
    let nextArrowBtn = null;
    let closeBtnEl = null;

    function createImageModalIfNeeded() {
      if (modalOverlayEl) return modalOverlayEl;

      modalOverlayEl = document.createElement('div');
      modalOverlayEl.className = 'pp-modal-overlay';
      modalOverlayEl.style.zIndex = String(zIndexCounter + 1000);

      const inner = document.createElement('div');
      inner.className = 'pp-modal-inner';

      const img = document.createElement('img');
      img.className = 'pp-modal-img';
      img.alt = 'Opened image';
      img.draggable = false;
      modalImgEl = img;

      const closeBtn = document.createElement('button');
      closeBtn.className = 'pp-modal-close-btn';
      closeBtn.setAttribute('aria-label', 'Close image');
      const closeImg = document.createElement('img');
      closeImg.src = 'textures/close.png';
      closeImg.alt = 'Close';
      closeImg.draggable = false;
      closeBtn.appendChild(closeImg);
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        closeImageModal(); // closeImageModal will play close sound
      });
      closeBtnEl = closeBtn;

      const prevBtn = document.createElement('button');
      prevBtn.className = 'pp-modal-arrow pp-modal-prev';
      prevBtn.setAttribute('aria-label', 'Previous image');
      const prevImg = document.createElement('img');
      prevImg.src = 'textures/arrow_back.png';
      prevImg.alt = 'Prev';
      prevImg.draggable = false;
      prevBtn.appendChild(prevImg);
      prevBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // play click for prev
        playClick();
        showPrevImage();
      });
      prevArrowBtn = prevBtn;

      const nextBtn = document.createElement('button');
      nextBtn.className = 'pp-modal-arrow pp-modal-next';
      nextBtn.setAttribute('aria-label', 'Next image');
      const nextImg = document.createElement('img');
      nextImg.src = 'textures/arrow_next.png';
      nextImg.alt = 'Next';
      nextImg.draggable = false;
      nextBtn.appendChild(nextImg);
      nextBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        // play click for next
        playClick();
        showNextImage();
      });
      nextArrowBtn = nextBtn;

      inner.appendChild(img);
      inner.appendChild(closeBtn);

      inner.addEventListener('click', (ev) => ev.stopPropagation());

      modalOverlayEl.appendChild(prevBtn);
      modalOverlayEl.appendChild(inner);
      modalOverlayEl.appendChild(nextBtn);

      window.addEventListener('keydown', (ev) => {
        if (!imageModalOpen) return;
        if (ev.key === 'Escape' || ev.key === 'Esc') {
          ev.preventDefault();
          closeImageModal();
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          playClick();
          showPrevImage();
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          playClick();
          showNextImage();
        }
      });

      modalOverlayEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });

      document.body.appendChild(modalOverlayEl);
      modalOverlayEl.style.display = 'none';
      return modalOverlayEl;
    }

    function showImageByIndex(index) {
        if (!PROJECT_IMAGES.length) return;

        const len = PROJECT_IMAGES.length;
        const idx = ((index % len) + len) % len;
        currentImageIndex = idx;

        const modal = createImageModalIfNeeded();
        const img = modal.querySelector('img.pp-modal-img');

        img.src = PROJECT_IMAGES[idx].src;
        img.alt = PROJECT_IMAGES[idx].name;
    }

    function showPrevImage() {
      if (currentImageIndex === -1) return;
      showImageByIndex(currentImageIndex - 1);
    }

    function showNextImage() {
      if (currentImageIndex === -1) return;
      showImageByIndex(currentImageIndex + 1);
    }

    function openImageModal(imageSrc, altText = '') {
      const modal = createImageModalIfNeeded();
      const idx = PROJECT_IMAGES.findIndex(p => p.src === imageSrc);
      if (idx >= 0) {
        showImageByIndex(idx);
      } else {
        PROJECT_IMAGES.push(imageSrc);
        showImageByIndex(PROJECT_IMAGES.length - 1);
      }

      modal.style.zIndex = String(zIndexCounter + 1000);

      modal.style.display = 'flex';
      imageModalOpen = true;
      document.body.classList.add('pp-modal-open');

      windows.forEach(w => w.dataset.modalOpen = 'true');
    }

    function closeImageModal() {
      // play close sound
      playClose();

      if (!modalOverlayEl) return;
      modalOverlayEl.style.display = 'none';
      imageModalOpen = false;
      document.body.classList.remove('pp-modal-open');
      windows.forEach(w => delete w.dataset.modalOpen);
      currentImageIndex = -1;
    }

    function detectType(winEl, fallbackIndex) {
      const img = winEl.querySelector('.window-title img');
      let text = '';
      if (img) text = (img.alt || img.src || '').toLowerCase();
      if (text.includes('project')) return 'projects';
      if (text.includes('link')) return 'links';
      if (text.includes('mc skin')) return 'mc-skin';
      if (text.includes('support')) return 'support';
      if (text.includes('discord')) return 'discord';
      return `window-${fallbackIndex}`;
    }

    function getMainCenter() {
      if (mainWindow) {
        const rect = mainWindow.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 + window.scrollX,
          y: rect.top + rect.height / 2 + window.scrollY
        };
      }
      return {
        x: window.scrollX + window.innerWidth / 2,
        y: window.scrollY + window.innerHeight / 2
      };
    }

    function computeAndStoreOffset(winEl) {
      const winRect = winEl.getBoundingClientRect();
      const mainCenter = getMainCenter();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const winLeft = winRect.left + window.scrollX;
      const winTop = winRect.top + window.scrollY;
      const offsetXNorm = (winLeft - mainCenter.x) / vw;
      const offsetYNorm = (winTop - mainCenter.y) / vh;
      winEl.dataset.offsetX = String(offsetXNorm);
      winEl.dataset.offsetY = String(offsetYNorm);
    }

    function applyOffsetPosition(winEl) {
      const offsetXNorm = parseFloat(winEl.dataset.offsetX || '0');
      const offsetYNorm = parseFloat(winEl.dataset.offsetY || '0');
      const mainCenter = getMainCenter();
      const left = mainCenter.x + offsetXNorm * window.innerWidth;
      const top = mainCenter.y + offsetYNorm * window.innerHeight;
      winEl.style.left = `${Math.max(0, Math.min(left, window.scrollX + window.innerWidth - winEl.getBoundingClientRect().width))}px`;
      winEl.style.top = `${Math.max(0, Math.min(top, window.scrollY + window.innerHeight - winEl.getBoundingClientRect().height))}px`;
    }

    windows.forEach((win, idx) => {
      const type = detectType(win, idx);
      win.dataset.type = type;

      const rect = win.getBoundingClientRect();
      const computed = window.getComputedStyle(win);
      const marginLeft = parseFloat(computed.marginLeft) || 0;
      const marginTop = parseFloat(computed.marginTop) || 0;

      win.style.position = 'absolute';
      win.style.left = `${rect.left - marginLeft + window.scrollX}px`;
      win.style.top = `${rect.top - marginTop + window.scrollY}px`;
      win.style.margin = '0';
      win.style.zIndex = 0;

      computeAndStoreOffset(win);

      win.style.display = 'none';

      const closeBtn = win.querySelector('.close-button');
      if (closeBtn) {
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          // play close for close button
          playClose();
          closeWindow(type);
        });
      }
    });

    function getWindowByType(type) {
      return windows.find(w => w.dataset.type === type);
    }
    function countOpenWindows() {
      return 1 + openTypes.size;
    }
    function bringToFront(winEl) {
      if (!winEl) return;
      zIndexCounter += 1;
      winEl.style.zIndex = zIndexCounter;
    }

    function openWindow(type, triggerElementForFeedback = null) {
      const winEl = getWindowByType(type);
      if (!winEl) {
        console.warn('No window for type', type);
        return;
      }

      if (imageModalOpen) return;

      if (openTypes.has(type)) {
        bringToFront(winEl);
        return;
      }
      if (countOpenWindows() >= MAX_WINDOWS_INCLUDING_MAIN) {
        if (triggerElementForFeedback) {
          try {
            triggerElementForFeedback.animate([
              { transform: 'translateY(0)' },
              { transform: 'translateY(-6px)' },
              { transform: 'translateY(0)' }
            ], { duration: 220, easing: 'ease-out' });
          } catch (e) { /* ignore if animation fails */ }
        }
        console.warn('Max windows open (including main) — cannot open:', type);
        return;
      }
      // If opening the projects window, play click sound
      if (type === 'projects') {
        playClick();
      }

      winEl.style.display = 'block';
      winEl.dataset.open = 'true';
      openTypes.add(type);

      centerWindow(winEl);
      computeAndStoreOffset(winEl);
      bringToFront(winEl);
      makeDraggable(winEl);
    }

    function closeWindow(type) {
      playClose();

      const winEl = getWindowByType(type);
      if (!winEl) return;
      winEl.style.display = 'none';
      winEl.dataset.open = '';
      openTypes.delete(type);
    }

    function makeDraggable(winEl) {
      if (winEl.dataset.draggable === 'true') return;
      winEl.dataset.draggable = 'true';

      let isDragging = false;
      let startX = 0, startY = 0;
      let origLeft = 0, origTop = 0;

      function pointerDownHandler(ev) {
        if (imageModalOpen || winEl.dataset.modalOpen === 'true') {
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return;
        }
        if (ev.target.closest('.project-image-buttons') ||
            ev.target.closest('button') ||
            ev.target.closest('a') ||
            ev.target.closest('input') ||
            ev.target.closest('textarea') ||
            ev.target.closest('select')) {
          return;
        }

        if (ev.button && ev.button !== 0) return;
        if (ev.target.closest('.close-button')) return;
        if (ev.target.closest('.is-link')) return;
        if (ev.target.closest('.username')) return;
        if (getComputedStyle(winEl).display === 'none') return;
        ev.preventDefault();

        bringToFront(winEl);

        isDragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        const rect = winEl.getBoundingClientRect();
        origLeft = parseFloat(winEl.style.left) || rect.left + window.scrollX;
        origTop = parseFloat(winEl.style.top) || rect.top + window.scrollY;

        if (ev.pointerId !== undefined && winEl.setPointerCapture) {
          try { winEl.setPointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        }

        winEl.style.cursor = 'move';
        document.addEventListener('pointermove', pointerMoveHandler);
        document.addEventListener('pointerup', pointerUpHandler);
      }

      function pointerMoveHandler(ev) {
        if (!isDragging) return;
        ev.preventDefault();
        const dx = ev.clientX - startX;
        const dy = ev.clientY - startY;
        winEl.style.left = `${origLeft + dx}px`;
        winEl.style.top = `${origTop + dy}px`;
      }

      function pointerUpHandler(ev) {
        if (!isDragging) return;
        isDragging = false;
        winEl.style.cursor = 'pointer';
        if (ev.pointerId !== undefined && winEl.releasePointerCapture) {
          try { winEl.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        }
        document.removeEventListener('pointermove', pointerMoveHandler);
        document.removeEventListener('pointerup', pointerUpHandler);
        computeAndStoreOffset(winEl);
      }

      winEl.addEventListener('pointerdown', pointerDownHandler);

      winEl.style.cursor = 'pointer';
    }

    function wireDock(dockEl, type) {
      if (!dockEl) return;
      dockEl.addEventListener('click', (ev) => {
        ev.preventDefault();
        if (imageModalOpen) return;
        // play click for dock buttons
        playClick();
        openWindow(type, dockEl);
      });
    }

    function centerWindow(winEl) {
      const rect = winEl.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const left = (viewportWidth - rect.width) / 2 + window.scrollX;
      const top = (viewportHeight - rect.height) / 2 + window.scrollY;
      winEl.style.left = `${Math.max(0, left)}px`;
      winEl.style.top = `${Math.max(0, top)}px`;
    }

    wireDock(dockProjects, 'projects');
    wireDock(dockLinks, 'links');
    wireDock(dockSupport, 'support');
    wireDock(dockDiscord, 'discord');
    wireDock(dockMCSkin, 'mc-skin');
    windows.forEach(win => {
      win.addEventListener('click', (ev) => {
        if (getComputedStyle(win).display === 'none') return;
        if (ev.target.closest('.close-button')) return;
        if (ev.target.closest('.is-link')) return;
        if (ev.target.closest('.username')) return;
        bringToFront(win);
      });
    });
    window.addEventListener('resize', () => {
      windows.forEach(win => {
        if (typeof win.dataset.offsetX === 'undefined' || typeof win.dataset.offsetY === 'undefined') {
          computeAndStoreOffset(win);
        }
        applyOffsetPosition(win);
      });
      if (modalOverlayEl && modalOverlayEl.style.display !== 'none') {
        modalOverlayEl.style.zIndex = String(zIndexCounter + 1000);
      }
    });
    window.__pixelPortfolio = {
      openWindow,
      closeWindow,
      getOpenTypes: () => Array.from(openTypes),
      getZIndexCounter: () => zIndexCounter,
      openImageModal,
      closeImageModal
    };
    (function addProjectImageButtons() {
      const projectsWindow = windows.find(win => {
        const titleImg = win.querySelector('.window-title img');
        return titleImg && titleImg.src && titleImg.src.includes('title_projects');
      });

      if (!projectsWindow) {
        console.warn('Projects window not found');
        return;
      }
      const descriptionEl = projectsWindow.querySelector('.window-description');
      if (!descriptionEl) return;
      const btnContainer = document.createElement('div');
      btnContainer.className = 'project-image-buttons';
        PROJECT_IMAGES.forEach((project, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = project.name;

        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            // these buttons open images — play click
            playClick();
            openImageModal(project.src, project.name);
        });

        btnContainer.appendChild(btn);
        });


      descriptionEl.appendChild(btnContainer);
    })();

    // Additional safety: capture clicks on any close-like elements that weren't wired explicitly.
    document.addEventListener('click', (ev) => {
      const closeEl = ev.target.closest('.close-button, .pp-modal-close-btn, .pp-recipe-close-btn');
      if (closeEl) {
        playClose();
      }
    }, { capture: true });

  }); // DOMContentLoaded end

  // Ensure UI is initialised early in case DOMContentLoaded fired before this script loaded
  try { updateSoundToggleUI(); } catch (e) {}
})();
