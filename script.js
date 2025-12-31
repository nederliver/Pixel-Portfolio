// script.js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const MAX_WINDOWS_INCLUDING_MAIN = 4;
    let zIndexCounter = 10; // increasing stack value
    const openTypes = new Set();

    // -- Modal state flag (global within this closure) --
    let imageModalOpen = false;

    // central list of project images (shared so arrows can cycle)
    const PROJECT_IMAGES = [
        { src: 'textures/projects/project_1.png', name: 'expanded v2' },
        { src: 'textures/projects/project_2.png', name: 'mossy tools' },
        { src: 'textures/projects/project_3.png', name: 'just discs' },
        { src: 'textures/projects/project_4.png', name: 'just icons' },
        { src: 'textures/projects/project_5.png', name: 'just crates v2' }
    ];


    // track which index is currently shown in the modal (-1 = none)
    let currentImageIndex = -1;

    const mainWindow = document.querySelector('.main-window');
    if (mainWindow) {
      // make sure main stays below app windows
      mainWindow.style.zIndex = 1;
      // ensure it has positioning so we can measure it consistently
      if (!['absolute', 'fixed', 'relative'].includes(getComputedStyle(mainWindow).position)) {
        mainWindow.style.position = 'relative';
      }
    }

    const windows = Array.from(document.querySelectorAll('.window'));
    const dockProjects = document.querySelector('.projects-button');
    const dockLinks = document.querySelector('.links-button');
    const dockSupport = document.querySelector('.support-button');

    // ------------------------------------------------------------
    // -- Image modal creation & control (styles in style.css)
    // ------------------------------------------------------------
    let modalOverlayEl = null;
    // references to modal controls that'll be created once
    let modalImgEl = null;
    let prevArrowBtn = null;
    let nextArrowBtn = null;
    let closeBtnEl = null;

    function createImageModalIfNeeded() {
      if (modalOverlayEl) return modalOverlayEl;

      // create overlay
      modalOverlayEl = document.createElement('div');
      modalOverlayEl.className = 'pp-modal-overlay';
      // z-index still managed dynamically in JS so it remains above windows
      modalOverlayEl.style.zIndex = String(zIndexCounter + 1000);

      const inner = document.createElement('div');
      inner.className = 'pp-modal-inner';

      // image element
      const img = document.createElement('img');
      img.className = 'pp-modal-img';
      img.alt = 'Opened image';
      img.draggable = false;
      modalImgEl = img;

      // close button (top-right) using textures/close.png
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
        closeImageModal();
      });
      closeBtnEl = closeBtn;

      // previous arrow (left middle)
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
        showPrevImage();
      });
      prevArrowBtn = prevBtn;

      // next arrow (right middle)
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
        showNextImage();
      });
      nextArrowBtn = nextBtn;

      // assemble: image + close button inside inner
      inner.appendChild(img);
      inner.appendChild(closeBtn);

      // Prevent clicks inside the modal inner from bubbling to overlay
      inner.addEventListener('click', (ev) => ev.stopPropagation());

      // put prev arrow, inner, next arrow as children of overlay so arrows are at overlay's left/right middle
      modalOverlayEl.appendChild(prevBtn);
      modalOverlayEl.appendChild(inner);
      modalOverlayEl.appendChild(nextBtn);

      // allow closing with Escape and navigate with ArrowLeft/ArrowRight
      window.addEventListener('keydown', (ev) => {
        if (!imageModalOpen) return;
        if (ev.key === 'Escape' || ev.key === 'Esc') {
          ev.preventDefault();
          closeImageModal();
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          showPrevImage();
        } else if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          showNextImage();
        }
      });

      // Prevent overlay clicks from interacting with page. We DON'T close on overlay click.
      modalOverlayEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
      });

      document.body.appendChild(modalOverlayEl);
      // initially hidden
      modalOverlayEl.style.display = 'none';
      return modalOverlayEl;
    }

    // show a specific project image by index (wraps around)
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

    // open modal with given imageSrc (we find the index in PROJECT_IMAGES, fallback to first)
    function openImageModal(imageSrc, altText = '') {
      // create if missing
      const modal = createImageModalIfNeeded();
      // figure out index from PROJECT_IMAGES
      const idx = PROJECT_IMAGES.findIndex(p => p.src === imageSrc);
      if (idx >= 0) {
        showImageByIndex(idx);
      } else {
        // if unknown image, add temporarily at end and set index to that
        PROJECT_IMAGES.push(imageSrc);
        showImageByIndex(PROJECT_IMAGES.length - 1);
      }

      // set z-index relative to current zIndexCounter to ensure it's above any windows
      modal.style.zIndex = String(zIndexCounter + 1000);

      modal.style.display = 'flex';
      // register modal open state
      imageModalOpen = true;
      // set a body class for potential CSS hooks (disable scroll etc)
      document.body.classList.add('pp-modal-open');

      // mark windows as in modal-open state so their drag handlers won't start
      windows.forEach(w => w.dataset.modalOpen = 'true');
    }

    function closeImageModal() {
      if (!modalOverlayEl) return;
      modalOverlayEl.style.display = 'none';
      imageModalOpen = false;
      document.body.classList.remove('pp-modal-open');
      windows.forEach(w => delete w.dataset.modalOpen);
      currentImageIndex = -1;
    }

    // ------------------------------------------------------------
    // Utility: determine type string for a .window element
    // ------------------------------------------------------------
    function detectType(winEl, fallbackIndex) {
      const img = winEl.querySelector('.window-title img');
      let text = '';
      if (img) text = (img.alt || img.src || '').toLowerCase();
      if (text.includes('project')) return 'projects';
      if (text.includes('link')) return 'links';
      if (text.includes('support')) return 'support';
      // fallback: 'window-#'
      return `window-${fallbackIndex}`;
    }

    // Compute main window center (fallback to viewport center if no mainWindow)
    function getMainCenter() {
      if (mainWindow) {
        const rect = mainWindow.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2 + window.scrollX,
          y: rect.top + rect.height / 2 + window.scrollY
        };
      }
      // fallback: viewport center
      return {
        x: window.scrollX + window.innerWidth / 2,
        y: window.scrollY + window.innerHeight / 2
      };
    }

    // Store normalized offset from main center (fractions of viewport width/height)
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

    // Apply stored normalized offset to compute pixel left/top (maintains relative distance)
    function applyOffsetPosition(winEl) {
      const offsetXNorm = parseFloat(winEl.dataset.offsetX || '0');
      const offsetYNorm = parseFloat(winEl.dataset.offsetY || '0');
      const mainCenter = getMainCenter();
      const left = mainCenter.x + offsetXNorm * window.innerWidth;
      const top = mainCenter.y + offsetYNorm * window.innerHeight;
      // keep on-screen (simple clamp)
      winEl.style.left = `${Math.max(0, Math.min(left, window.scrollX + window.innerWidth - winEl.getBoundingClientRect().width))}px`;
      winEl.style.top = `${Math.max(0, Math.min(top, window.scrollY + window.innerHeight - winEl.getBoundingClientRect().height))}px`;
    }

    // Prepare windows: convert to absolute positioned, hide them initially.
    windows.forEach((win, idx) => {
      const type = detectType(win, idx);
      win.dataset.type = type;

      // compute current location so switching to absolute doesn't jump
      const rect = win.getBoundingClientRect();
      const computed = window.getComputedStyle(win);
      const marginLeft = parseFloat(computed.marginLeft) || 0;
      const marginTop = parseFloat(computed.marginTop) || 0;

      // set absolute position at the same place
      win.style.position = 'absolute';
      win.style.left = `${rect.left - marginLeft + window.scrollX}px`;
      win.style.top = `${rect.top - marginTop + window.scrollY}px`;
      win.style.margin = '0';
      win.style.zIndex = 0;

      // compute and store normalized offset (so resize will preserve relative distance)
      computeAndStoreOffset(win);

      // hide windows initially (main window is separate)
      win.style.display = 'none';

      // ensure close button exists
      const closeBtn = win.querySelector('.close-button');
      if (closeBtn) {
        // close on left-click
        closeBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          closeWindow(type);
        });
      }
    });

    // Helpers
    function getWindowByType(type) {
      return windows.find(w => w.dataset.type === type);
    }
    function countOpenWindows() {
      // include main window as 1
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

      // If the image modal is open, do not open additional windows
      if (imageModalOpen) return;

      // If already open: simply bring to front
      if (openTypes.has(type)) {
        bringToFront(winEl);
        return;
      }
      // Respect max windows rule
      if (countOpenWindows() >= MAX_WINDOWS_INCLUDING_MAIN) {
        // give quick feedback on the dock icon if provided
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
      // show & mark open
      winEl.style.display = 'block';
      winEl.dataset.open = 'true';
      openTypes.add(type);

      // center on screen initially, then compute offset to preserve during resize
      centerWindow(winEl);
      computeAndStoreOffset(winEl);
      bringToFront(winEl);
      makeDraggable(winEl);
    }

    function closeWindow(type) {
      const winEl = getWindowByType(type);
      if (!winEl) return;
      winEl.style.display = 'none';
      winEl.dataset.open = '';
      openTypes.delete(type);
    }

    // Dragging: when left-clicked anywhere in a window (except close button),
    // bring it to front and start dragging.
    function makeDraggable(winEl) {
      // avoid double-binding
      if (winEl.dataset.draggable === 'true') return;
      winEl.dataset.draggable = 'true';

      let isDragging = false;
      let startX = 0, startY = 0;
      let origLeft = 0, origTop = 0;

      function pointerDownHandler(ev) {
        // If modal open, prevent starting drag
        if (imageModalOpen || winEl.dataset.modalOpen === 'true') {
          // swallow event so nothing else receives it
          ev.preventDefault();
          ev.stopImmediatePropagation();
          return;
        }

        // If clicked on an interactive control (project buttons, links, buttons, inputs, etc.)
        // do NOT start a drag — allow the control click to proceed normally.
        if (ev.target.closest('.project-image-buttons') ||
            ev.target.closest('button') ||
            ev.target.closest('a') ||
            ev.target.closest('input') ||
            ev.target.closest('textarea') ||
            ev.target.closest('select')) {
          return;
        }

        // Only left-click / primary button
        if (ev.button && ev.button !== 0) return;
        // don't start drag if clicked on close button
        if (ev.target.closest('.close-button')) return;
        if (ev.target.closest('.is-link')) return;
        // only respond if window is visible
        if (getComputedStyle(winEl).display === 'none') return;
        ev.preventDefault();

        // bring to front
        bringToFront(winEl);

        isDragging = true;
        startX = ev.clientX;
        startY = ev.clientY;
        const rect = winEl.getBoundingClientRect();
        origLeft = parseFloat(winEl.style.left) || rect.left + window.scrollX;
        origTop = parseFloat(winEl.style.top) || rect.top + window.scrollY;

        // set pointer capture so we receive move/up reliably
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
        // release pointer capture if previously set
        if (ev.pointerId !== undefined && winEl.releasePointerCapture) {
          try { winEl.releasePointerCapture(ev.pointerId); } catch (e) { /* ignore */ }
        }
        document.removeEventListener('pointermove', pointerMoveHandler);
        document.removeEventListener('pointerup', pointerUpHandler);

        // Update normalized offset after a drag so resize will preserve the new distance
        computeAndStoreOffset(winEl);
      }

      // bring to front if clicked (left click) anywhere inside winEl
      winEl.addEventListener('pointerdown', pointerDownHandler);

      // nice cursor
      winEl.style.cursor = 'pointer';
    }

    // Wire dock icons: open windows on click
    function wireDock(dockEl, type) {
      if (!dockEl) return;
      dockEl.addEventListener('click', (ev) => {
        ev.preventDefault();
        // If modal open, ignore dock clicks
        if (imageModalOpen) return;
        openWindow(type, dockEl);
      });
    }

    function centerWindow(winEl) {
      // position center relative to viewport
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

    // Also: clicking on an already-open window (left-click) should bring it front.
    windows.forEach(win => {
      win.addEventListener('click', (ev) => {
        if (getComputedStyle(win).display === 'none') return;
        if (ev.target.closest('.close-button')) return;
        if (ev.target.closest('.is-link')) return;
        bringToFront(win);
      });
    });

    // On resize: reapply offsets to all windows (open and hidden)
    window.addEventListener('resize', () => {
      windows.forEach(win => {
        // If offsets exist apply them; if not, compute from current position
        if (typeof win.dataset.offsetX === 'undefined' || typeof win.dataset.offsetY === 'undefined') {
          computeAndStoreOffset(win);
        }
        applyOffsetPosition(win);
      });

      // also ensure modal overlay (if open) stays above all windows
      if (modalOverlayEl && modalOverlayEl.style.display !== 'none') {
        modalOverlayEl.style.zIndex = String(zIndexCounter + 1000);
      }
    });

    // Expose a tiny API for debugging (optional)
    window.__pixelPortfolio = {
      openWindow,
      closeWindow,
      getOpenTypes: () => Array.from(openTypes),
      getZIndexCounter: () => zIndexCounter,
      openImageModal, // useful for dev console
      closeImageModal
    };

    // ------------------------------------------------------------
    // -- Add image buttons INSIDE the Projects window
    // -- (button styling moved to CSS)
    // ------------------------------------------------------------
    (function addProjectImageButtons() {
      // Find the Projects window by its title image (title_projects.png)
      const projectsWindow = windows.find(win => {
        const titleImg = win.querySelector('.window-title img');
        return titleImg && titleImg.src && titleImg.src.includes('title_projects');
      });

      if (!projectsWindow) {
        console.warn('Projects window not found');
        return;
      }

      // Where buttons should go - append after the first .window-description node
      const descriptionEl = projectsWindow.querySelector('.window-description');
      if (!descriptionEl) return;

      // Container for buttons (styling moved to CSS: .project-image-buttons)
      const btnContainer = document.createElement('div');
      btnContainer.className = 'project-image-buttons';

      // use PROJECT_IMAGES array to keep indexing consistent
        PROJECT_IMAGES.forEach((project, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = project.name;

        btn.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            openImageModal(project.src, project.name);
        });

        btnContainer.appendChild(btn);
        });


      descriptionEl.appendChild(btnContainer);
    })();

    // ------------------------------------------------------------
    // End DOMContentLoaded
    // ------------------------------------------------------------
  });
})();
