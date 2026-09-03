(function () {
  var WORKER = window.KFGuideAuth.WORKER;

  var LOADED_CHAPTERS = [];
  var currentIndex = 0;

  // ─── Boot ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    window.KFGuideAuth.init({ onUnlocked: onUnlocked });
  }

  function onUnlocked(email) {
    window.__kfSignOut = window.KFGuideAuth.signOut;
    var detail = { email: email || '', product: 'KrisFlyer Guide', plan: 'Guide access' };
    if (window.SkyfarePrivate) window.SkyfarePrivate.setUser(detail);
    window.dispatchEvent(new CustomEvent('skyfare:private-user', { detail: detail }));

    fetch(WORKER + '/guide/chapters', { headers: { 'Authorization': 'Bearer ' + window.KFGuideAuth.getToken() } })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (!res.ok || !res.data.chapters || !res.data.chapters.length) {
          _showLoadError();
          return;
        }
        LOADED_CHAPTERS = res.data.chapters;
        renderToc();
        wireToc();
        wirePrevNext();
        window.addEventListener('popstate', function () {
          renderChapter(_indexFromUrl(), { pushState: false });
        });
        window.addEventListener('scroll', _updateScrollProgress, { passive: true });
        renderChapter(_indexFromUrl(), { pushState: false });
      })
      .catch(_showLoadError);
  }

  function _showLoadError() {
    var headingTitle = document.querySelector('[data-read-chapter-heading-title]');
    var headingLabel = document.querySelector('[data-read-chapter-label]');
    var content = document.querySelector('[data-read-content]');
    if (headingTitle) headingTitle.textContent = 'Guide unavailable';
    if (headingLabel) headingLabel.textContent = 'Reader';
    if (content) content.innerHTML = '<p class="private-note">Couldn\'t load the guide right now. Please go back to the library and try again.</p>';
  }

  function _indexFromUrl() {
    var n = parseInt(new URLSearchParams(location.search).get('chapter'), 10);
    if (!Number.isInteger(n) || n < 0 || n >= LOADED_CHAPTERS.length) return 0;
    return n;
  }

  // ─── Table of contents ────────────────────────────────────────────────────

  function renderToc() {
    var list = document.querySelector('[data-read-toc-list]');
    if (!list) return;
    list.innerHTML = LOADED_CHAPTERS.map(function (chapter, i) {
      var chapterPart = chapter.number > 0 ? 'Chapter ' + chapter.number : 'Introduction';
      var titlePart = chapter.number > 0 ? chapter.title : '';
      var icon = chapter.number > 0 ? 'fa-bookmark' : 'fa-circle-info';
      return '<a href="kf-guide-reader?chapter=' + i + '" data-toc-index="' + i + '"><i class="fa-solid ' + icon + '" aria-hidden="true"></i><span><strong>' + e(chapterPart) + '</strong>' + (titlePart ? '<em>' + e(titlePart) + '</em>' : '') + '</span></a>';
    }).join('');
  }

  function wireToc() {
    var list = document.querySelector('[data-read-toc-list]');
    if (list) {
      list.addEventListener('click', function (evt) {
        var link = evt.target.closest('[data-toc-index]');
        if (!link) return;
        evt.preventDefault();
        closeTocDrawer();
        renderChapter(parseInt(link.getAttribute('data-toc-index'), 10), { pushState: true });
      });
    }

    var toggle = document.querySelector('[data-read-toc-toggle]');
    var toc = document.querySelector('[data-read-toc]');
    var backdrop = document.querySelector('[data-read-toc-close]');
    if (toggle && toc) {
      toggle.addEventListener('click', function () {
        toc.classList.add('is-open');
        if (backdrop) backdrop.classList.add('is-open');
      });
    }
    if (backdrop) backdrop.addEventListener('click', closeTocDrawer);
  }

  function closeTocDrawer() {
    var toc = document.querySelector('[data-read-toc]');
    var backdrop = document.querySelector('[data-read-toc-close]');
    if (toc) toc.classList.remove('is-open');
    if (backdrop) backdrop.classList.remove('is-open');
  }

  // ─── Prev/Next ────────────────────────────────────────────────────────────

  function wirePrevNext() {
    var prevBtn = document.querySelector('[data-read-prev]');
    var nextBtn = document.querySelector('[data-read-next]');
    if (prevBtn) prevBtn.addEventListener('click', function () { renderChapter(currentIndex - 1, { pushState: true }); });
    if (nextBtn) nextBtn.addEventListener('click', function () { renderChapter(currentIndex + 1, { pushState: true }); });
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  function renderChapter(index, opts) {
    var chapter = LOADED_CHAPTERS[index];
    if (!chapter) return;
    currentIndex = index;

    // Chapter Number 0 is the Introduction -- not "Chapter 0" to a reader
    // (mirrors the same fix in cloudflare/services/guideContent.js's PDF assembly).
    var chapterLabel = chapter.number > 0 ? 'Chapter ' + chapter.number : 'Introduction';
    var heading = chapter.number > 0 ? chapterLabel + ' — ' + chapter.title : chapter.title;
    var timeText = _estimateReadingTime(chapter.contentHtml);

    var titleEl = document.querySelector('[data-read-chapter-title]');
    if (titleEl) titleEl.textContent = heading;

    var headingLabelEl = document.querySelector('[data-read-chapter-label]');
    if (headingLabelEl) headingLabelEl.textContent = chapterLabel;

    var headingTitleEl = document.querySelector('[data-read-chapter-heading-title]');
    if (headingTitleEl) headingTitleEl.textContent = chapter.title || chapterLabel;

    var positionEl = document.querySelector('[data-read-position]');
    if (positionEl) positionEl.textContent = 'Chapter ' + (index + 1) + ' of ' + LOADED_CHAPTERS.length;

    var metaRow = document.querySelector('[data-read-meta-row]');
    if (metaRow) {
      metaRow.innerHTML = '<span><i class="fa-solid fa-layer-group" aria-hidden="true"></i>' + e('Chapter ' + (index + 1) + ' of ' + LOADED_CHAPTERS.length) + '</span><span><i class="fa-solid fa-clock" aria-hidden="true"></i>' + e(timeText) + '</span>';
    }

    var cover = chapter.coverImageUrl
      ? '<img src="' + e(chapter.coverImageUrl) + '" alt="">'
      : '';
    var content = document.querySelector('[data-read-content]');
    if (content) content.innerHTML = cover + (chapter.contentHtml || '');

    var timeEl = document.querySelector('[data-read-time]');
    if (timeEl) timeEl.textContent = timeText;

    document.querySelectorAll('[data-toc-index]').forEach(function (link) {
      link.classList.toggle('is-active', parseInt(link.getAttribute('data-toc-index'), 10) === index);
    });

    var prevBtn = document.querySelector('[data-read-prev]');
    var nextBtn = document.querySelector('[data-read-next]');
    if (prevBtn) prevBtn.hidden = index === 0;
    if (nextBtn) nextBtn.hidden = index === LOADED_CHAPTERS.length - 1;

    // A chapter change should feel instant, not smooth-scroll -- smooth
    // scrolling is for in-page motion, not "you just switched documents."
    window.scrollTo(0, 0);
    _updateScrollProgress();

    if (opts && opts.pushState) {
      history.pushState(null, '', 'kf-guide-reader?chapter=' + index);
    }
  }

  function _estimateReadingTime(html) {
    var text = String(html || '').replace(/<[^>]*>/g, ' ');
    var words = text.trim().split(/\s+/).filter(Boolean).length;
    var minutes = Math.max(1, Math.round(words / 200));
    return minutes + ' min read';
  }

  var _progressRaf = null;
  function _updateScrollProgress() {
    if (_progressRaf) return;
    _progressRaf = requestAnimationFrame(function () {
      _progressRaf = null;
      var fill = document.querySelector('[data-read-progress-fill]');
      if (!fill) return;
      var scrollable = document.documentElement.scrollHeight - window.innerHeight;
      var pct = scrollable > 0 ? Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100)) : 0;
      fill.style.width = pct + '%';
    });
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function e(str) {
    var d = document.createElement('div');
    d.textContent = String(str || '');
    return d.innerHTML;
  }
})();
