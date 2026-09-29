/**
 * ReadWell Landing Page — Interactive behaviors
 */

// ─── Navigation scroll effect ───
const nav = document.getElementById('main-nav');

function handleNavScroll() {
  if (window.scrollY > 10) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}

window.addEventListener('scroll', handleNavScroll, { passive: true });

// ─── Mobile nav toggle ───
const mobileToggle = document.getElementById('nav-mobile-toggle');
const mobileOverlay = document.getElementById('mobile-nav-overlay');

if (mobileToggle && mobileOverlay) {
  mobileToggle.addEventListener('click', () => {
    mobileOverlay.classList.toggle('active');
    mobileToggle.classList.toggle('active');
    document.body.style.overflow = mobileOverlay.classList.contains('active') ? 'hidden' : '';
  });

  // Close mobile nav on link click
  mobileOverlay.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileOverlay.classList.remove('active');
      mobileToggle.classList.remove('active');
      document.body.style.overflow = '';
    });
  });
}

// ─── Smooth scroll for anchor links ───
document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
  anchor.addEventListener('click', (e) => {
    const targetId = anchor.getAttribute('href');
    if (targetId === '#') return;

    const target = document.querySelector(targetId);
    if (target) {
      e.preventDefault();
      const navHeight = nav.offsetHeight;
      const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 20;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth',
      });
    }
  });
});

// ─── Scroll reveal with IntersectionObserver ───
const revealElements = document.querySelectorAll(
  '.feature-card, .step, .testimonial-card, .pricing-card, .section-header, .illustration-img, .showcase-img, .cta-card'
);

revealElements.forEach((el) => el.classList.add('reveal'));

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px',
  }
);

revealElements.forEach((el) => revealObserver.observe(el));

// ─── Stagger reveal for grid items ───
const staggerContainers = document.querySelectorAll('.features-grid, .testimonials-grid, .pricing-grid, .steps');

staggerContainers.forEach((container) => {
  const items = container.children;
  Array.from(items).forEach((item, index) => {
    item.style.transitionDelay = `${index * 100}ms`;
  });
});

// ─── CTA form handling ───
const ctaSubmitBtn = document.getElementById('btn-cta-submit');
const ctaEmailInput = document.getElementById('cta-email-input');

