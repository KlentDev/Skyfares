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

  `;
  /* Loader + mobile-menu CSS now live in css/style.css (loads synchronously). */
  document.head.appendChild(style);


  const headerHTML = `
    <header id="main-header" class="fixed top-0 left-0 right-0 z-50">
      <div class="container mx-auto flex items-center justify-between py-3 px-4 md:px-6">
        <!-- Logo -->
        <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}index.html" class="flex items-center space-x-3 group">
          <div class="relative">
            <img src="${window.location.pathname.includes('/pages/') ? '../' : ''}logos/logo.webp" alt="Skyfare Consulting Logo" class="h-12 w-auto object-contain transition-transform duration-500 group-hover:scale-110">
            <div class="absolute inset-0 bg-brand-300/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </div>
          <div class="flex flex-col">
            <span class="text-lg md:text-xl uppercase font-bold text-brand-900 leading-none tracking-[0.1em] logo_height">Skyfare</span>
            <span class="text-[10px] md:text-xs uppercase tracking-[0.2em] text-brand-900 font-semibold leading-none">Consulting</span>
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
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#fast-track" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-bolt text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Fast Track</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#visa" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-passport text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Visa Assistance</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#bookings" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-plane-up text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Flight Bookings</div>
                    </a>
                    <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#hotels" class="flex items-center gap-3 p-3 rounded-xl hover:bg-brand-50 transition-colors group/item">
                      <div class="w-8 h-8 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600 group-hover/item:scale-110 transition-transform flex-shrink-0">
                        <i class="fa-solid fa-hotel text-sm"></i>
                      </div>
                      <div class="text-sm font-semibold text-brand-950">Hotel Recommendations</div>
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
            <i class="fa-solid fa-ticket-simple text-[13px] opacity-60"></i> Flights We've Arranged
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

        <!-- Right side: Book Now button -->
        <div class="hidden lg:flex items-center gap-3 ml-auto">
          <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/book.html"
            class="book-now-btn inline-flex items-center gap-2 rounded-xl border border-white/70 px-6 py-2.5 text-sm font-semibold text-white hover:bg-white/10 hover:-translate-y-0.5 transition-all active:scale-95">
            <i class="fa-solid fa-calendar-check text-lg"></i>
            Book Now
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
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#fast-track" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-bolt text-brand-400 w-6 text-base"></i> Fast Track
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#visa" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-passport text-brand-400 w-6 text-base"></i> Visa Assistance
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#bookings" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-plane-up text-brand-400 w-6 text-base"></i> Flight Bookings
              </a>
              <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/extra-services.html#hotels" class="pl-2 border-l-2 border-brand-100 text-neutral-600 hover:text-brand-600 transition-colors text-lg flex items-center gap-3">
                <i class="fa-solid fa-hotel text-brand-400 w-6 text-base"></i> Hotel Recommendations
              </a>
            </div>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/how-it-works.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-wand-magic-sparkles text-brand-500 w-7"></i> How It Works
            </a>
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}pages/past-flight-deals.html" class="text-neutral-600 hover:text-brand-600 transition-colors flex items-center gap-3">
              <i class="fa-solid fa-ticket-simple text-brand-500 w-7"></i> Flights We've Arranged
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
              Book Now
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
    // Hero page: float header transparently over the hero
    document.body.style.paddingTop = '0';
    heroSection.style.paddingTop = (headerEl.offsetHeight + 32) + 'px';
    headerEl.classList.add('header-transparent');

    function updateHeaderState() {
      const heroBottom = heroSection.getBoundingClientRect().bottom;
      if (heroBottom <= headerEl.offsetHeight) {
        headerEl.classList.remove('header-transparent');
        headerEl.classList.add('header-scrolled');
      } else {
        headerEl.classList.add('header-transparent');
        headerEl.classList.remove('header-scrolled');
      }
    }

    window.addEventListener('scroll', updateHeaderState, { passive: true });
  } else if (headerEl) {
    // Non-hero page: solid header from the start
    document.body.style.paddingTop = headerEl.offsetHeight + 'px';
    headerEl.classList.add('header-scrolled');
  }

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
