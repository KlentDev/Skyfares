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
    
    /* Custom Scrollbar Styles */
    ::-webkit-scrollbar {
      width: 10px;
    }
    
    ::-webkit-scrollbar-track {
      background: #f1f5f9;
    }
    
    ::-webkit-scrollbar-thumb {
      background: #1b70ef;
      border-radius: 10px;
      border: 2px solid transparent;
      background-clip: content-box;
    }
    .logo_height{
      height: 1.5rem;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #1b70ef;
    }
    #main-header.header-transparent .header-logo { filter: brightness(0) invert(1); }
    #main-header.header-scrolled .header-logo    { filter: none; }
    #main-header.header-transparent .header-wordmark .skyfare-text  { color: #ffffff; }
    #main-header.header-transparent .header-wordmark .altitude-text { color: rgba(255,255,255,0.65); }
    #main-header.header-scrolled   .header-wordmark .skyfare-text  { color: #0C4A6E; }
    #main-header.header-scrolled   .header-wordmark .altitude-text { color: #94a3b8; }

    /* Header CTAs (Altitude Access / Book a Flight) */
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
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:460px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <div class="grid grid-cols-2 gap-x-2">
                  <!-- Left: Our Services -->
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2 px-3">Our Services</p>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-layer-group text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Overview</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-plane-circle-check text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">KrisFlyer Miles</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-phone-volume text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Assessment Call</div>
                    </a>
                  </div>
                  <!-- Right: Extra Services -->
                  <div class="border-l border-brand-100 pl-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2 px-3">Extra Services</p>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/chauffeur" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-car text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Chauffeur</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-concierge-bell text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Concierge Services</div>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Flights Dropdown (Our Flights / Skyfare Flight). Cabin Compare is
               TEMPORARILY promoted to its own top-level item below (launch
               visibility window, ~4-6 weeks from 2026-07-15) -- fold it back
               in here as a third entry once that window closes. -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold whitespace-nowrap">
              <i class="fa-solid fa-plane text-[13px] opacity-60"></i> Flights <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:240px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-ticket-simple text-sm"></i>
                  </div>
                  <div class="text-sm font-semibold text-brand-950">Our Flights</div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-paper-plane text-sm"></i>
                  </div>
                  <div class="text-sm font-semibold text-brand-950">Skyfare Flight</div>
                </a>
              </div>
            </div>
          </div>

          <!-- Cabin Compare -- temporary top-level placement for launch
               visibility (see note above). Remove this link once graduated
               back into the Flights dropdown. The "New" badge that used to
               sit here moved to Services / KrisFlyer Miles instead. -->
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/cabin-compare" class="nav-link px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-scale-balanced text-[13px] opacity-60"></i> Cabin Compare
          </a>

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works" class="nav-link px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-wand-magic-sparkles text-[13px] opacity-60"></i> How It Works
          </a>

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter" class="nav-link px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-envelope-open-text text-[13px] opacity-60"></i> Newsletter
          </a>
          <!-- Resources Dropdown (Testimonials / FAQs) -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold whitespace-nowrap">
              <i class="fa-solid fa-book-open text-[13px] opacity-60"></i> Resources <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:240px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/testimonials" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-star text-sm"></i>
                  </div>
                  <div class="text-sm font-semibold text-brand-950">Testimonials</div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/faq" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-circle-question text-sm"></i>
                  </div>
                  <div class="text-sm font-semibold text-brand-950">FAQs</div>
                </a>
                <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer-guide" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                  <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                    <i class="fa-solid fa-book text-sm"></i>
                  </div>
                  <div class="text-sm font-semibold text-brand-950">KrisFlyer Guide</div>
                  <span class="ml-auto text-[9px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Coming Soon</span>
                </a>
              </div>
            </div>
          </div>

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact" class="nav-link px-2 xl:px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-1.5 xl:gap-2 whitespace-nowrap">
            <i class="fa-solid fa-envelope text-[13px] opacity-60"></i> Contact
          </a>
        </nav>

        <!-- Right side: Altitude Access (always-visible label, playful gold
             gradient + pulse -- see .header-cta-altitude) + Book a Flight
             (stays icon-only, expands with a label on hover only). -->
        <div class="hidden lg:flex items-center gap-2.5 ml-auto">
          <button id="header-altitude-btn" type="button"
            onclick="window.openLoginModal && window.openLoginModal();"
            class="header-cta-icon header-cta-gold header-cta-altitude" aria-label="Altitude Access — member login">
            <i class="fa-solid fa-crown text-base flex-shrink-0"></i>
            <span class="cta-label">Altitude Access</span>
          </button>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment"
            class="header-cta-icon header-cta-outline" aria-label="Book a Flight">
            <i class="fa-solid fa-calendar-check text-base flex-shrink-0"></i>
            <span class="cta-label">Book a Flight</span>
          </a>
        </div>

        <!-- Mobile menu button -->
        <button id="mobileMenuBtn" class="lg:hidden w-10 h-10 flex items-center justify-center rounded-xl bg-brand-50 text-brand-600">
          <i class="fa-solid fa-bars-staggered text-xl"></i>
        </button>
      </div>
    </header>

    <!-- Mobile Menu Drawer -->
    <div id="mobileMenu" class="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <!-- Backdrop -->
      <div id="mobileMenuBackdrop" class="absolute inset-0 bg-deepblue-950/80 backdrop-blur-sm opacity-0 transition-opacity duration-500"></div>
      
      <!-- Content -->
      <div id="mobileMenuContent" class="absolute top-0 right-0 w-[80%] h-full bg-white shadow-2xl pointer-events-auto">
        <div class="p-6 flex flex-col h-full">
          <div class="flex items-center justify-between mb-10">
            <span class="text-xl font-semibold text-brand-900">Menu</span>
            <button id="closeMobileMenu" class="w-10 h-10 flex items-center justify-center rounded-full bg-brand-50 text-brand-600">
              <i class="fa-solid fa-xmark text-xl"></i>
            </button>
          </div>
          
          <nav class="flex flex-col gap-7 text-[1.3rem] font-semibold" id="mobile-nav">
            <div class="flex flex-col gap-4">
              <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2">
                <i class="fa-solid fa-layer-group text-[10px]"></i> Our Services
              </span>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-layer-group text-brand-400 w-6 text-base"></i> Overview
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-plane-circle-check text-brand-400 w-6 text-base"></i> KrisFlyer Miles
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-phone-volume text-brand-400 w-6 text-base"></i> Assessment Call
              </a>
            </div>
            <div class="flex flex-col gap-4">
              <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2">
                <i class="fa-solid fa-square-plus text-[10px]"></i> Extra Services
              </span>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/chauffeur" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-car text-brand-400 w-6 text-base"></i> Chauffeur
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-concierge-bell text-brand-400 w-6 text-base"></i> Concierge Services
              </a>
            </div>
            <div class="flex flex-col gap-4">
              <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2">
                <i class="fa-solid fa-plane text-[10px]"></i> Flights
              </span>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-ticket-simple text-brand-400 w-6 text-base"></i> Our Flights
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-paper-plane text-brand-400 w-6 text-base"></i> Skyfare Flight
              </a>
            </div>
            <!-- Cabin Compare -- temporary top-level placement, see desktop nav comment above -->
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/cabin-compare" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-scale-balanced text-brand-500 w-7"></i> Cabin Compare
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-wand-magic-sparkles text-brand-500 w-7"></i> How It Works
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-envelope-open-text text-brand-500 w-7"></i> Newsletter
            </a>
            <div class="flex flex-col gap-4">
              <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2">
                <i class="fa-solid fa-book-open text-[10px]"></i> Resources
              </span>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/testimonials" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-star text-brand-400 w-6 text-base"></i> Testimonials
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/faq" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-circle-question text-brand-400 w-6 text-base"></i> FAQs
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer-guide" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-book text-brand-400 w-6 text-base"></i> KrisFlyer Guide
                <span class="text-[9px] font-bold uppercase tracking-wide text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">Coming Soon</span>
              </a>
            </div>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-envelope text-brand-500 w-7"></i> Contact
            </a>
          </nav>
          
          <div class="mt-auto pt-10 flex flex-col gap-3">
            <button id="mobile-altitude-btn" type="button"
              class="flex items-center justify-center gap-3 w-full py-4 rounded-2xl text-white font-semibold shadow-lg" style="background:#C9A227;">
              <i class="fa-solid fa-crown text-xl"></i>
              Altitude Access
            </button>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment" class="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-brand-600 text-white font-semibold shadow-lg">
              <i class="fa-solid fa-calendar-check text-xl"></i>
              Book a Flight
            </a>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject into body at the start
  document.body.insertAdjacentHTML('afterbegin', headerHTML);

  // Transparent-on-hero / solid-on-scroll header logic. Two hero flavors:
  //  - Dark-photo heroes (.hero-brand-fade on the old homepage hero,
  //    .page-hero-bg on interior pages): header floats transparently over
  //    the photo with white nav text, then becomes a solid white bar with
  //    shadow/blur (.header-scrolled) once scrolled -- the original pattern.
  //  - Light-background hero (.hero-photo-section, current homepage): the
  //    page background around the photo is white, so white nav text would be
  //    invisible. It starts in the header's plain base state (transparent,
  //    default dark nav text) and also gains the solid .header-scrolled bar
  //    on scroll -- same "adds a background on scroll" behavior, dark text
  //    throughout since that's already legible against a light hero.
  const headerEl = document.getElementById('main-header');
  const darkHeroSection = document.querySelector('.hero-brand-fade, .page-hero-bg');
  const lightHeroSection = document.querySelector('.hero-photo-section');

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
  } else if (lightHeroSection && headerEl) {
    function updateHeaderStateLight() {
      if (window.scrollY > 10) {
        headerEl.classList.add('header-scrolled');
      } else {
        headerEl.classList.remove('header-scrolled');
      }
    }

    window.addEventListener('scroll', updateHeaderStateLight, { passive: true });
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
    } else if (lightHeroSection && headerEl) {
      // Light-background hero: header reserves its own space above the hero
      // (no overlap needed), starts transparent, solid bar appears on scroll.
      document.body.style.paddingTop = headerEl.offsetHeight + 'px';
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
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileMenuBackdrop = document.getElementById('mobileMenuBackdrop');
  const mobileMenuContent = document.getElementById('mobileMenuContent');
  const closeMobileMenu = document.getElementById('closeMobileMenu');

  function openMenu() {
    mobileMenu.classList.remove('pointer-events-none');
    mobileMenuBackdrop.classList.add('opacity-100');
    mobileMenuContent.style.transform = 'translateX(0)';
    document.body.style.overflow = 'hidden';
  }

  function closeMenu() {
    mobileMenu.classList.add('pointer-events-none');
    mobileMenuBackdrop.classList.remove('opacity-100');
    mobileMenuContent.style.transform = 'translateX(100%)';
    document.body.style.overflow = '';
  }

  mobileMenuBtn.addEventListener('click', openMenu);
  closeMobileMenu.addEventListener('click', closeMenu);
  mobileMenuBackdrop.addEventListener('click', closeMenu);

  const mobileAltitudeBtn = document.getElementById('mobile-altitude-btn');
  if (mobileAltitudeBtn) {
    mobileAltitudeBtn.addEventListener('click', () => {
      closeMenu();
      window.openLoginModal && window.openLoginModal();
    });
  }


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
