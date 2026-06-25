(function () {
  var WORKER_URL     = 'https://skyfares-altitude.klent-5fa.workers.dev';
  var PREMIUM_WA_URL = 'https://api.whatsapp.com/send?phone=6581575306&text=' +
    encodeURIComponent("Hi Skyfare, I'd like to upgrade to Altitude Premium.");

  // ─── Entry point ───────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    var params = new URLSearchParams(window.location.search);
    var slug   = params.get('slug');

    if (!slug) {
      window.location.replace('newsletter.html');
      return;
    }

    if (typeof fetch === 'undefined') {
      showError();
      return;
    }

    // Include Altitude JWT so members receive full premium content
    var altToken = null;
    try { altToken = localStorage.getItem('altitude_jwt'); } catch (_) {}
    var fetchHeaders = altToken ? { 'Authorization': 'Bearer ' + altToken } : {};

    fetch(WORKER_URL + '/newsletter/post?slug=' + encodeURIComponent(slug), { headers: fetchHeaders })
      .then(function (r) {
        if (r.status === 404) { showError(); return null; }
        return r.ok ? r.json() : null;
      })
      .then(function (data) {
        if (!data || !data.post) { showError(); return; }
        renderPost(data.post);
        loadRelated(data.post);
      })
      .catch(function () { showError(); });
  }

  // ─── Render full post ─────────────────────────────────────────────────────

  function renderPost(post) {
    // Update page title + meta
    var pageTitle = post.title ? post.title + ' — Skyfare Altitude' : 'Skyfare Altitude';
    document.title = pageTitle;
    var metaDesc = document.getElementById('nsl-page-title');
    if (metaDesc) metaDesc.textContent = pageTitle;
    var descTag = document.getElementById('nsl-page-desc');
    if (descTag && post.subtitle) descTag.setAttribute('content', post.subtitle);

    // Hero thumbnail
    if (post.thumbnail_url) {
      var heroWrap = document.getElementById('nsl-hero-img');
      var thumb    = document.getElementById('nsl-thumb');
      if (heroWrap && thumb) {
        thumb.src = post.thumbnail_url;
        thumb.alt = post.title;
        heroWrap.classList.remove('hidden');
      }
    }

    // Issue number badge
    var issueNum = getIssueNum(post);
    var issueBadge = document.getElementById('nsl-issue-badge');
    if (issueBadge) issueBadge.textContent = 'Issue ' + issueNum;

    // Free / Premium access badge (on hero image)
    var accessBadge = document.getElementById('nsl-access-badge');
    if (accessBadge) {
      accessBadge.innerHTML = post.is_premium
        ? '<span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 backdrop-blur-sm border border-amber-500/40 px-2.5 py-1 rounded-full"><i class="fa-solid fa-crown text-[8px]"></i> Altitude Exclusive</span>'
        : '<span class="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-300 bg-black/30 backdrop-blur-sm border border-emerald-500/20 px-2.5 py-1 rounded-full"><i class="fa-solid fa-unlock text-[8px]"></i> Free to read</span>';
    }

    // Content tags
    var tagsEl = document.getElementById('nsl-tags');
    if (tagsEl) {
      var visibleTags = (post.content_tags || []).filter(function (t) {
        return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/);
      }).slice(0, 4);
      tagsEl.innerHTML = visibleTags.map(function (t, i) {
        var cls = i === 0
          ? 'text-[10px] font-bold uppercase tracking-widest text-brand-600 bg-brand-50 border border-brand-100 px-2.5 py-1 rounded-full'
          : 'text-[10px] font-bold uppercase tracking-widest text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-full';
        return '<span class="' + cls + '">' + e(t) + '</span>';
      }).join('');
    }

    // Title
    var titleEl = document.getElementById('nsl-title');
    if (titleEl) titleEl.textContent = post.title;

    // Subtitle
    var subtitleEl = document.getElementById('nsl-subtitle');
    if (subtitleEl && post.subtitle) {
      subtitleEl.textContent = post.subtitle;
    } else if (subtitleEl) {
      subtitleEl.classList.add('hidden');
    }

    // Date
    var dateEl = document.getElementById('nsl-date');
    if (dateEl) {
      var formatted = formatDate(post.published_at);
      dateEl.innerHTML = '<i class="fa-regular fa-calendar text-[10px]"></i> ' + (formatted || '');
    }

    // Read time (estimate from content length)
    var readEl = document.getElementById('nsl-readtime');
    if (readEl) {
      var charCount = ((post.content_html || '') + (post.preview_html || '')).replace(/<[^>]+>/g, '').length;
      var mins = Math.max(2, Math.round(charCount / 1000));
      readEl.innerHTML = '<i class="fa-regular fa-clock text-[10px]"></i> ~' + mins + ' min read';
    }

    // Show main content wrapper
    var contentEl = document.getElementById('nsl-content');
    if (contentEl) contentEl.classList.remove('hidden');

    // Show loading → hide
    var loadingEl = document.getElementById('nsl-loading');
    if (loadingEl) loadingEl.classList.add('hidden');

    if (post.is_premium) {
      renderPremiumGate(post);
    } else {
      renderFreeArticle(post);
    }
  }

  // ─── Free article ─────────────────────────────────────────────────────────

  function renderFreeArticle(post) {
    var wrap    = document.getElementById('nsl-article-wrap');
    var article = document.getElementById('nsl-article');
    if (!wrap || !article) return;

    var html = post.content_html || '';
    // API returns email HTML (full DOCTYPE document) — extract just the article body.
    if (html.indexOf('<!DOCTYPE') !== -1 || html.indexOf('<html') !== -1) {
      html = extractEmailBody(html);
    }
    article.innerHTML = html || '<p>Content unavailable.</p>';
    processBeehiivHtml(article);

    wrap.classList.remove('hidden');

    // Share buttons
    var shareEl = document.getElementById('nsl-share');
    if (shareEl) {
      shareEl.classList.remove('hidden');
      wireShareButtons(post);
    }
  }

  // ─── Premium gate ─────────────────────────────────────────────────────────

  function renderPremiumGate(post) {
    var gate    = document.getElementById('nsl-gate');
    var preview = document.getElementById('nsl-preview');
    if (!gate) return;

    if (preview && post.preview_html) {
      preview.innerHTML = post.preview_html;
      processBeehiivHtml(preview);
    }

    gate.classList.remove('hidden');
  }

  // ─── Process Beehiiv editor_html ─────────────────────────────────────────

  function processBeehiivHtml(container) {
    if (!container) return;

    // 1. Convert imageBlock figures → real <img> elements
    container.querySelectorAll('figure[data-type="imageBlock"]').forEach(function (fig) {
      var src     = fig.getAttribute('data-src') || '';
      var alt     = fig.getAttribute('data-alt') || '';
      var caption = fig.querySelector('figcaption');
      var capText = caption ? caption.innerHTML : '';

      fig.removeAttribute('data-src');
      fig.removeAttribute('data-alt');
      fig.removeAttribute('data-type');

      if (src) {
        var img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.className = 'nsl-img';
        fig.insertBefore(img, fig.firstChild);
      }

      if (caption) {
        caption.innerHTML = capText;
      }
    });

    // 2. Apply node-section inline styles from data attributes
    container.querySelectorAll('.node-section, [data-type="section"]').forEach(function (sec) {
      var styles = [];
      var bg  = sec.getAttribute('data-background-color');
      var pt  = sec.getAttribute('data-padding-top');
      var pr  = sec.getAttribute('data-padding-right');
      var pb  = sec.getAttribute('data-padding-bottom');
      var pl  = sec.getAttribute('data-padding-left');
      var bc  = sec.getAttribute('data-border-color');
      var bs  = sec.getAttribute('data-border-style') || 'solid';
      var bwt = sec.getAttribute('data-border-width-top');
      var bwr = sec.getAttribute('data-border-width-right');
      var bwb = sec.getAttribute('data-border-width-bottom');
      var bwl = sec.getAttribute('data-border-width-left');
      var rtl = sec.getAttribute('data-border-top-left-radius');
      var rtr = sec.getAttribute('data-border-top-right-radius');
      var rbl = sec.getAttribute('data-border-bottom-left-radius');
      var rbr = sec.getAttribute('data-border-bottom-right-radius');

      if (bg)  styles.push('background-color:' + bg);
      if (pt)  styles.push('padding-top:' + pt + 'px');
      if (pr)  styles.push('padding-right:' + pr + 'px');
      if (pb)  styles.push('padding-bottom:' + pb + 'px');
      if (pl)  styles.push('padding-left:' + pl + 'px');
      if (bc && (Number(bwt) || Number(bwr) || Number(bwb) || Number(bwl))) {
        styles.push('border-color:' + bc);
        styles.push('border-style:' + bs);
        styles.push('border-width:' + [bwt,bwr,bwb,bwl].map(function(v){return (v||0)+'px';}).join(' '));
      }
      if (rtl || rtr || rbl || rbr) {
        styles.push('border-radius:' + [rtl,rtr,rbr,rbl].map(function(v){return (v||0)+'px';}).join(' '));
      }
      styles.push('margin-bottom:1.25rem');
      styles.push('overflow:hidden');

      sec.style.cssText = styles.join(';');
    });

    // 3. Columns layout → flex on desktop
    container.querySelectorAll('[data-type="columns"]').forEach(function (cols) {
      cols.style.cssText = 'display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.25rem;';
      cols.querySelectorAll('[data-type="column"]').forEach(function (col) {
        col.style.cssText = 'flex:1;min-width:220px;';
      });
    });

    // 4. Wire up button links
    container.querySelectorAll('[data-type="button"]').forEach(function (btn) {
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener noreferrer');
      btn.className = 'nsl-btn';
    });

    // 5. Remove Beehiiv email footer boilerplate
    container.querySelectorAll('p, a').forEach(function (el) {
      var text = el.textContent || '';
      if (
        text.includes('You are receiving this because') ||
        (el.tagName === 'A' && text.trim() === 'Unsubscribe')
      ) {
        var parent = el.parentNode;
        if (parent) parent.removeChild(el);
      }
    });

    // 6. Remove internal Beehiiv upsell sections (Altitude Pro buttons etc.)
    container.querySelectorAll('.node-section').forEach(function (sec) {
      var text = sec.textContent || '';
      if (text.includes('SGD') && text.includes('Upgrade to Altitude')) {
        var parent = sec.parentNode;
        if (parent) parent.removeChild(sec);
      }
    });

    // 7. Add .is-visible to any slide-up elements so they're immediately shown
    container.querySelectorAll('.slide-up').forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  // ─── Email HTML extraction ────────────────────────────────────────────────
  // The Beehiiv API returns full email HTML (DOCTYPE, head, email tables).
  // This function extracts the article content from the email body,
  // strips MSO conditionals, email nav rows, and the footer.

  function extractEmailBody(html) {
    if (!html) return '';
    try {
      var parser  = new DOMParser();
      var doc     = parser.parseFromString(html, 'text/html');
      var body    = doc.body;
      if (!body) return '';

      var parts    = [];
      var h1Seen   = false; // skip first H1 (already shown in page hero)

      // Prefer the content-blocks row, fall back to whole body
      var root = body.querySelector('tr#content-blocks') || body;

      function skipNode(node) {
        var style = node.getAttribute && (node.getAttribute('style') || '');
        if (style.indexOf('display:none') !== -1 || style.indexOf('display: none') !== -1) return true;
        var text = (node.textContent || '').trim();
        // Issue label (e.g. "SKYFARE ALTITUDE · ISSUE 01")
        if (text.length < 100 && /skyfare altitude.*issue\s*\d+/i.test(text)) return true;
        // "Read online" nav link
        if (text === 'Read online') return true;
        // Footer / unsubscribe content (only short nodes — don't remove ancestors)
        if (node.children && node.children.length === 0 &&
            text.length < 500 &&
            /unsubscribe|you are receiving this|skyfare consulting pte\. ltd/i.test(text)) return true;
        return false;
      }

      function walk(node) {
        if (!node) return;

        // Text nodes inside content elements are handled by outerHTML
        if (node.nodeType === 3) return;
        if (node.nodeType !== 1) return;

        var tag = node.tagName.toLowerCase();

        if (skipNode(node)) return;

        // ── Headings ────────────────────────────────────────────────────────
        if (/^h[1-6]$/.test(tag)) {
          if (tag === 'h1' && !h1Seen) { h1Seen = true; return; } // skip first duplicate
          parts.push(node.outerHTML);
          return;
        }

        // ── Paragraphs ──────────────────────────────────────────────────────
        if (tag === 'p') {
          var txt = node.textContent.trim();
          if (txt.length > 0) parts.push(node.outerHTML);
          return;
        }

        // ── Horizontal rules ────────────────────────────────────────────────
        if (tag === 'hr') { parts.push('<hr>'); return; }

        // ── Blockquotes ─────────────────────────────────────────────────────
        if (tag === 'blockquote') { parts.push(node.outerHTML); return; }

        // ── Images (non-tracking) ───────────────────────────────────────────
        if (tag === 'img') {
          var w = parseInt(node.getAttribute('width')  || '100');
          var h = parseInt(node.getAttribute('height') || '100');
          if (w <= 1 || h <= 1) return; // tracking pixel
          var src     = node.getAttribute('src') || '';
          var alt     = node.getAttribute('alt') || '';
          // Build a clean responsive img
          parts.push(
            '<figure class="nsl-email-fig">' +
              '<img src="' + src + '" alt="' + alt + '"' +
              ' style="max-width:100%;width:100%;height:auto;display:block;margin:0 auto;border-radius:8px;">' +
            '</figure>'
          );
          return;
        }

        // ── Data tables (scorecards, comparison grids) ──────────────────────
        if (tag === 'table' && node.querySelector('th')) {
          parts.push(node.outerHTML);
          return;
        }

        // ── Styled callout divs (coloured section boxes) ────────────────────
        if (tag === 'div') {
          var st    = node.getAttribute('style') || '';
          var bgm   = st.match(/background(?:-color)?:\s*([^;,]+)/);
          if (bgm && node.querySelector('p,h1,h2,h3,h4')) {
            var bg  = bgm[1].trim();
            var blm = st.match(/border-left:\s*([^;]+)/);
            var bdl = blm ? 'border-left:' + blm[1] + ';' : '';
            var brm = st.match(/border-radius:\s*([^;]+)/);
            var bdr = brm ? 'border-radius:' + brm[1] + ';' : 'border-radius:8px;';
            parts.push(
              '<div style="background:' + bg + ';' + bdl + bdr +
              'padding:1rem 1.25rem;margin:1.25rem 0;overflow:hidden;">' +
                node.innerHTML +
              '</div>'
            );
            return;
          }
        }

        // ── Layout containers — recurse into children ────────────────────────
        var ch = node.childNodes;
        for (var i = 0; i < ch.length; i++) walk(ch[i]);
      }

      walk(root);

      return parts.join('\n').trim() || body.innerHTML; // raw fallback if extraction empty

    } catch (_) {
      return html;
    }
  }

  // ─── Share buttons ────────────────────────────────────────────────────────

  function wireShareButtons(post) {
    var pageUrl  = window.location.href;
    var shareText = 'Check out this edition of Skyfare Altitude: ' + post.title;

    // Copy link
    var copyBtn = document.getElementById('nsl-copy-link');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        if (navigator.clipboard) {
          navigator.clipboard.writeText(pageUrl).then(function () {
            copyBtn.innerHTML = '<i class="fa-solid fa-check text-[10px]"></i> Copied!';
            setTimeout(function () {
              copyBtn.innerHTML = '<i class="fa-solid fa-link text-[10px]"></i> Copy link';
            }, 2000);
          });
        }
      });
    }

    // WhatsApp share
    var waBtn = document.getElementById('nsl-share-wa');
    if (waBtn) {
      waBtn.href = 'https://api.whatsapp.com/send?text=' + encodeURIComponent(shareText + '\n' + pageUrl);
    }

    // X / Twitter share
    var xBtn = document.getElementById('nsl-share-x');
    if (xBtn) {
      xBtn.href = 'https://x.com/intent/tweet?text=' + encodeURIComponent(shareText) + '&url=' + encodeURIComponent(pageUrl);
    }
  }

  // ─── Related posts ────────────────────────────────────────────────────────

  function loadRelated(currentPost) {
    var relatedSection = document.getElementById('nsl-related');
    var relatedGrid    = document.getElementById('nsl-related-grid');
    if (!relatedSection || !relatedGrid) return;

    // Try sessionStorage cache first (populated by newsletter-archive.js on archive page)
    var cached = null;
    try { cached = JSON.parse(sessionStorage.getItem('skyfare_posts') || 'null'); } catch {}

    if (cached && cached.posts) {
      renderRelated(currentPost, cached.posts, relatedGrid, relatedSection);
    } else {
      // Fetch fresh list
      fetch(WORKER_URL + '/newsletter/posts')
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && data.posts) {
            renderRelated(currentPost, data.posts, relatedGrid, relatedSection);
          }
        })
        .catch(function () {});
    }
  }

  function renderRelated(currentPost, posts, grid, section) {
    var currentTags = (currentPost.content_tags || []).filter(function (t) {
      return t !== 'altitude-premium' && !t.match(/^issue-?\d+$/);
    });

    // Score other posts by tag overlap, exclude current
    var others = posts
      .filter(function (p) { return p.id !== currentPost.id; })
      .map(function (p) {
        var overlap = (p.content_tags || []).filter(function (t) { return currentTags.indexOf(t) !== -1; }).length;
        return { post: p, score: overlap };
      })
      .sort(function (a, b) { return b.score - a.score; })
      .slice(0, 3)
      .map(function (item) { return item.post; });

    if (!others.length) return;

    grid.innerHTML = others.map(function (p, i) {
      var prem     = (p.content_tags || []).indexOf('altitude-premium') !== -1;
      var issueNum = getIssueNum(p);
      var date     = formatDate(p.published_at);
      var type     = (p.content_tags || []).filter(function (t) { return t !== 'altitude-premium'; })[0] || 'Newsletter';
      var href     = 'newsletter-detail.html?slug=' + encodeURIComponent(p.slug);
      var delay    = i * 0.05;

      var imgHtml = p.thumbnail_url
        ? '<img src="' + e(p.thumbnail_url) + '" alt="' + e(p.title) + '" class="w-full h-full object-cover' + (prem ? '' : ' group-hover:scale-105 transition-transform duration-500') + '">'
        : '<div class="w-full h-full flex items-center justify-center"><i class="fa-solid fa-plane text-white/15 text-4xl -rotate-12"></i></div>';

      var cardCls = 'group bg-white border rounded-2xl overflow-hidden shadow-sm transition-all duration-300 slide-up is-visible ' +
        (prem ? 'border-amber-200/60' : 'border-neutral-100 hover:shadow-md');

      var ctaHtml = prem
        ? '<a href="https://api.whatsapp.com/send?phone=6581575306&text=' + encodeURIComponent("Hi Skyfare, I'd like to upgrade to Altitude Premium.") + '" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-800 transition-colors">Get Premium Access <i class="fa-solid fa-arrow-right text-[10px]"></i></a>'
        : '<a href="' + href + '" class="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors">Read <i class="fa-solid fa-arrow-right text-[10px]"></i></a>';

      var altitudeBadge = prem
        ? '<div class="absolute bottom-3 left-3"><span class="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest text-amber-300 bg-black/50 backdrop-blur-sm border border-amber-500/40 px-2 py-0.5 rounded-full"><i class="fa-solid fa-crown text-[7px]"></i> Altitude</span></div>'
        : '';

      return '<article class="' + cardCls + '" style="animation-delay:' + delay + 's;">' +
        '<a href="' + (prem ? '#' : href) + '" class="block">' +
        '<div class="relative h-40 bg-brand-950 overflow-hidden">' +
          imgHtml +
          '<div class="absolute inset-0" style="background:linear-gradient(to top,rgba(7,24,41,.45) 0%,transparent 60%);"></div>' +
          '<div class="absolute top-3 left-3"><span class="text-[10px] font-bold uppercase tracking-widest text-white bg-brand-600/80 backdrop-blur-sm px-2.5 py-1 rounded-full">Issue ' + e(issueNum) + '</span></div>' +
          '<div class="absolute bottom-3 right-3"><span class="text-[10px] font-semibold text-white/80 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">' + e(type) + '</span></div>' +
          altitudeBadge +
        '</div>' +
        '</a>' +
        '<div class="p-5">' +
          (date ? '<p class="text-[10px] text-neutral-400 mb-1.5 font-medium">' + e(date) + '</p>' : '') +
          '<h3 class="text-sm font-display font-bold text-neutral-900 mb-3 leading-snug">' + e(p.title) + '</h3>' +
          ctaHtml +
        '</div>' +
      '</article>';
    }).join('');

    section.classList.remove('hidden');
  }

  // ─── Error state ──────────────────────────────────────────────────────────

  function showError() {
    var loadingEl = document.getElementById('nsl-loading');
    var errorEl   = document.getElementById('nsl-error');
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl)   errorEl.classList.remove('hidden');
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function getIssueNum(post) {
    var tags = post.content_tags || [];
    for (var i = 0; i < tags.length; i++) {
      var m = String(tags[i]).toLowerCase().match(/issue[-_]?(\d+)/);
      if (m) return m[1].padStart(2, '0');
    }
    return '??';
  }

  function formatDate(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (err) { return ''; }
  }

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
