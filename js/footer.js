/**
 * Footer and WhatsApp Button Injector
 */
document.addEventListener('DOMContentLoaded', () => {
  const L  = window.SKYFARE_LINKS || {};
  const WA = L.whatsapp || 'https://api.whatsapp.com/send?phone=6581575306';
  const IG = (L.instagram || {}).url || 'https://www.instagram.com/skyfareconsulting/';
  const TK = ((L.tiktok || {}).consulting || {}).url || 'https://www.tiktok.com/@skyfareconsulting';

  const footerHTML = `
    <!-- FOOTER -->
    <footer class="bg-deepblue-950 pt-20 pb-10 mt-auto">
      <div class="container mx-auto px-4 md:px-6">
        <div class="grid md:grid-cols-4 gap-12 mb-16">
          <div class="">
            <a href="/" class="inline-block group mb-6">
              <img src="${window.location.pathname.includes('/pages/') ? '../' : ''}logos/logo.webp" alt="Skyfare Consulting Logo" class="h-10 w-auto object-contain transition-transform duration-500 group-hover:scale-110 brightness-0 invert">
            </a>
            <p class="text-brand-100/50 text-sm max-w-sm leading-relaxed">
              Your private flight strategist for Business and First Class travel. We specialize in high-value miles redemptions and luxury concierge services.
            </p>

            <div class="flex gap-4 mt-8">
              <a href="${WA}" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-green-500 hover:bg-green-600 transition-all shadow-sm shadow-green-500/30">
                <i class="fa-brands fa-whatsapp"></i>
              </a>
              <a href="${IG}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 transition-all shadow-sm shadow-pink-500/30">
                <i class="fa-brands fa-instagram"></i>
              </a>
              <a href="${TK}" target="_blank" rel="noopener noreferrer" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-black hover:bg-neutral-800 transition-all shadow-sm shadow-black/20">
                <i class="fa-brands fa-tiktok"></i>
              </a>
            </div>
          </div>
          <div>
            <h4 class="text-white font-bold mb-6">Services</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="/pages/krisflyer" class="text-brand-100/50 hover:text-white transition-colors">KrisFlyer Miles</a></li>
              <li><a href="/pages/chauffeur" class="text-brand-100/50 hover:text-white transition-colors">Chauffeur Service</a></li>
              <li><a href="/pages/extra-services" class="text-brand-100/50 hover:text-white transition-colors">Extra Services</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-white font-bold mb-6">Company</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="/" class="text-brand-100/50 hover:text-white transition-colors">Home</a></li>
              <li><a href="/pages/how-it-works" class="text-brand-100/50 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="/pages/past-flight-deals" class="text-brand-100/50 hover:text-white transition-colors">Flights We've Arranged</a></li>
              <li><a href="/pages/newsletter" class="text-brand-100/50 hover:text-white transition-colors">Newsletter</a></li>
              <li><a href="/pages/testimonials" class="text-brand-100/50 hover:text-white transition-colors">Testimonials</a></li>
              <li><a href="/pages/book" class="text-brand-100/50 hover:text-white transition-colors">Book a Strategy Call</a></li>
              <li><a href="/pages/assessment" class="text-brand-100/50 hover:text-white transition-colors">Free Assessment</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-white font-bold mb-6">Support</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="/pages/faq" class="text-brand-100/50 hover:text-white transition-colors">FAQ</a></li>
              <li><a href="/pages/contact" class="text-brand-100/50 hover:text-white transition-colors">Contact</a></li>
              <li><a href="/pages/rate-us" class="text-brand-100/50 hover:text-white transition-colors">Rate Us</a></li>
              <li><a href="/pages/terms" class="text-brand-100/50 hover:text-white transition-colors">Terms & Conditions</a></li>
              <li><a href="/pages/privacy" class="text-brand-100/50 hover:text-white transition-colors">Privacy Policy</a></li>
              <li><a href="#" onclick="window.SkyConsent&&window.SkyConsent.openPreferences();return false;" class="text-brand-100/50 hover:text-white transition-colors">Cookie Preferences</a></li>
            </ul>
          </div>

    
        </div>

        <div class="pt-8 border-t border-white/5 flex flex-col items-center justify-center text-center">
          <p class="text-[11px] text-brand-100/30 uppercase tracking-widest">
            © <span id="year"></span> Skyfare Consulting. All rights reserved.
          </p>
        </div>
      </div>
    </footer>

    <!-- WhatsApp Floating Button -->
    <a href="${WA}"
       class="whatsapp-fab fixed bottom-8 right-8 z-[100] w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center text-white text-3xl shadow-2xl shadow-emerald-500/40 hover:scale-110 active:scale-95 transition-all"
       aria-label="Chat on WhatsApp">
      <i class="fa-brands fa-whatsapp"></i>
    </a>

  `;

  // Inject into body at the end
  document.body.insertAdjacentHTML('beforeend', footerHTML);

  // Update year
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── WhatsApp pre-fill (site-wide) ───────────────────────────────────
  // Open every WhatsApp CTA with a context message so the consultant gets
  // the visitor's intent immediately. Runs after the footer/FAB is injected
  // so it also covers the floating button. footer.js loads on every page,
  // making this the single source of truth. Override an individual link by
  // adding  data-wa-message="…"  to its anchor (see book.html).
  const WA_DEFAULT = "Hi Skyfare, I'd like to speak to a travel consultant.";
  document.querySelectorAll('a[href*="api.whatsapp.com/send"], a[href*="wa.me/"]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (/[?&]text=/.test(href)) return; // already carries a message
    const msg = a.getAttribute('data-wa-message') || WA_DEFAULT;
    a.setAttribute('href', href + (href.indexOf('?') === -1 ? '?' : '&') + 'text=' + encodeURIComponent(msg));
  });

});
