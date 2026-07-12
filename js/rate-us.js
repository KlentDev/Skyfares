document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('rate-us-form');
  if (!form) return;

  const WORKER_URL = 'https://skyfares-altitude.klent-5fa.workers.dev';

  // Cloudinary unsigned upload — browser uploads directly to Cloudinary, no
  // secret involved.
  const CLOUDINARY_CLOUD_NAME = 'dlaicpbh7';
  const CLOUDINARY_UPLOAD_PRESET = 'skyfare-consulting';
  const CLOUDINARY_UPLOAD_URL = 'https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload';

  const success = document.getElementById('rate-us-form-success');
  const statusEl = document.getElementById('rate-us-status');
  const ratingInput = document.getElementById('rating-value');
  const starButtons = Array.from(document.querySelectorAll('.star-btn'));
  const fileInput = document.getElementById('profile-image-input');
  const imageUrlInput = document.getElementById('profile-image-url');
  const uploadDropzoneLabel = document.getElementById('upload-dropzone-label');
  const uploadProgress = document.getElementById('upload-progress');
  const uploadPreview = document.getElementById('upload-preview');
  const uploadPreviewImg = document.getElementById('upload-preview-img');
  const removeImageBtn = document.getElementById('remove-image-btn');
  const roleSelect = document.getElementById('role');
  const roleOtherWrapper = document.getElementById('role-other-wrapper');
  const roleOtherInput = document.getElementById('role-other');

  let imageUploading = false;

  function loadConfetti(cb) {
    if (typeof confetti === 'function') { cb(); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }

  function fireConfetti() {
    loadConfetti(() => {
      if (typeof confetti !== 'function') return;
      confetti({ particleCount: 110, spread: 75, origin: { x: 0.5, y: 0.4 }, colors: ['#003d7a', '#0066cc', '#38a1ff', '#C9A227', '#ffffff'], zIndex: 9999 });
      setTimeout(() => { confetti({ particleCount: 55, spread: 55, origin: { x: 0.25, y: 0.5 }, colors: ['#0066cc', '#7ac0ff', '#ffffff'], zIndex: 9999 }); }, 180);
      setTimeout(() => { confetti({ particleCount: 55, spread: 55, origin: { x: 0.75, y: 0.5 }, colors: ['#C9A227', '#38a1ff', '#003d7a'], zIndex: 9999 }); }, 340);
    });
  }

  function setStatus(message, isError) {
    if (!statusEl) return;
    statusEl.textContent = message || '';
    statusEl.classList.toggle('hidden', !message);
    statusEl.classList.toggle('text-red-600', !!isError);
    statusEl.classList.toggle('text-neutral-500', !isError);
  }

  // ── Star rating widget ─────────────────────────────────────────────────
  function paintStars(value) {
    starButtons.forEach((btn) => {
      const starValue = parseInt(btn.dataset.starValue, 10);
      const filled = starValue <= value;
      btn.classList.toggle('text-gold', filled);
      btn.classList.toggle('text-neutral-300', !filled);
      btn.setAttribute('aria-checked', String(starValue === value));
    });
  }

  function initStarRating() {
    if (!starButtons.length || !ratingInput) return;

    starButtons.forEach((btn) => {
      const starValue = parseInt(btn.dataset.starValue, 10);

      btn.addEventListener('mouseenter', () => paintStars(starValue));
      btn.addEventListener('focus', () => paintStars(starValue));

      btn.addEventListener('click', () => {
        ratingInput.value = String(starValue);
        paintStars(starValue);
      });
    });

    const group = document.getElementById('star-rating');
    if (group) {
      group.addEventListener('mouseleave', () => {
        paintStars(parseInt(ratingInput.value, 10) || 0);
      });
    }
  }

  // ── Role "Others" free-text field ──────────────────────────────────────
  function initRoleOther() {
    if (!roleSelect || !roleOtherWrapper || !roleOtherInput) return;

    roleSelect.addEventListener('change', () => {
      const isOthers = roleSelect.value === 'Others';
      roleOtherWrapper.classList.toggle('hidden', !isOthers);
      if (isOthers) roleOtherInput.focus();
    });
  }

  // ── Profile image upload (Cloudinary, unsigned) ─────────────────────────
  // Only one of [dropzone, progress, preview] is ever visible at a time —
  // the uploaded photo replaces the dropzone entirely, it isn't shown
  // alongside it.
  function resetImageUpload() {
    if (fileInput) fileInput.value = '';
    if (imageUrlInput) imageUrlInput.value = '';
    if (uploadPreview) uploadPreview.classList.add('hidden');
    if (uploadProgress) uploadProgress.classList.add('hidden');
    if (uploadDropzoneLabel) uploadDropzoneLabel.classList.remove('hidden');
    imageUploading = false;
  }

  function uploadToCloudinary(file) {
    imageUploading = true;
    if (uploadDropzoneLabel) uploadDropzoneLabel.classList.add('hidden');
    if (uploadPreview) uploadPreview.classList.add('hidden');
    if (uploadProgress) uploadProgress.classList.remove('hidden');
    setStatus('', false);

    const body = new FormData();
    body.append('file', file);
    body.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    body.append('folder', 'Testimonials');

    fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body })
      .then((r) => r.json())
      .then((data) => {
        if (!data.secure_url) throw new Error('upload_failed');
        if (imageUrlInput) imageUrlInput.value = data.secure_url;
        if (uploadPreviewImg) uploadPreviewImg.src = data.secure_url;
        if (uploadProgress) uploadProgress.classList.add('hidden');
        if (uploadPreview) uploadPreview.classList.remove('hidden');
      })
      .catch(() => {
        setStatus('Photo upload failed — you can still submit without a photo, or try again.', true);
        resetImageUpload();
      })
      .finally(() => {
        imageUploading = false;
      });
  }

  function initImageUpload() {
    if (!fileInput) return;

    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;

      const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setStatus('Please choose a PNG, JPG, or WEBP image.', true);
        resetImageUpload();
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setStatus('Image must be smaller than 5MB.', true);
        resetImageUpload();
        return;
      }

      uploadToCloudinary(file);
    });

    if (removeImageBtn) {
      removeImageBtn.addEventListener('click', resetImageUpload);
    }
  }

  // ── Form submit ─────────────────────────────────────────────────────────
  function initFormSubmit() {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (imageUploading) {
        setStatus('Please wait for the photo to finish uploading.', true);
        return;
      }

      const btn = form.querySelector('button[type="submit"]');
      const originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      setStatus('', false);

      const payload = {};
      new FormData(form).forEach((v, k) => { payload[k] = v; });
      payload.rating = parseInt(payload.rating, 10);

      if (!payload.rating) {
        setStatus('Please select a star rating.', true);
        btn.disabled = false;
        btn.textContent = originalText;
        return;
      }

      if (payload.role === 'Others') {
        const customRole = (roleOtherInput && roleOtherInput.value || '').trim();
        if (!customRole) {
          setStatus('Please specify your role.', true);
          btn.disabled = false;
          btn.textContent = originalText;
          if (roleOtherInput) roleOtherInput.focus();
          return;
        }
        payload.role = customRole;
      }

      try {
        const response = await fetch(WORKER_URL + '/airtable/testimonial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();

        if (!result.success) throw new Error(result.error || 'unknown');

        fireConfetti();
        form.classList.add('hidden');
        if (success) {
          success.classList.remove('hidden');
          success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      } catch {
        setStatus('Something went wrong submitting your testimonial. Please try again.', true);
        btn.disabled = false;
        btn.textContent = originalText;
      }
    });
  }

  initStarRating();
  initRoleOther();
  initImageUpload();
  initFormSubmit();
});
