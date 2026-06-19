// Hero Carousel Auto-slide
(function() {
  let currentSlide = 0;
  const slides = document.querySelectorAll('.hero-carousel-item');
  const dots = document.querySelectorAll('.hero-carousel-dot');
  const totalSlides = slides.length;
  let autoSlideInterval;

  if (totalSlides === 0) return;

  function showSlide(index) {
    // Remove active class from all slides and dots
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));

    // Add active class to current slide and dot
    slides[index].classList.add('active');
    dots[index].classList.add('active');
  }

  function nextSlide() {
    currentSlide = (currentSlide + 1) % totalSlides;
    showSlide(currentSlide);
  }

  function goToSlide(index) {
    currentSlide = index;
    showSlide(currentSlide);
    // Reset auto-slide interval
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(nextSlide, 3000); // 3 seconds interval
  }

  // Add click event to dots
  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => goToSlide(index));
  });

  // Start auto-slide
  startAutoSlide();

  // Pause on hover
  const carouselContainer = document.querySelector('.hero-image-panel');
  if (carouselContainer) {
    carouselContainer.addEventListener('mouseenter', () => {
      clearInterval(autoSlideInterval);
    });

    carouselContainer.addEventListener('mouseleave', () => {
      startAutoSlide();
    });
  }
})();
