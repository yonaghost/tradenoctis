/**
 * Noctis translation runtime for the Android WebView. Same responsibilities
 * as web/public/noctis-inject.js (walk + translate text nodes, find and
 * translate images progressively, report progress, honor mode/scale
 * commands) but talking to the native NoctisBridge (ML Kit, on-device)
 * instead of fetch()ing a server API — there is no reverse proxy on
 * Android, the WebView simply loads the real page directly.
 */
(function () {
  if (window.__noctisBooted) return; // avoid double-injection on re-runs
  window.__noctisBooted = true;

  var state = {
    mode: 'translated',
    nextId: 1,
    pending: {},
    textMap: new Map(),
    imageMap: new Map(),
    imageQueue: [],
    imageQueueActive: 0,
    imagesDone: 0,
    imagesTotal: 0,
    seenImageSrcs: new Set(),
    scaleDebounceTimer: null,
  };

  var MAX_CONCURRENT_IMAGES = 2; // phones have less headroom than a server
  var SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'SVG', 'TITLE']);

  window.__noctisResolve = function (id, result) {
    var cb = state.pending[id];
    if (cb) {
      cb(result);
      delete state.pending[id];
    }
  };

  function callBridge(method, arg) {
    return new Promise(function (resolve) {
      var id = 'r' + state.nextId++;
      state.pending[id] = resolve;
      try {
        window.NoctisBridge[method](id, arg);
      } catch (e) {
        resolve(null);
        delete state.pending[id];
      }
    });
  }

  // ---------- Text ----------

  function isEligibleTextNode(node) {
    var text = node.nodeValue;
    if (!text || !text.trim()) return false;
    var parent = node.parentElement;
    if (!parent) return false;
    if (parent.closest('[translate="no"], [contenteditable="true"], [data-noctis-skip]')) return false;
    var el = parent;
    while (el) {
      if (SKIP_TAGS.has(el.tagName)) return false;
      el = el.parentElement;
    }
    if (parent.classList && parent.classList.contains('noctis-text')) return false;
    return true;
  }

  function collectTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [];
    var current;
    while ((current = walker.nextNode())) {
      if (isEligibleTextNode(current)) nodes.push(current);
    }
    return nodes;
  }

  function wrapNode(node) {
    var span = document.createElement('span');
    span.className = 'noctis-text';
    span.style.fontSize = 'calc(1em * var(--noctis-scale, 1))';
    var id = String(state.nextId++);
    span.dataset.noctisId = id;
    span.textContent = node.nodeValue;
    node.parentNode.replaceChild(span, node);
    state.textMap.set(id, { original: node.nodeValue, translated: null, el: span });
    return { id: id, text: node.nodeValue };
  }

  function chunk(entries, maxItems, maxChars) {
    var batches = [];
    var current = [];
    var chars = 0;
    entries.forEach(function (e) {
      if (current.length >= maxItems || chars + e.text.length > maxChars) {
        if (current.length) batches.push(current);
        current = [];
        chars = 0;
      }
      current.push(e);
      chars += e.text.length;
    });
    if (current.length) batches.push(current);
    return batches;
  }

  function translateBatch(entries) {
    var texts = entries.map(function (e) { return e.text; });
    return callBridge('requestTranslateTexts', JSON.stringify(texts))
      .then(function (result) {
        // The native bridge resolves with the translations already decoded
        // into a real JS array (see NoctisBridge.resolve) — no JSON.parse needed.
        var translations = Array.isArray(result) ? result : texts;
        entries.forEach(function (entry, i) {
          var record = state.textMap.get(entry.id);
          if (!record) return;
          record.translated = translations[i] != null ? translations[i] : entry.text;
          if (state.mode === 'translated') record.el.textContent = record.translated;
        });
      })
      .catch(function () {});
  }

  function processTextIn(root) {
    var nodes = collectTextNodes(root);
    if (nodes.length === 0) return;
    var entries = nodes.map(wrapNode);
    chunk(entries, 40, 3000).forEach(function (batch, i) {
      setTimeout(function () { translateBatch(batch); }, i * 60);
    });
  }

  // ---------- Images ----------

  function resolveSrc(img) {
    var src = img.currentSrc || img.src;
    if (!src || src.indexOf('data:') === 0) return null;
    try { return new URL(src, window.location.href).href; } catch (e) { return null; }
  }

  function isProcessableImage(img) {
    if (img.dataset.noctisProcessed) return false;
    var rect = img.getBoundingClientRect();
    return rect.width >= 40 && rect.height >= 24;
  }

  function enqueueImage(img) {
    var src = resolveSrc(img);
    if (!src || state.seenImageSrcs.has(src) || !isProcessableImage(img)) return;
    state.seenImageSrcs.add(src);
    img.dataset.noctisProcessed = '1';
    state.imagesTotal++;
    state.imageQueue.push({ img: img, src: src });
    reportProgress();
    pumpQueue();
  }

  function pumpQueue() {
    while (state.imageQueueActive < MAX_CONCURRENT_IMAGES && state.imageQueue.length > 0) {
      var job = state.imageQueue.shift();
      state.imageQueueActive++;
      processImage(job.img, job.src).finally(function () {
        state.imageQueueActive--;
        state.imagesDone++;
        reportProgress();
        pumpQueue();
      });
    }
  }

  function processImage(img, src) {
    return callBridge('requestTranslateImage', src).then(function (dataUrl) {
      if (dataUrl && dataUrl !== 'null') {
        state.imageMap.set(src, { originalSrc: src, translatedSrc: dataUrl, el: img });
        if (state.mode === 'translated') img.src = dataUrl;
      }
    }).catch(function () {});
  }

  function scanImages(root) {
    var imgs = root.tagName === 'IMG' ? [root] : Array.prototype.slice.call(root.querySelectorAll('img'));
    imgs.forEach(function (img) {
      if (!img.dataset.noctisProcessed && imageObserver) imageObserver.observe(img);
    });
  }

  var imageObserver = null;
  if ('IntersectionObserver' in window) {
    imageObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) enqueueImage(entry.target); });
    }, { rootMargin: '500px 0px' });
  }

  var mutationObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        processTextIn(node);
        scanImages(node);
      });
      if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
        mutation.target.dataset.noctisProcessed = '';
        if (imageObserver) imageObserver.observe(mutation.target);
      }
    });
  });

  function reportProgress() {
    try { window.NoctisBridge.reportProgress(state.imagesDone, state.imagesTotal); } catch (e) {}
  }

  // ---------- Commands from native ----------

  window.__noctisSetMode = function (mode) {
    state.mode = mode;
    state.textMap.forEach(function (record) {
      record.el.textContent = mode === 'original' ? record.original : (record.translated != null ? record.translated : record.original);
    });
    state.imageMap.forEach(function (record) {
      record.el.src = mode === 'original' ? record.originalSrc : record.translatedSrc;
    });
  };

  window.__noctisSetScale = function (scale) {
    document.documentElement.style.setProperty('--noctis-scale', String(scale));
  };

  window.__noctisIsIdle = function () {
    return state.imageQueueActive === 0 && state.imageQueue.length === 0;
  };

  // ---------- Boot ----------

  processTextIn(document.body);
  scanImages(document.body);
  mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  try { window.NoctisBridge.reportReady(); } catch (e) {}
})();