if (ctaSubmitBtn && ctaEmailInput) {
  ctaSubmitBtn.addEventListener('click', (e) => {
    e.preventDefault();
    const email = ctaEmailInput.value.trim();

    if (!email) {
      ctaEmailInput.focus();
      ctaEmailInput.style.borderColor = '#ef4444';
      setTimeout(() => {
        ctaEmailInput.style.borderColor = '';
      }, 2000);
      return;
    }

    if (!isValidEmail(email)) {
      ctaEmailInput.style.borderColor = '#ef4444';
      setTimeout(() => {
        ctaEmailInput.style.borderColor = '';
      }, 2000);
      return;
    }

    // Success state
    ctaSubmitBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      You're on the list!
    `;
    ctaSubmitBtn.style.background = '#10b981';
    ctaEmailInput.value = '';
    ctaEmailInput.disabled = true;
    ctaSubmitBtn.disabled = true;

    setTimeout(() => {
      ctaSubmitBtn.innerHTML = `
        Get early access
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      `;
      ctaSubmitBtn.style.background = '';
      ctaEmailInput.disabled = false;
      ctaSubmitBtn.disabled = false;
    }, 3000);
  });

  ctaEmailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      ctaSubmitBtn.click();
    }
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Parallax subtle effect on hero shapes ───
const heroShapes = document.querySelectorAll('.hero-shape');

window.addEventListener(
  'mousemove',
  (e) => {
    const x = (e.clientX / window.innerWidth - 0.5) * 2;
    const y = (e.clientY / window.innerHeight - 0.5) * 2;

    heroShapes.forEach((shape, index) => {
      const factor = (index + 1) * 8;
      shape.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
    });
  },
  { passive: true }
);

// ─── Count up animation for social proof number ───
function animateCountUp(element, target, duration = 1500) {
  let start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = Math.floor(eased * target);

    element.textContent = current.toLocaleString() + '+';

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

// Trigger count-up when social proof becomes visible
const socialProofText = document.querySelector('.social-proof-text strong');
if (socialProofText) {
  const countObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCountUp(socialProofText, 2400);
          countObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  countObserver.observe(socialProofText);
}

// ─── 1. Hairline Scroll Progress Bar ───
const scrollProgressBar = document.getElementById('scroll-progress');
if (scrollProgressBar) {
  window.addEventListener(
    'scroll',
    () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      scrollProgressBar.style.width = `${progress}%`;
    },
    { passive: true }
  );
}

// ─── 2. Hero Phone 3D Tilt with Glare ───
const heroPhoneWrapper = document.getElementById('hero-phone-card');
const phoneDevice = document.getElementById('phone-device');
const heroPhoneGlare = document.getElementById('hero-phone-glare');

if (heroPhoneWrapper && phoneDevice) {
  heroPhoneWrapper.addEventListener('mousemove', (e) => {
    const rect = heroPhoneWrapper.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -10;
    const rotateY = ((x - centerX) / centerX) * 10;

    phoneDevice.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;

    if (heroPhoneGlare) {
      const glareX = (x / rect.width) * 100;
      const glareY = (y / rect.height) * 100;
      heroPhoneGlare.style.background = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.4), transparent 60%)`;
    }
  });

  heroPhoneWrapper.addEventListener('mouseleave', () => {
    phoneDevice.style.transform = 'perspective(1000px) rotateY(-4deg) rotateX(2deg) scale3d(1, 1, 1)';
  });
}

// ─── 2.1 Live App Screen Navigation Simulation ───
const phoneQuizSheet = document.getElementById('phone-quiz-sheet');
const phoneStreakOverlay = document.getElementById('phone-streak-overlay');
const phoneProgressPct = document.getElementById('phone-progress-pct');
const phoneProgressFill = document.getElementById('phone-progress-fill');
const phoneOpt1 = document.getElementById('phone-opt-1');
const phoneOpt2 = document.getElementById('phone-opt-2');
const phoneQuizEvidence = document.getElementById('phone-quiz-evidence');
const phoneTapIndicator = document.getElementById('phone-tap-indicator');
const phoneBtnContinue = document.getElementById('phone-btn-continue');
const readerHighlightP = document.getElementById('reader-highlight-p');

function runSimulationLoop() {
  // Phase 1: Reading mode
  if (phoneStreakOverlay) phoneStreakOverlay.classList.remove('active');
  if (phoneQuizSheet) phoneQuizSheet.classList.add('sheet-hidden');
  if (phoneOpt1) phoneOpt1.classList.remove('opt-selected');
  if (phoneQuizEvidence) phoneQuizEvidence.classList.remove('visible');
  if (phoneTapIndicator) phoneTapIndicator.classList.remove('tapping');
  if (phoneProgressPct) phoneProgressPct.textContent = '85%';
  if (phoneProgressFill) phoneProgressFill.style.width = '85%';
  if (readerHighlightP) readerHighlightP.classList.add('active-reading');

  // Reading progress advancing
  setTimeout(() => {
    if (phoneProgressPct) phoneProgressPct.textContent = '92%';
    if (phoneProgressFill) phoneProgressFill.style.width = '92%';
  }, 1200);

  setTimeout(() => {
    if (phoneProgressPct) phoneProgressPct.textContent = '100%';
    if (phoneProgressFill) phoneProgressFill.style.width = '100%';
  }, 2400);

  // Phase 2: Quiz Sheet slides up
  setTimeout(() => {
    if (phoneQuizSheet) phoneQuizSheet.classList.remove('sheet-hidden');

    // Simulated tap on Option A
    setTimeout(() => {
      if (phoneTapIndicator) {
        phoneTapIndicator.style.top = '68%';
        phoneTapIndicator.style.left = '48%';
        phoneTapIndicator.classList.add('tapping');
      }

      setTimeout(() => {
        if (phoneOpt1) phoneOpt1.classList.add('opt-selected');
        if (phoneQuizEvidence) phoneQuizEvidence.classList.add('visible');
        if (phoneTapIndicator) phoneTapIndicator.classList.remove('tapping');
      }, 350);
    }, 1200);
  }, 3600);

  // Phase 3: Streak Celebration overlay
  setTimeout(() => {
    if (phoneStreakOverlay) phoneStreakOverlay.classList.add('active');

    // Simulated tap on Continue Reading button
    setTimeout(() => {
      if (phoneTapIndicator) {
        phoneTapIndicator.style.top = '66%';
        phoneTapIndicator.style.left = '50%';
        phoneTapIndicator.classList.add('tapping');
      }

      setTimeout(() => {
        if (phoneTapIndicator) phoneTapIndicator.classList.remove('tapping');
        // Loop seamlessly back to reading
        setTimeout(runSimulationLoop, 600);
      }, 400);
    }, 2200);
  }, 7600);
}

