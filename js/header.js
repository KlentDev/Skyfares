/**
 * Header and Mobile Menu Injector
 */
document.addEventListener('DOMContentLoaded', () => {
  // Global CSS Injection
  const style = document.createElement('style');
  style.textContent = `
    html, body {
      overflow-x: hidden;
      width: 100%;
      scroll-behavior: smooth;
    }

    /* Header entrance -- restrained fade-in-up on initial load, ahead of the
       hero content's own .hero-reveal stagger (see css/style.css). */
    @media (prefers-reduced-motion: no-preference) {
      #main-header.header-enter {
        animation: headerReveal 0.5s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
    }
    @keyframes headerReveal {
      from { opacity: 0; transform: translateY(-10px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Cinematic homepage treatment: keep the page scrollable without a
       visible browser scrollbar. */
    html, body {
      scrollbar-width: none;
      -ms-overflow-style: none;
    }

    html::-webkit-scrollbar,
    body::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }

    .logo_height{
      height: 1.5rem;
    }
    #main-header.header-transparent .header-logo { filter: brightness(0) invert(1); }
    #main-header.header-scrolled .header-logo    { filter: none; }
    #main-header.header-transparent .header-wordmark .skyfare-text  { color: #ffffff; }
    #main-header.header-transparent .header-wordmark .altitude-text { color: rgba(255,255,255,0.65); }
    #main-header.header-scrolled   .header-wordmark .skyfare-text  { color: #0C4A6E; }
    #main-header.header-scrolled   .header-wordmark .altitude-text { color: #94a3b8; }

    .header-newsletter-link {
      isolation: isolate;
      color: #0057b8;
      font-weight: 800;
      letter-spacing: 0.01em;
    }
    .header-newsletter-link .newsletter-free-badge {
      display: inline-flex;
      align-items: center;
      height: 1.05rem;
      padding: 0 0.38rem;
      border-radius: 9999px;
      background: rgba(201, 162, 39, 0.12);
      color: #9a7618;
      border: 1px solid rgba(201, 162, 39, 0.22);
      font-size: 0.55rem;
      font-weight: 900;
      line-height: 1;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      transform: translateY(-1px);
    }
    .header-newsletter-link::after {
      height: 2px;
      bottom: -4px;
      background: linear-gradient(90deg, #0066cc 0%, #C9A227 52%, #0066cc 100%);
      transform-origin: left;
      transition: transform .32s var(--ease-v2-out, cubic-bezier(.16,1,.3,1));
    }
    .header-newsletter-link:hover,
    .header-newsletter-link:focus-visible {
      color: #004a9f;
    }
    .header-newsletter-link:hover i,
    .header-newsletter-link:focus-visible i {
      color: #C9A227;
      opacity: 1;
    }
    #main-header.header-transparent .header-newsletter-link {
      color: #ffffff;
    }
    #main-header.header-transparent .header-newsletter-link .newsletter-free-badge {
      color: #ffffff;
      background: rgba(201, 162, 39, 0.22);
      border-color: rgba(255,255,255,0.26);
    }
    #main-header.header-transparent .header-newsletter-link:hover,
    #main-header.header-transparent .header-newsletter-link:focus-visible {
      color: #ffffff;
    }
    #main-header.header-transparent .header-newsletter-link::after {
      background: linear-gradient(90deg, #ffffff 0%, #C9A227 52%, #ffffff 100%);
    }
    @media (prefers-reduced-motion: reduce) {
      .header-newsletter-link::after { transition: none !important; }
    }

    .header-menu-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 9999px;
      color: #0C4A6E;
      background: rgba(0,102,204,0.07);
      border: 1px solid rgba(0,102,204,0.16);
      transition:
        transform .16s var(--ease-v2-out, cubic-bezier(.16,1,.3,1)),
        background-color .22s var(--ease-v2-out, cubic-bezier(.16,1,.3,1)),
        border-color .22s var(--ease-v2-out, cubic-bezier(.16,1,.3,1));
    }
    .header-menu-trigger:hover,
    .header-menu-trigger:focus-visible {
      background: rgba(0,102,204,0.12);
      border-color: rgba(0,102,204,0.26);
    }
    .header-menu-trigger:active { transform: scale(0.95); }
    #main-header.header-transparent .header-menu-trigger {
      color: #ffffff;
      background: rgba(255,255,255,0.10);
      border-color: rgba(255,255,255,0.28);
    }
    #main-header.header-transparent .header-menu-trigger:hover,
    #main-header.header-transparent .header-menu-trigger:focus-visible {
      background: rgba(255,255,255,0.16);
      border-color: rgba(255,255,255,0.42);
    }
    #mobileMenuBackdrop {
      transition: opacity .22s var(--ease-v2-out, cubic-bezier(.16,1,.3,1));
    }
    #mobileMenuContent {
      transform: translateX(100%);
      transition: transform .26s cubic-bezier(0.32, 0.72, 0, 1);
      will-change: transform;
    }
    .menu-action-primary,
    .menu-action-secondary,
    .menu-link-row,
    .menu-social-link {
      transition:
        transform .16s var(--ease-v2-out, cubic-bezier(.16,1,.3,1)),
        background-color .2s var(--ease-v2-out, cubic-bezier(.16,1,.3,1)),
        border-color .2s var(--ease-v2-out, cubic-bezier(.16,1,.3,1)),
        color .2s var(--ease-v2-out, cubic-bezier(.16,1,.3,1));
    }
    .menu-action-primary:active,
    .menu-action-secondary:active,
    .menu-link-row:active,
    .menu-social-link:active {
      transform: scale(0.98);
    }
    @media (prefers-reduced-motion: reduce) {
      .header-menu-trigger,
      #mobileMenuBackdrop,
      #mobileMenuContent,
      .menu-action-primary,
      .menu-action-secondary,
      .menu-link-row,
      .menu-social-link {
        transition: none !important;
      }
    }

    /* Header CTA (Altitude Access) */
    .header-cta-icon {
      position: relative;
      display: inline-flex;
      align-items: center;
      height: 2.75rem;
      min-width: 2.75rem;
      border-radius: 9999px;
      overflow: visible;
      white-space: nowrap;
      padding: 0 0.6875rem;
      font-family: 'Manrope', sans-serif;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      border: 1.5px solid transparent;
      transition:
        transform .16s var(--ease-v2-out, ease),
        background-color .22s var(--ease-v2-out, ease),
        border-color .22s var(--ease-v2-out, ease),
        box-shadow .22s var(--ease-v2-out, ease);
    }
    .header-cta-icon:active { transform: scale(0.95); }
    /* Label floats outside the button's own box (position: absolute) so it can
       fade/slide into view via transform+opacity only -- the button's box
       itself never resizes, so hovering never triggers layout, only paint. */
    .header-cta-icon .cta-label {
      position: absolute;
      left: 100%;
      top: 50%;
      margin-left: 0.5rem;
      display: inline-block;
      white-space: nowrap;
      pointer-events: none;
      transform: translateY(-50%) translateX(-6px);
      opacity: 0;
      transition: transform .22s var(--ease-v2-out, ease), opacity .18s var(--ease-v2-out, ease);
    }
    .header-cta-icon:hover .cta-label,
    .header-cta-icon:focus-visible .cta-label {
      transform: translateY(-50%) translateX(0);
      opacity: 1;
    }
    .header-cta-gold { background: #C9A227; color: #ffffff; }
    .header-cta-outline { background: transparent; color: #1b70ef; border-color: #1b70ef; }
    .header-cta-tooltip .cta-label {
      left: 50%;
      top: calc(100% + 0.55rem);
      margin-left: 0;
      padding: 0.45rem 0.65rem;
      border-radius: 9999px;
      background: #0f172a;
      color: #ffffff;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.18);
      font-size: 0.75rem;
      line-height: 1;
      transform: translateX(-50%) translateY(-4px);
    }
    .header-cta-tooltip .cta-label::before {
      content: "";
      position: absolute;
      left: 50%;
      top: -4px;
      width: 8px;
      height: 8px;
      background: #0f172a;
      transform: translateX(-50%) rotate(45deg);
    }
    .header-cta-tooltip:hover .cta-label,
    .header-cta-tooltip:focus-visible .cta-label {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    @media (hover: hover) and (pointer: fine) {
      .header-cta-gold:hover { background: #B58D1D; }
      .header-cta-outline:hover { background: rgba(27,112,239,0.08); }
    }
    @media (prefers-reduced-motion: reduce) {
      .header-cta-icon, .header-cta-icon .cta-label {
        transition: none !important;
      }
    }

    /* Altitude Access -- always-visible label, calm premium treatment. */
    .header-cta-altitude {
      min-width: 0;
      padding: 0 1.15rem 0 0.9rem;
      gap: 0.1rem;
      background: #C9A227;
      box-shadow: 0 8px 20px rgba(201, 162, 39, 0.24);
    }
    .header-cta-altitude:hover {
      box-shadow: 0 12px 26px rgba(201, 162, 39, 0.30);
      transform: translateY(-1px);
    }
    .header-cta-altitude:active { transform: scale(0.95); }
    .header-cta-altitude .cta-label {
      position: static;
      transform: none;
      pointer-events: auto;
      max-width: 200px;
      opacity: 1;
      margin-left: 0.5rem;
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    /* The generic .header-cta-icon:hover .cta-label rule (higher specificity
       via :hover) would otherwise re-apply its translateY(-50%) to this
       always-visible, in-flow label, making the text drift upward on hover.
       Pin it back to no transform at matching specificity. */
    .header-cta-altitude:hover .cta-label,
    .header-cta-altitude:focus-visible .cta-label {
      transform: none;
    }
    .header-cta-altitude i {
      font-size: 1.05rem;
    }
    @media (prefers-reduced-motion: reduce) {
      .header-cta-altitude { transform: none !important; }
    }
    /* Legacy helper for any future always-visible secondary header CTA. */
    .header-cta-solo {
      min-width: 0;
      padding: 0 1.15rem 0 0.9rem;
    }
    .header-cta-solo .cta-label {
      position: static;
      transform: none;
      pointer-events: auto;
      opacity: 1;
      margin-left: 0.5rem;
    }
    .header-cta-solo:hover .cta-label,
    .header-cta-solo:focus-visible .cta-label {
      transform: none;
    }

    /* Dark-photo heroes (.header-transparent): flip the outline CTA to white
       so it stays legible before the header goes solid on scroll -- same
       treatment the old .book-now-btn had. The gold CTA needs no override,
       its fill/white-text contrast already works on both dark and light. */
    #main-header.header-transparent .header-cta-outline {
      border-color: rgba(255, 255, 255, 0.7);
      color: #ffffff;
      background: transparent;
    }
    @media (hover: hover) and (pointer: fine) {
      #main-header.header-transparent .header-cta-outline:hover {
        background: rgba(255, 255, 255, 0.1);
      }
    }
  `;
  /* Loader + mobile-menu CSS now live in css/style.css (loads synchronously). */
  document.head.appendChild(style);


  const headerHTML = `
    <header id="main-header" class="fixed top-0 left-0 right-0 z-50">
      <div class="container mx-auto flex items-center justify-between py-3 px-4 md:px-6">
        <!-- Logo -->
        <a href="/" class="inline-flex items-center gap-2.5 group">
          <img src="${window.location.pathname.includes('/pages/') ? '../' : ''}logos/logo.webp" alt="Skyfare Consulting Logo" class="header-logo h-9 w-auto object-contain transition-all duration-500 group-hover:scale-105 flex-shrink-0">
          <div class="header-wordmark flex flex-col leading-none select-none">
            <span class="skyfare-text text-[13px] font-black uppercase tracking-[0.14em] text-brand-900 transition-colors duration-300">SKYFARE</span>
            <span class="altitude-text text-[9px] font-bold uppercase tracking-[0.22em] text-neutral-400 transition-colors duration-300 mt-0.5">CONSULTING</span>
          </div>
        </a>

        <!-- Desktop nav -->
        <nav class="hidden lg:flex items-center gap-0.5 xl:gap-1 text-[13px] xl:text-[15px] absolute left-1/2 -translate-x-1/2" id="desktop-nav">
          <!-- Services Dropdown (merged) -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold whitespace-nowrap">
              <i class="fa-solid fa-layer-group text-[13px] opacity-60"></i> Services
              <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:320px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <p class="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2 px-3">Our Services</p>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-layer-group text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Overview</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">All Skyfare services in one place</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-plane-circle-check text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">KrisFlyer Miles</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Nominee redemptions and direct transfers</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-phone-volume text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Travel Strategy Call</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">A paid 1-on-1 planning session</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/cabin-compare" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-scale-balanced text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Cabin Compare</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Seats, Wi-Fi, and miles by airline</div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <!-- Flights Dropdown (Our Flights / Skyfare Flight) -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold whitespace-nowrap">
              <i class="fa-solid fa-plane text-[13px] opacity-60"></i> Flights <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:300px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-ticket-simple text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Our Flights</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Real bookings we've arranged for clients</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-paper-plane text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Skyfare Flight</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">One person flies free, every quarter</div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works" class="nav-link px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-wand-magic-sparkles text-[13px] opacity-60"></i> How It Works
          </a>

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter" class="nav-link header-newsletter-link px-2 xl:px-3 py-2 transition-colors flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-newspaper text-[13px] opacity-70 transition-colors"></i>
            <span>Newsletter</span>
            <span class="newsletter-free-badge">Free</span>
          </a>
          <!-- Resources Dropdown (Testimonials / FAQs / Contact) -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold whitespace-nowrap">
              <i class="fa-solid fa-book-open text-[13px] opacity-60"></i> Resources <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:300px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/testimonials" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-star text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Testimonials</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">What clients say about flying with us</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/faq" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-circle-question text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">FAQs</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Answers on miles, bookings, and fees</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer-guide" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-book text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">KrisFlyer Guide</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Learn the mileage system yourself — coming soon</div>
                  </div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact" class="flex items-start gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-envelope text-sm"></i>
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold text-brand-950">Contact</div>
                    <div class="text-[11px] text-neutral-400 leading-snug mt-0.5">Reach the Skyfare team directly</div>
                  </div>
                </a>
              </div>
            </div>
          </div>
        </nav>

        <!-- Right side CTAs -->
        <div class="hidden lg:flex items-center gap-2.5 ml-auto">
          <button id="desktopMenuBtn" type="button" class="header-menu-trigger" aria-label="Open menu" aria-controls="mobileMenu" aria-expanded="false">
            <i class="fa-solid fa-bars-staggered text-lg" aria-hidden="true"></i>
          </button>
        </div>

        <!-- Mobile menu button -->
        <button id="mobileMenuBtn" type="button" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-brand-50 text-brand-600" aria-label="Open menu" aria-controls="mobileMenu" aria-expanded="false">
          <i class="fa-solid fa-bars-staggered text-xl" aria-hidden="true"></i>
        </button>
      </div>
    </header>

    <!-- Mobile Menu Drawer -->
    <div id="mobileMenu" class="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <!-- Backdrop -->
      <div id="mobileMenuBackdrop" class="absolute inset-0 bg-deepblue-950/80 backdrop-blur-sm opacity-0 transition-opacity duration-500"></div>
      
      <!-- Content -->
      <div id="mobileMenuContent" class="absolute top-0 right-0 w-[min(92vw,440px)] h-full bg-white shadow-2xl pointer-events-auto overflow-y-auto">
        <div class="min-h-full p-5 sm:p-6 flex flex-col">
          <div class="flex items-center justify-between mb-7">
            <div>
              <span class="block text-[10px] uppercase tracking-[0.18em] text-gold font-black mb-1">Menu</span>
              <span class="text-2xl font-display font-bold text-brand-950 tracking-tight">Skyfare Consulting</span>
            </div>
            <button id="closeMobileMenu" type="button" class="w-10 h-10 flex items-center justify-center rounded-full bg-brand-50 text-brand-600" aria-label="Close menu">
              <i class="fa-solid fa-xmark text-xl" aria-hidden="true"></i>
            </button>
          </div>

          <nav class="flex flex-col gap-1.5 pt-5 border-t border-brand-100" id="mobile-nav" aria-label="Site menu">
            <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2 mb-2">
              <i class="fa-solid fa-bolt text-[10px]" aria-hidden="true"></i> Quick Access
            </span>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-layer-group text-brand-400 w-5 text-sm" aria-hidden="true"></i> Services
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-brand-700 bg-brand-50 hover:bg-brand-100">
              <i class="fa-solid fa-newspaper text-brand-500 w-5 text-sm" aria-hidden="true"></i> Newsletter
              <span class="ml-auto text-[9px] font-bold uppercase tracking-wide text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Free</span>
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-plane-circle-check text-brand-400 w-5 text-sm" aria-hidden="true"></i> KrisFlyer Miles
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/cabin-compare" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-scale-balanced text-brand-400 w-5 text-sm" aria-hidden="true"></i> Cabin Compare
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-paper-plane text-brand-400 w-5 text-sm" aria-hidden="true"></i> Skyfare Flight
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/testimonials" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-star text-brand-400 w-5 text-sm" aria-hidden="true"></i> Testimonials
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact" class="menu-link-row flex items-center gap-3 rounded-xl px-3 py-2.5 text-neutral-700 hover:text-brand-700 hover:bg-brand-50">
              <i class="fa-solid fa-envelope text-brand-400 w-5 text-sm" aria-hidden="true"></i> Contact
            </a>
          </nav>

          <div class="flex flex-col gap-2 mt-6 pt-6 border-t border-brand-100">
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/altitude" class="menu-action-secondary flex items-center justify-center gap-3 w-full rounded-xl bg-gold px-4 py-3.5 text-white font-bold shadow-sm hover:bg-[#B58D1D]">
              <i class="fa-solid fa-crown" aria-hidden="true"></i>
              <span>Altitude Access</span>
            </a>
            <a href="${(window.SKYFARE_LINKS && window.SKYFARE_LINKS.whatsapp) || 'https://api.whatsapp.com/send?phone=6581575306'}" target="_blank" rel="noopener noreferrer" class="menu-action-primary flex items-center justify-center gap-3 w-full rounded-xl bg-brand-600 px-4 py-3.5 text-white font-bold shadow-sm hover:bg-brand-700">
              <i class="fa-solid fa-plane-departure" aria-hidden="true"></i>
              <span>Book a Flight</span>
            </a>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button type="button" data-header-altitude-plan="monthly" class="menu-action-secondary flex items-center justify-center gap-2 rounded-xl border border-gold/25 bg-white px-3 py-3 text-sm font-bold text-brand-950 hover:border-gold/45 hover:bg-gold/10">
                <i class="fa-solid fa-calendar-days text-gold" aria-hidden="true"></i>
                Subscribe Monthly
              </button>
              <button type="button" data-header-altitude-plan="annual" class="menu-action-secondary flex items-center justify-center gap-2 rounded-xl border border-gold/25 bg-white px-3 py-3 text-sm font-bold text-brand-950 hover:border-gold/45 hover:bg-gold/10">
                <i class="fa-solid fa-crown text-gold" aria-hidden="true"></i>
                Subscribe Annual
              </button>
            </div>
            <div class="flex items-center gap-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-neutral-400">
              <span class="h-px flex-1 bg-brand-100"></span>
              <span>or</span>
              <span class="h-px flex-1 bg-brand-100"></span>
            </div>
            <button type="button" data-header-member-login class="menu-action-secondary flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-white px-4 py-3 text-sm font-bold text-brand-700 hover:border-brand-200 hover:bg-brand-50">
              <i class="fa-solid fa-key" aria-hidden="true"></i>
              Already a member
            </button>
          </div>

          <div class="mt-auto pt-6 border-t border-brand-100">
            <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2 mb-3">
              <i class="fa-solid fa-hashtag text-[10px]" aria-hidden="true"></i> Social
            </span>
            <div class="flex items-center gap-2">
              <a href="${(window.SKYFARE_LINKS && window.SKYFARE_LINKS.instagram && window.SKYFARE_LINKS.instagram.url) || '#'}" target="_blank" rel="noopener noreferrer" class="menu-social-link w-10 h-10 rounded-full border border-brand-100 text-brand-600 flex items-center justify-center hover:bg-brand-50" aria-label="Instagram">
                <i class="fa-brands fa-instagram" aria-hidden="true"></i>
              </a>
              <a href="${(window.SKYFARE_LINKS && window.SKYFARE_LINKS.tiktok && window.SKYFARE_LINKS.tiktok.consulting && window.SKYFARE_LINKS.tiktok.consulting.url) || '#'}" target="_blank" rel="noopener noreferrer" class="menu-social-link w-10 h-10 rounded-full border border-brand-100 text-brand-600 flex items-center justify-center hover:bg-brand-50" aria-label="TikTok">
                <i class="fa-brands fa-tiktok" aria-hidden="true"></i>
              </a>
              <a href="${(window.SKYFARE_LINKS && window.SKYFARE_LINKS.facebook && window.SKYFARE_LINKS.facebook.url) || '#'}" target="_blank" rel="noopener noreferrer" class="menu-social-link w-10 h-10 rounded-full border border-brand-100 text-brand-600 flex items-center justify-center hover:bg-brand-50" aria-label="Facebook">
                <i class="fa-brands fa-facebook-f" aria-hidden="true"></i>
              </a>
              <a href="${(window.SKYFARE_LINKS && window.SKYFARE_LINKS.whatsapp) || 'https://api.whatsapp.com/send?phone=6581575306'}" target="_blank" rel="noopener noreferrer" class="menu-social-link w-10 h-10 rounded-full border border-brand-100 text-brand-600 flex items-center justify-center hover:bg-brand-50" aria-label="WhatsApp">
                <i class="fa-brands fa-whatsapp" aria-hidden="true"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject into body at the start
  document.body.insertAdjacentHTML('afterbegin', headerHTML);
  document.getElementById('main-header').classList.add('header-enter');

  // Transparent-on-hero / solid-on-scroll header logic. Dark-photo heroes
  // (.hero-brand-fade on interior pages, .page-hero-bg, and .hero-photo-section
  // on the homepage's full-bleed video hero): header floats transparently over
  // the photo/video with white nav text, then becomes a solid white bar with
  // shadow/blur (.header-scrolled) once scrolled.
  const headerEl = document.getElementById('main-header');
  const darkHeroSection = document.querySelector('.hero-brand-fade, .page-hero-bg, .hero-photo-section');

  if (darkHeroSection && headerEl) {
    function updateHeaderState() {
      if (window.scrollY > 10) {
        headerEl.classList.remove('header-transparent');
        headerEl.classList.add('header-scrolled');
      } else {
        headerEl.classList.add('header-transparent');
        headerEl.classList.remove('header-scrolled');
      }
    }

    window.addEventListener('scroll', updateHeaderState, { passive: true });
  }

  // Reading headerEl.offsetHeight synchronously right after injection can catch
  // the header before the Tailwind CDN script has applied its utility classes
  // (e.g. the dropdown menu's absolute positioning) -- mid-flash, the header can
  // measure 500+px instead of its real ~75px. Deferring one frame guarantees
  // Tailwind has settled before anything reads its height.
  requestAnimationFrame(() => {
    if (darkHeroSection && headerEl) {
      // Dark photo hero: float header transparently over it, with extra
      // clearance so the hero's own overlaid content starts below the header.
      document.body.style.paddingTop = '0';
      darkHeroSection.style.paddingTop = (headerEl.offsetHeight + 32) + 'px';
      headerEl.classList.add('header-transparent');
    } else if (headerEl) {
      // Non-hero page: solid header from the start
      document.body.style.paddingTop = headerEl.offsetHeight + 'px';
      headerEl.classList.add('header-scrolled');
    }
  });

  // --- Global Intersection Observer for Animations ---
  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.slide-up').forEach(el => {
    observer.observe(el);
  });

  // --- Logic for Mobile Menu ---
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const desktopMenuBtn = document.getElementById('desktopMenuBtn');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');
  const mobileMenuContent = document.getElementById('mobileMenuContent');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const menuTriggers = [mobileMenuBtn, desktopMenuBtn].filter(Boolean);
  const WORKER = 'https://skyfares-altitude.klent-5fa.workers.dev';

  function openMenu() {
    mobileMenu.classList.remove('pointer-events-none');
    mobileMenuBackdrop.classList.add('opacity-100');
    mobileMenuContent.style.transform = 'translateX(0)';
    menuTriggers.forEach(function (btn) { btn.setAttribute('aria-expanded', 'true'); });
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.add('pointer-events-none');
    mobileMenuBackdrop.classList.remove('opacity-100');
    mobileMenuContent.style.transform = 'translateX(100%)';
    menuTriggers.forEach(function (btn) { btn.setAttribute('aria-expanded', 'false'); });
    document.body.style.overflow = '';
  }

  function handleHeaderCheckout(event, plan) {
    event.preventDefault();
    var btn = event.currentTarget;
    var originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('opacity-70');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-[11px]" aria-hidden="true"></i> Redirecting';

    fetch(WORKER + '/altitude/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: plan || 'monthly' }),
    })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, data: d }; }); })
      .then(function (res) {
        if (res.ok && res.data.url) {
          window.location.href = res.data.url;
          return;
        }
        if (window.SkyUI) SkyUI.toast(res.data.error || 'Could not start checkout. Please try again.', { type: 'error' });
        btn.disabled = false;
        btn.classList.remove('opacity-70');
        btn.innerHTML = originalHtml;
      })
      .catch(function () {
        if (window.SkyUI) SkyUI.toast('Network error. Please try again.', { type: 'error' });
        btn.disabled = false;
        btn.classList.remove('opacity-70');
        btn.innerHTML = originalHtml;
      });
  }

  menuTriggers.forEach(function (btn) { btn.addEventListener('click', openMenu); });
  closeMobileMenu.addEventListener('click', closeMenu);
  mobileMenuBackdrop.addEventListener('click', closeMenu);
  mobileMenuContent.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      if (!link.target || link.target === '_self') closeMenu();
    });
  });
  mobileMenuContent.querySelectorAll('[data-header-altitude-plan]').forEach(function (btn) {
    btn.addEventListener('click', function (event) {
      handleHeaderCheckout(event, btn.getAttribute('data-header-altitude-plan') || 'monthly');
    });
  });
  mobileMenuContent.querySelectorAll('[data-header-member-login]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      closeMenu();
      setTimeout(function () {
        if (window.openLoginModal) window.openLoginModal();
      }, 180);
    });
  });

  // --- Global UI components (SkyUI: toast / modal / alert) ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/ui.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  // --- Global magic-link modal (shared by the header's "Altitude Access"
  //     button, pages/altitude.html's "Already a Member?" trigger, and
  //     pages/altitude-success.html's post-checkout confirmation -- one
  //     modal, not a per-page copy). Markup lives in
  //     components/magic-modal.html, fetched/injected by js/magic-modal.js. ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/magic-modal.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  // --- Shared success-modal confetti (window.fireBrandConfetti), used by
  //     js/magic-modal.js, js/krisflyer-guide.js, and
  //     js/assessment-checkout.js. Loaded globally like the modal script
  //     above so it's ready before any of those call it. ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/confetti.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  // --- Newsletter Announcement Banner ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/newsletter-banner.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  // --- Global error / offline handler ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/error-handler.js';
    s.defer = true;
    document.head.appendChild(s);
  })();

  // --- Page Loader ---
  // The #page-loader div is static HTML (first child of <body> in every page).
  // CSS is in style.css so it covers the screen before any content renders.
  // This IIFE just handles the fade-out once the page is fully loaded.
  (function () {
    var loader = document.getElementById('page-loader');
    if (!loader) return;

    var shownAt = Date.now();
    var MIN_MS  = 600; // minimum visible time — prevents flash on cached/fast pages

    window.addEventListener('load', function () {
      var wait = Math.max(0, MIN_MS - (Date.now() - shownAt));
      setTimeout(function () {
        loader.classList.add('loader-out');
        setTimeout(function () {
          if (loader.parentNode) loader.parentNode.removeChild(loader);
        }, 520);
      }, wait);
    });
  })();

  // --- Logic for Active Links ---
  const currentPath = (window.location.pathname.split('/').pop() || '').replace(/\.html$/, '') || 'index';

  // Desktop links
  const desktopLinks = document.querySelectorAll('#desktop-nav a');
  desktopLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const linkPath = href.split('#')[0].split('/').pop();
      if (linkPath === currentPath) {
        link.classList.add('text-brand-900', 'font-semibold');
        link.classList.remove('text-neutral-600');

        // Check if inside a dropdown
        const parentDropdown = link.closest('.group\\/dropdown');
        if (parentDropdown) {
          const btn = parentDropdown.querySelector('button');
          if (btn) {
            btn.classList.add('text-brand-500');
            btn.classList.remove('text-neutral-600');
          }
        }
      }
    }
  });

  // Mobile links
  const mobileLinks = document.querySelectorAll('#mobile-nav a');
  mobileLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (href) {
      const linkPath = href.split('#')[0].split('/').pop();
      if (linkPath === currentPath) {
        link.classList.add('text-brand-600', 'font-semibold');
        link.classList.remove('text-neutral-600');
      }
    }
  });

});
