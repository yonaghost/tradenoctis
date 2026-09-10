/**
 * Noctis translation runtime — injected into every proxied page (served
 * same-origin via /api/proxy, so fetch() calls back to /api/translate and
 * /api/ocr-translate are plain same-origin requests, no CORS involved).
 *
 * Responsibilities:
 *  - walk text nodes and translate them in place, keeping the original
 *    around so the Original/Translated toggle works instantly;
 *  - find <img> elements (including ones that only get a real src once the
 *    page's own lazy-loading swaps it in, and ones added later via
 *    infinite scroll) and run them through the OCR+translate+reconstruct
 *    pipeline, prioritizing whatever is currently visible;
 *  - report progress and accept commands (toggle mode / font scale) from
 *    the parent translator page via postMessage.
 *
 * Never throws in a way that breaks the host page: every fetch is wrapped,
 * every failure just leaves the original content in place.
 */
(function () {
  var scriptEl = document.currentScript;
  var config = {
    targetLang: (scriptEl && scriptEl.dataset.targetLang) || 'pt',
    sourceLang: 'auto',
    fontScale: Number((scriptEl && scriptEl.dataset.fontScale) || '1') || 1,
  };

  var state = {
    mode: 'translated', // 'translated' | 'original'
    nextTextId: 1,
    textMap: new Map(), // id -> { original, translated, el }
    pendingTextBatches: 0,
    imageMap: new Map(), // resolvedSrc -> { originalSrc, translatedSrc, el }
    imageQueue: [],
    imageQueueActive: 0,
    imagesDone: 0,
    imagesTotal: 0,
    seenImageSrcs: new Set(),
    scaleDebounceTimer: null,
    reportedSourceLang: false,
  };

  var MAX_CONCURRENT_IMAGES = 3;
  var SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'CODE', 'PRE', 'SVG', 'TITLE']);

  function postToParent(message) {
    try {
      window.parent.postMessage(Object.assign({ source: 'noctis' }, message), window.location.origin);
    } catch (e) {
      /* parent may not be listening yet — safe to ignore */
    }
  }

  // ---------- Text translation ----------

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
    var id = String(state.nextTextId++);
    span.dataset.noctisId = id;
    span.textContent = node.nodeValue;
    node.parentNode.replaceChild(span, node);
    state.textMap.set(id, { original: node.nodeValue, translated: null, el: span });
    return { id: id, text: node.nodeValue };
  }

  function chunkEntries(entries, maxItems, maxChars) {
    var batches = [];
    var current = [];
    var chars = 0;
    entries.forEach(function (entry) {
      if (current.length >= maxItems || chars + entry.text.length > maxChars) {
        if (current.length) batches.push(current);
        current = [];
        chars = 0;
      }
      current.push(entry);
      chars += entry.text.length;
    });
    if (current.length) batches.push(current);
    return batches;
  }

  function translateTextBatch(entries) {
    state.pendingTextBatches++;
    return fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        texts: entries.map(function (e) { return e.text; }),
        sourceLang: config.sourceLang,
        targetLang: config.targetLang,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        var translations = json.translations || [];
        entries.forEach(function (entry, i) {
          var record = state.textMap.get(entry.id);
          if (!record) return;
          record.translated = translations[i] != null ? translations[i] : entry.text;
          if (state.mode === 'translated') record.el.textContent = record.translated;
        });
        if (json.detectedSourceLang && !state.reportedSourceLang) {
          state.reportedSourceLang = true;
          postToParent({ type: 'noctis-source-lang', lang: json.detectedSourceLang });
        }
      })
      .catch(function () {
        // Fallback: keep original text visible — never blank it out.
      })
      .finally(function () {
        state.pendingTextBatches--;
      });
  }

  function processTextIn(root) {
    var nodes = collectTextNodes(root);
    if (nodes.length === 0) return;
    var entries = nodes.map(wrapNode);
    var batches = chunkEntries(entries, 40, 3000);
    batches.forEach(function (batch, i) {
      // Small stagger keeps us from firing dozens of simultaneous requests
      // on very text-heavy pages while still starting almost immediately.
      setTimeout(function () { translateTextBatch(batch); }, i * 60);
    });
  }

  // ---------- Image translation ----------

  function resolveSrc(img) {
    var src = img.currentSrc || img.src;
    if (!src || src.indexOf('data:') === 0) return null;
    try {
      return new URL(src, window.location.href).href;
    } catch (e) {
      return null;
    }
  }

  function isProcessableImage(img) {
    if (img.dataset.noctisProcessed) return false;
    var rect = img.getBoundingClientRect();
    if (rect.width < 40 || rect.height < 24) return false; // skip tiny icons/spacers
    return true;
  }

  function enqueueImage(img) {
    var src = resolveSrc(img);
    if (!src || state.seenImageSrcs.has(src) || !isProcessableImage(img)) return;
    state.seenImageSrcs.add(src);
    img.dataset.noctisProcessed = '1';
    state.imagesTotal++;
    state.imageQueue.push({ img: img, src: src });
    reportProgress();
    pumpImageQueue();
  }

  function pumpImageQueue() {
    while (state.imageQueueActive < MAX_CONCURRENT_IMAGES && state.imageQueue.length > 0) {
      var job = state.imageQueue.shift();
      state.imageQueueActive++;
      processImage(job.img, job.src).finally(function () {
        state.imageQueueActive--;
        state.imagesDone++;
        reportProgress();
        pumpImageQueue();
      });
    }
  }

  function processImage(img, src) {
    return fetch('/api/ocr-translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageUrl: src,
        sourceLang: config.sourceLang,
        targetLang: config.targetLang,
        fontScale: config.fontScale,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (json) {
        if (json && json.hasText && json.dataUrl) {
          state.imageMap.set(src, { originalSrc: src, translatedSrc: json.dataUrl, el: img });
          if (state.mode === 'translated') img.src = json.dataUrl;
        }
        // hasText:false (no text / low confidence / unsupported) -> keep original, silently.
      })
      .catch(function () {
        // Network/pipeline failure -> keep original image untouched.
      });
  }

  function scanImages(root) {
    var imgs = root.tagName === 'IMG' ? [root] : Array.prototype.slice.call(root.querySelectorAll('img'));
    imgs.forEach(function (img) {
      if (img.dataset.noctisProcessed) return;
      if (imageObserver) imageObserver.observe(img);
    });
  }

  var imageObserver = null;
  if ('IntersectionObserver' in window) {
    imageObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            enqueueImage(entry.target);
          }
        });
      },
      { rootMargin: '600px 0px' },
    );
  }

  // ---------- Dynamic content (lazy-load / infinite scroll) ----------

  var mutationObserver = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        processTextIn(node);
        scanImages(node);
      });
      if (mutation.type === 'attributes' && mutation.target.tagName === 'IMG') {
        // src swapped in by the site's own lazy-load script.
        var img = mutation.target;
        img.dataset.noctisProcessed = '';
        if (imageObserver) imageObserver.observe(img);
      }
    });
  });

  // ---------- Progress / parent communication ----------

  function reportProgress() {
    postToParent({
      type: 'noctis-progress',
      imagesDone: state.imagesDone,
      imagesTotal: state.imagesTotal,
      textBatchesPending: state.pendingTextBatches,
    });
  }

  window.__noctisIsIdle = function () {
    return state.pendingTextBatches === 0 && state.imageQueueActive === 0 && state.imageQueue.length === 0;
  };

  window.addEventListener('message', function (event) {
    if (event.origin !== window.location.origin || !event.data) return;
    var data = event.data;
    if (data.type === 'noctis-set-mode' && (data.mode === 'original' || data.mode === 'translated')) {
      state.mode = data.mode;
      state.textMap.forEach(function (record) {
        record.el.textContent = state.mode === 'original' ? record.original : (record.translated != null ? record.translated : record.original);
      });
      state.imageMap.forEach(function (record) {
        record.el.src = state.mode === 'original' ? record.originalSrc : record.translatedSrc;
      });
    } else if (data.type === 'noctis-set-scale' && typeof data.scale === 'number') {
      config.fontScale = data.scale;
      document.documentElement.style.setProperty('--noctis-scale', String(data.scale));
      clearTimeout(state.scaleDebounceTimer);
      state.scaleDebounceTimer = setTimeout(recomputeVisibleImagesAtNewScale, 350);
    }
  });

  function recomputeVisibleImagesAtNewScale() {
    state.imageMap.forEach(function (record, src) {
      var rect = record.el.getBoundingClientRect();
      var visible = rect.bottom > -200 && rect.top < window.innerHeight + 200;
      if (!visible) return;
      fetch('/api/ocr-translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: src,
          sourceLang: config.sourceLang,
          targetLang: config.targetLang,
          fontScale: config.fontScale,
        }),
      })
        .then(function (res) { return res.json(); })
        .then(function (json) {
          if (json && json.hasText && json.dataUrl) {
            record.translatedSrc = json.dataUrl;
            if (state.mode === 'translated') record.el.src = json.dataUrl;
          }
        })
        .catch(function () {});
    });
  }

  // ---------- Boot ----------

  function boot() {
    processTextIn(document.body);
    scanImages(document.body);
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
    postToParent({ type: 'noctis-ready', href: window.location.href, title: document.title });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