// Start simulation
runSimulationLoop();

// Interactive manual clicks inside the phone screen
if (phoneOpt1) {
  phoneOpt1.addEventListener('click', (e) => {
    e.stopPropagation();
    phoneOpt1.classList.add('opt-selected');
    if (phoneOpt2) phoneOpt2.classList.remove('opt-selected');
    if (phoneQuizEvidence) phoneQuizEvidence.classList.add('visible');
  });
}
if (phoneOpt2) {
  phoneOpt2.addEventListener('click', (e) => {
    e.stopPropagation();
    phoneOpt2.classList.add('opt-selected');
    if (phoneOpt1) phoneOpt1.classList.remove('opt-selected');
    if (phoneQuizEvidence) phoneQuizEvidence.classList.remove('visible');
  });
}
if (phoneBtnContinue) {
  phoneBtnContinue.addEventListener('click', (e) => {
    e.stopPropagation();
    runSimulationLoop();
  });
}

// ─── 3. Interactive How It Works Simulations ───

// Step 1: Upload simulation
const uploadCard = document.getElementById('mock-upload-card');
const uploadProgress = document.getElementById('mock-upload-progress');
const progressFill = document.getElementById('mock-progress-fill');
const uploadStatus = document.getElementById('mock-upload-status');
let isUploading = false;

if (uploadCard && uploadProgress && progressFill && uploadStatus) {
  uploadCard.addEventListener('click', () => {
    if (isUploading) return;
    isUploading = true;
    uploadProgress.style.display = 'block';
    progressFill.style.width = '0%';
    uploadStatus.querySelector('.mock-upload-text').textContent = 'Uploading Atomic_Habits.pdf...';

    let p = 0;
    const interval = setInterval(() => {
      p += 25;
      progressFill.style.width = `${p}%`;
      if (p >= 100) {
        clearInterval(interval);
        setTimeout(() => {
          uploadProgress.style.display = 'none';
          uploadStatus.innerHTML = `
            <span class="mock-upload-text" style="color: #10b981;">Chunked into 14 daily reads! ✅</span>
            <span class="mock-upload-hint">Click to test again</span>
          `;
          isUploading = false;
        }, 350);
      }
    }, 100);
  });

  uploadCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      uploadCard.click();
    }
  });
}

// Step 2: Quiz interactive demo
const quizOpts = document.querySelectorAll('.mock-quiz-opt');
const quizFeedback = document.getElementById('feedback-badge');

