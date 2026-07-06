// Hero Carousel — auto-slide + swipe/drag (translateX-based, not a crossfade)
(function() {
  const track = document.getElementById('hero-carousel-track');
  const slides = document.querySelectorAll('.hero-carousel-item');
  const dots = document.querySelectorAll('.hero-carousel-dot');
  const totalSlides = slides.length;
  let currentSlide = 0;
  let autoSlideInterval;

  if (totalSlides === 0 || !track) return;

  function positionSlides(offsetPercent) {
    const offset = offsetPercent || 0;
    slides.forEach((slide, i) => {
      slide.style.transform = 'translateX(' + ((i - currentSlide) * 100 + offset) + '%)';
    });
  }

  function showSlide(index) {
    currentSlide = (index + totalSlides) % totalSlides;
    positionSlides(0);
    slides.forEach((slide, i) => slide.classList.toggle('active', i === currentSlide));
    dots.forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
  }

  function nextSlide() { showSlide(currentSlide + 1); }

  function goToSlide(index) {
    showSlide(index);
    clearInterval(autoSlideInterval);
    startAutoSlide();
  }

  function startAutoSlide() {
    autoSlideInterval = setInterval(nextSlide, 4000);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => goToSlide(index));
  });

  showSlide(0);
  startAutoSlide();

  track.addEventListener('mouseenter', () => clearInterval(autoSlideInterval));
  track.addEventListener('mouseleave', () => startAutoSlide());

  // --- Swipe / drag support (Pointer Events cover mouse + touch + pen) ---
  let dragging = false;
  let startX = 0;
  let dragOffsetPercent = 0;
  let trackWidth = 0;

  function onPointerDown(e) {
    dragging = true;
    startX = e.clientX;
    trackWidth = track.getBoundingClientRect().width || 1;
    track.classList.add('dragging');
    clearInterval(autoSlideInterval);
  }

  function onPointerMove(e) {
    if (!dragging) return;
    const dx = e.clientX - startX;
    dragOffsetPercent = (dx / trackWidth) * 100;
    positionSlides(dragOffsetPercent);
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');

    const threshold = 12; // % of track width needed to commit to a slide change
    if (dragOffsetPercent <= -threshold) {
      showSlide(currentSlide + 1);
    } else if (dragOffsetPercent >= threshold) {
      showSlide(currentSlide - 1);
    } else {
      positionSlides(0);
    }
    dragOffsetPercent = 0;
    startAutoSlide();
  }

  track.addEventListener('pointerdown', onPointerDown);
  track.addEventListener('pointermove', onPointerMove);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointerleave', endDrag);
  track.addEventListener('pointercancel', endDrag);
})();
