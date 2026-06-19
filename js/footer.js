/**
 * Footer and WhatsApp Button Injector
 */
document.addEventListener('DOMContentLoaded', () => {
  const footerHTML = `
    <!-- FOOTER -->
    <footer class="bg-deepblue-950 pt-20 pb-10 border-t border-white/5 mt-auto">
      <div class="container mx-auto px-4 md:px-6">
        <div class="grid md:grid-cols-4 gap-12 mb-16">
          <div class="">
            <a href="${window.location.pathname.includes('/pages/') ? '../' : ''}index.html" class="flex items-center space-x-3 group mb-6">
              <div class="relative">
                <img src="${window.location.pathname.includes('/pages/') ? '../' : ''}logos/logo.webp" alt="Skyfare Consulting Logo" class="h-12 w-auto object-contain transition-transform duration-500 group-hover:scale-110 brightness-0 invert">
                <div class="absolute inset-0 bg-brand-300/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </div>
              <div class="flex flex-col">
                <span class="text-lg md:text-xl uppercase  font-bold text-white leading-none logo_height tracking-[0.1em]">Skyfare</span>
                <span class="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white font-semibold leading-none">Consulting</span>
              </div>
            </a>
            <p class="text-brand-100/50 text-sm max-w-sm leading-relaxed">
              Your private flight strategist for Business and First Class travel. We specialize in high-value miles redemptions and luxury concierge services.
            </p>

            <div class="flex gap-4 mt-8">
              <a href="https://api.whatsapp.com/send?phone=6581575306" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-green-500 hover:bg-green-600 transition-all shadow-sm shadow-green-500/30">
                <i class="fa-brands fa-whatsapp"></i>
              </a>
              <a href="https://www.instagram.com/skyfareconsulting/" class="w-10 h-10 rounded-full flex items-center justify-center text-white bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400 hover:opacity-90 transition-all shadow-sm shadow-pink-500/30">
                <i class="fa-brands fa-instagram"></i>
              </a>
            </div>
          </div>
          <div>
            <h4 class="text-white font-bold mb-6">Services</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="pages/krisflyer.html" class="text-brand-100/50 hover:text-white transition-colors">KrisFlyer Miles</a></li>
              <li><a href="pages/chauffeur.html" class="text-brand-100/50 hover:text-white transition-colors">Chauffeur Service</a></li>
              <li><a href="pages/extra-services.html" class="text-brand-100/50 hover:text-white transition-colors">Extra Services</a></li>
            </ul>
          </div>
          
          <div>
            <h4 class="text-white font-bold mb-6">Company</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="/index.html" class="text-brand-100/50 hover:text-white transition-colors">Home</a></li>
              <li><a href="pages/how-it-works.html" class="text-brand-100/50 hover:text-white transition-colors">How It Works</a></li>
              <li><a href="pages/past-flight-deals.html" class="text-brand-100/50 hover:text-white transition-colors">Flights We've Arranged</a></li>
              <li><a href="pages/book.html" class="text-brand-100/50 hover:text-white transition-colors">Book a Strategy Call</a></li>
              <li><a href="pages/assessment.html" class="text-brand-100/50 hover:text-white transition-colors">Free Assessment</a></li>
            </ul>
          </div>

          <div>
            <h4 class="text-white font-bold mb-6">Support</h4>
            <ul class="space-y-4 text-sm">
              <li><a href="pages/faq.html" class="text-brand-100/50 hover:text-white transition-colors">FAQ</a></li>
              <li><a href="pages/contact.html" class="text-brand-100/50 hover:text-white transition-colors">Contact</a></li>
              <li><a href="pages/terms.html" class="text-brand-100/50 hover:text-white transition-colors">Terms & Conditions</a></li>
              <li><a href="pages/privacy.html" class="text-brand-100/50 hover:text-white transition-colors">Privacy Policy</a></li>
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
    <a href="https://api.whatsapp.com/send?phone=6581575306"
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

});
