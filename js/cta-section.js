// Shared "closing" CTA band -- fetches components/cta-section.html and
// replaces the page's [data-cta-mount] placeholder with it, populated from
// that element's data-cta-* attributes. Follows the same fetch/inject
// convention as js/magic-modal.js and js/newsletter-modal.js, adapted for
// in-flow page content instead of an end-of-body overlay: those always
// append to the end of <body> (position doesn't matter for a fixed-overlay
// modal); this replaces a specific mount element in place, since the CTA
// band must render exactly where the page put it.
//
// Author-facing contract (set as data-* attributes on the mount element):
//
//   data-cta-mode                 "buttons" (default) | "newsletter-form"
//   data-cta-eyebrow-icon         Font Awesome class, e.g. "fa-solid fa-arrow-up"
//   data-cta-eyebrow-text
//   data-cta-heading
//   data-cta-description
//   data-cta-art-image            path to the background photo, already
//                                 relative to the current page (same
//                                 convention as every other asset path in
//                                 these files -- no rewriting is done here)
//
//   -- mode="buttons" only --
//   data-cta-primary-variant      "whatsapp" | "primary" | "outline" | "gold"
//   data-cta-primary-icon
//   data-cta-primary-label
//   data-cta-primary-href
//   data-cta-primary-target       optional, e.g. "_blank"
//   data-cta-secondary-*          same fields, omit entirely for a single-
//                                 button CTA
//   data-cta-primary-locked-feature / data-cta-secondary-locked-feature
//                                 optional -- when set, that button is run
//                                 through the existing Coming Soon lock
//                                 treatment (js/coming-soon.js) instead of
//                                 being a live link
(function () {
  var mount = document.querySelector('[data-cta-mount]');
  if (!mount || window.__ctaSectionLoading) return;
  window.__ctaSectionLoading = true;

  var prefix = window.location.pathname.indexOf('/pages/') !== -1 ? '../' : '';
  var componentUrl = prefix + 'components/cta-section.html';

  function setIcon(el, classes) {
    el.className = (classes || '') + ' text-sm';
  }

  function fillButton(anchor, cfg) {
    if (!cfg.href) {
      anchor.remove();
      return;
    }
    anchor.href = cfg.href;
    if (cfg.target) {
      anchor.target = cfg.target;
      anchor.rel = 'noopener noreferrer';
    }
    anchor.classList.add('cta-action-v5--' + (cfg.variant || 'outline'));
    setIcon(anchor.querySelector('i'), cfg.icon);
    anchor.querySelector('span').textContent = cfg.label || '';

    if (cfg.lockedFeature) {
      // Keep href in place (matches every other locked CTA sitewide) --
      // js/coming-soon.js blocks activation via aria-disabled + a click/
      // keydown interceptor, not by removing href. Removing it here would
      // pull the button out of the tab order, defeating the whole point of
      // aria-disabled over the native disabled attribute.
      anchor.setAttribute('data-coming-soon', '');
      anchor.setAttribute('data-coming-soon-mode', 'button');
      anchor.setAttribute('data-coming-soon-feature', cfg.lockedFeature);
    }
  }

  // Self-triggering entrance -- never rely on the sitewide .slide-up
  // IntersectionObserver (js/header.js), which only scans the DOM once at
  // DOMContentLoaded and will never see this component, injected later by
  // an async fetch. Same idiom as js/coming-soon.js's reveal().
  function reveal(root) {
    var els = root.querySelectorAll('.slide-up');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        els.forEach(function (el) { el.classList.add('is-visible'); });
      });
    });
  }

  function populate(section) {
    var d = mount.dataset;

    var art = section.querySelector('#cta-section-art');
    if (d.ctaArtImage) art.style.backgroundImage = "url('" + d.ctaArtImage + "')";

    setIcon(section.querySelector('#cta-section-eyebrow-icon'), d.ctaEyebrowIcon);
    section.querySelector('#cta-section-eyebrow-text').textContent = d.ctaEyebrowText || '';
    section.querySelector('#cta-section-heading').textContent = d.ctaHeading || '';
    section.querySelector('#cta-section-description').textContent = d.ctaDescription || '';

    if (d.ctaFootnoteText && d.ctaFootnoteLinkHref) {
      var footnote = section.querySelector('#cta-section-footnote');
      footnote.classList.remove('hidden');
      section.querySelector('#cta-section-footnote-text').textContent = d.ctaFootnoteText;
      var footnoteLink = section.querySelector('#cta-section-footnote-link');
      footnoteLink.href = d.ctaFootnoteLinkHref;
      footnoteLink.textContent = d.ctaFootnoteLinkText || '';
    }

    if (d.ctaMode === 'newsletter-form') {
      section.querySelector('#cta-section-buttons').remove();
      var form = section.querySelector('#cta-section-newsletter');
      form.classList.remove('hidden');
      if (window.SkyNewsletter) window.SkyNewsletter.bind(form.querySelector('[data-newsletter-form]'));
    } else {
      section.querySelector('#cta-section-newsletter').remove();
      fillButton(section.querySelector('#cta-section-primary'), {
        variant: d.ctaPrimaryVariant,
        icon: d.ctaPrimaryIcon,
        label: d.ctaPrimaryLabel,
        href: d.ctaPrimaryHref,
        target: d.ctaPrimaryTarget,
        lockedFeature: d.ctaPrimaryLockedFeature,
      });
      fillButton(section.querySelector('#cta-section-secondary'), {
        variant: d.ctaSecondaryVariant,
        icon: d.ctaSecondaryIcon,
        label: d.ctaSecondaryLabel,
        href: d.ctaSecondaryHref,
        target: d.ctaSecondaryTarget,
        lockedFeature: d.ctaSecondaryLockedFeature,
      });
    }

    reveal(section);
  }

  fetch(componentUrl)
    .then(function (r) { return r.text(); })
    .then(function (html) {
      var tmp = document.createElement('div');
      tmp.innerHTML = html.trim();
      var section = tmp.querySelector('#cta-section');
      if (!section || !mount.parentNode) return;
      populate(section);
      mount.replaceWith(section);
      // Locked CTA buttons are only discoverable after the fetched component
      // enters the document. Running this while `section` is still detached
      // leaves buttons such as the How It Works strategy-call CTA live.
      if (window.SkyComingSoon) window.SkyComingSoon.init();
    })
    .catch(function () {});
})();