quizOpts.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCorrect = btn.getAttribute('data-correct') === 'true';

    quizOpts.forEach((b) => b.classList.remove('opt-correct', 'opt-incorrect'));

    if (isCorrect) {
      btn.classList.add('opt-correct');
      if (quizFeedback) {
        quizFeedback.innerHTML = '✨ <strong>Correct! +10 XP</strong> • Evidence: Section 1, Para 3';
        quizFeedback.style.color = '#065f46';
        quizFeedback.style.borderColor = '#10b981';
        quizFeedback.style.background = '#ecfdf5';
      }
    } else {
      btn.classList.add('opt-incorrect');
      if (quizFeedback) {
        quizFeedback.innerHTML = '❌ <em>Not quite</em> — Habits thrive on cues & instant feedback';
        quizFeedback.style.color = '#991b1b';
        quizFeedback.style.borderColor = '#f87171';
        quizFeedback.style.background = '#fef2f2';
      }
    }
  });

  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      btn.click();
    }
  });
});

// Step 3: Streak claim demo
const streakBtn = document.getElementById('btn-demo-streak');
const streakFlame = document.getElementById('interactive-streak-flame');
const streakCount = document.getElementById('interactive-streak-count');
const streakFill = document.getElementById('interactive-streak-fill');
const streakBadge = document.getElementById('interactive-streak-label');
let streakCompleted = false;

if (streakBtn && streakFlame && streakCount) {
  streakBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!streakCompleted) {
      streakCompleted = true;
      streakFlame.classList.add('flame-burst');
      streakCount.innerHTML = '15 day streak! 🔥';
      streakCount.style.color = '#ea580c';
      if (streakFill) streakFill.style.width = '100%';
      if (streakBadge) {
        streakBadge.textContent = '🎉 Streak preserved! +25 XP awarded';
        streakBadge.style.color = '#059669';
        streakBadge.style.fontWeight = '700';
      }
      streakBtn.innerHTML = '<span>Session Completed!</span><span class="streak-xp-pill">Done</span>';
      streakBtn.style.background = '#10b981';

      setTimeout(() => {
        streakFlame.classList.remove('flame-burst');
      }, 700);
    } else {
      // Reset demo
      streakCompleted = false;
      streakCount.innerHTML = '14 day streak!';
      streakCount.style.color = '';
      if (streakFill) streakFill.style.width = '70%';
      if (streakBadge) {
        streakBadge.textContent = '4 more days to next badge';
        streakBadge.style.color = '';
        streakBadge.style.fontWeight = '';
      }
      streakBtn.innerHTML = '<span>Complete today\'s read</span><span class="streak-xp-pill">+25 XP</span>';
      streakBtn.style.background = '';
    }
  });

  streakBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      streakBtn.click();
    }
  });
}

// ─── 4. Pricing Billing Cycle Toggle ───
const btnMonthly = document.getElementById('btn-billing-monthly');
const btnAnnual = document.getElementById('btn-billing-annual');
const priceVal = document.getElementById('price-pro-val');
const pricePeriod = document.getElementById('price-pro-period');
const priceDesc = document.getElementById('pricing-desc-pro');

if (btnMonthly && btnAnnual && priceVal) {
  btnAnnual.addEventListener('click', () => {
    btnAnnual.classList.add('active');
    btnMonthly.classList.remove('active');
    btnAnnual.setAttribute('aria-selected', 'true');
    btnMonthly.setAttribute('aria-selected', 'false');

    priceVal.textContent = '3.99';
    if (pricePeriod) pricePeriod.textContent = '/month';
    if (priceDesc) priceDesc.textContent = 'Billed annually ($47.88/yr) • 2 months free!';
  });

  btnMonthly.addEventListener('click', () => {
    btnMonthly.classList.add('active');
    btnAnnual.classList.remove('active');
    btnMonthly.setAttribute('aria-selected', 'true');
    btnAnnual.setAttribute('aria-selected', 'false');

    priceVal.textContent = '4.99';
    if (pricePeriod) pricePeriod.textContent = '/month';
    if (priceDesc) priceDesc.textContent = 'Billed monthly • Cancel anytime';
  });
}

