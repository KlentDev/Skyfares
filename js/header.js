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
  `;
  /* Loader + mobile-menu CSS now live in css/style.css (loads synchronously). */
  document.head.appendChild(style);


  const headerHTML = `
    <header id="main-header" class="fixed top-0 left-0 right-0 z-50">
      <div class="container mx-auto flex items-center justify-between py-3 px-4 md:px-6">
        <!-- Logo -->
        <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}index.html" class="inline-flex items-center gap-2.5 group">
          <img src="${window.location.pathname.includes('/pages/') ? '../' : ''}logos/logo.webp" alt="Skyfare Consulting Logo" class="header-logo h-9 w-auto object-contain transition-all duration-500 group-hover:scale-105 flex-shrink-0">
          <div class="header-wordmark flex flex-col leading-none select-none">
            <span class="skyfare-text text-[13px] font-black uppercase tracking-[0.14em] text-brand-900 transition-colors duration-300">SKYFARE</span>
            <span class="altitude-text text-[9px] font-bold uppercase tracking-[0.22em] text-neutral-400 transition-colors duration-300 mt-0.5">CONSULTING</span>
          </div>
        </a>

        <!-- Desktop nav -->
        <nav class="hidden lg:flex items-center gap-1 text-[15px] absolute left-1/2 -translate-x-1/2" id="desktop-nav">
          <!-- Services Dropdown (merged) -->
          <div class="relative group/dropdown">
            <button class="flex items-center gap-1.5 px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold">
              <i class="fa-solid fa-layer-group text-[13px] opacity-60"></i> Services <i class="fa-solid fa-chevron-down text-[11px] transition-transform group-hover/dropdown:rotate-180"></i>
            </button>
            <div class="absolute top-full left-0 pt-2 opacity-0 translate-y-2 pointer-events-none group-hover/dropdown:opacity-100 group-hover/dropdown:translate-y-0 group-hover/dropdown:pointer-events-auto transition-all duration-300" style="width:460px;">
              <div class="bg-white rounded-2xl shadow-xl border border-brand-100 overflow-hidden p-4">
                <div class="grid grid-cols-2 gap-x-2">
                  <!-- Left: Our Services -->
                  <div>
                    <p class="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2 px-3">Our Services</p>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services.html" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-layer-group text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Overview</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer.html" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-plane-circle-check text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">KrisFlyer Miles</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment.html" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-phone-volume text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Assessment Call</div>
                    </a>
                  </div>
                  <!-- Right: Extra Services -->
                  <div class="border-l border-brand-100 pl-2">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-brand-400 mb-2 px-3">Extra Services</p>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/chauffeur.html" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-car text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Chauffeur</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#concierge" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
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

          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-wand-magic-sparkles text-[13px] opacity-60"></i> How It Works
          </a>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-ticket-simple text-[13px] opacity-60"></i> Our Flights
          </a>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-paper-plane text-[13px] opacity-60"></i> Skyfare Flight
          </a>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-envelope-open-text text-[13px] opacity-60"></i> Newsletter
          </a>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/faq.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-circle-question text-[13px] opacity-60"></i> FAQ
          </a>
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact.html" class="nav-link px-3 py-2 text-neutral-600 hover:text-brand-500 transition-colors font-semibold flex items-center gap-2">
            <i class="fa-solid fa-envelope text-[13px] opacity-60"></i> Contact
          </a>
        </nav>

        <!-- Right side: Book a Flight button -->
        <div class="hidden lg:flex items-center gap-3 ml-auto">
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/book.html"
            class="book-now-btn inline-flex items-center gap-2 rounded-xl border border-white/70 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10 hover:-translate-y-0.5 transition-all active:scale-95">
            <i class="fa-solid fa-calendar-check text-lg"></i>
            Book a Flight
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
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/services.html" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-layer-group text-brand-400 w-6 text-base"></i> Overview
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/krisflyer.html" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-plane-circle-check text-brand-400 w-6 text-base"></i> KrisFlyer Miles
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/assessment.html" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-phone-volume text-brand-400 w-6 text-base"></i> Assessment Call
              </a>
            </div>
            <div class="flex flex-col gap-4">
              <span class="text-xs uppercase tracking-widest text-brand-500 font-bold flex items-center gap-2">
                <i class="fa-solid fa-square-plus text-[10px]"></i> Extra Services
              </span>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/chauffeur.html" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-car text-brand-400 w-6 text-base"></i> Chauffeur
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#concierge" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-concierge-bell text-brand-400 w-6 text-base"></i> Concierge Services
              </a>
            </div>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-wand-magic-sparkles text-brand-500 w-7"></i> How It Works
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-ticket-simple text-brand-500 w-7"></i> Our Flights
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/the-skyfare-flight.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-paper-plane text-brand-500 w-7"></i> Skyfare Flight
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/newsletter.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-envelope-open-text text-brand-500 w-7"></i> Newsletter
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/faq.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-circle-question text-brand-500 w-7"></i> FAQ
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/contact.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-envelope text-brand-500 w-7"></i> Contact
            </a>
          </nav>
          
          <div class="mt-auto pt-10">
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/book.html" class="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-brand-600 text-white font-semibold shadow-lg">
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

  // Transparent-on-hero / solid-on-scroll header logic
  const headerEl = document.getElementById('main-header');
  const heroSection = document.querySelector('.hero-brand-fade');

  if (heroSection && headerEl) {
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
    if (heroSection && headerEl) {
      // Hero page: float header transparently over the hero
      document.body.style.paddingTop = '0';
      heroSection.style.paddingTop = (headerEl.offsetHeight + 32) + 'px';
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


  // --- Global UI components (SkyUI: toast / modal / alert) ---
  (function () {
    var s = document.createElement('script');
    s.src = (window.location.pathname.includes('/pages/') ? '../' : '') + 'js/ui.js';
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
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';

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