// ─── 5. Dynamic Card Spotlights ───
const spotlightCards = document.querySelectorAll('.feature-card, .testimonial-card');
spotlightCards.forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    card.style.setProperty('--mouse-x', `${x}px`);
    card.style.setProperty('--mouse-y', `${y}px`);
  });
});

// ─── 6. 3-Phone Showcase Interactivity ───
const showcaseInteractive = document.querySelector('.showcase-interactive');
const showcasePhones = document.querySelectorAll('.showcase-phone');

if (showcaseInteractive && showcasePhones.length > 0) {
  showcaseInteractive.addEventListener('mousemove', (e) => {
    const rect = showcaseInteractive.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const normX = (x / rect.width - 0.5) * 2;
    const normY = (y / rect.height - 0.5) * 2;

    showcasePhones.forEach((phone, index) => {
      let baseRotateZ = 0;
      let baseTranslateX = 0;
      let baseScale = 1;

      if (phone.classList.contains('phone-left')) {
        baseTranslateX = -240;
        baseRotateZ = -14;
        baseScale = 0.9;
      } else if (phone.classList.contains('phone-center')) {
        baseTranslateX = 0;
        baseRotateZ = 0;
        baseScale = 1.05;
      } else if (phone.classList.contains('phone-right')) {
        baseTranslateX = 240;
        baseRotateZ = 14;
        baseScale = 0.9;
      }

      const factor = (index + 1) * 3;
      const rotX = -normY * factor;
      const rotY = normX * factor;
      const tX = baseTranslateX + normX * (factor * 3);
      const tY = normY * (factor * 3);

      phone.style.transform = `translateX(${tX}px) translateY(${tY}px) scale(${baseScale}) rotateZ(${baseRotateZ}deg) rotateX(${rotX}deg) rotateY(${rotY}deg)`;
    });
  });

  showcaseInteractive.addEventListener('mouseleave', () => {
    showcasePhones.forEach((phone) => {
      phone.style.transform = '';
    });
  });
}

// ─── 7. Draggable Illustration Cards ───
const illustrationWrapper = document.querySelector('.illustration-wrapper');
const overlayCards = document.querySelectorAll('.overlay-card');

if (illustrationWrapper && overlayCards.length > 0) {
  let activeCard = null;
  let startX = 0;
  let startY = 0;

  const dragStart = (e, card) => {
    e.preventDefault();
    activeCard = card;
    activeCard.classList.add('is-dragging');

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const rect = activeCard.getBoundingClientRect();
    
    // Offset inside the card
    startX = clientX - rect.left;
    startY = clientY - rect.top;

    // Bring to front
    overlayCards.forEach(c => c.style.zIndex = '10');
    activeCard.style.zIndex = '30';
  };

  const dragMove = (e) => {
    if (!activeCard) return;

    const clientX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
    const clientY = e.type.includes('mouse') ? e.clientY : e.touches[0].clientY;

    const wrapperRect = illustrationWrapper.getBoundingClientRect();

    let x = clientX - wrapperRect.left - startX;
    let y = clientY - wrapperRect.top - startY;

    // Keep within bounds of wrapper
    const maxX = wrapperRect.width - activeCard.offsetWidth;
    const maxY = wrapperRect.height - activeCard.offsetHeight;

    x = Math.max(0, Math.min(x, maxX));
    y = Math.max(0, Math.min(y, maxY));

    const xPct = (x / wrapperRect.width) * 100;
    const yPct = (y / wrapperRect.height) * 100;

    activeCard.style.left = `${xPct}%`;
    activeCard.style.top = `${yPct}%`;
  };

  const dragEnd = () => {
    if (!activeCard) return;
    activeCard.classList.remove('is-dragging');
    activeCard = null;
  };

  overlayCards.forEach(card => {
    card.addEventListener('mousedown', (e) => dragStart(e, card));
    card.addEventListener('touchstart', (e) => dragStart(e, card), { passive: false });
  });

  document.addEventListener('mousemove', dragMove);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('touchmove', dragMove, { passive: false });
  document.addEventListener('touchend', dragEnd);
}
