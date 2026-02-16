import gsap from 'gsap';

/**
 * GSAP Animation helpers - accept React refs instead of DOM IDs
 */
export const ChampAnimations = {
  animateTasksIn(containerEl) {
    if (!containerEl) return;
    const cards = containerEl.querySelectorAll('.task-card');
    if (cards.length === 0) return;
    gsap.fromTo(cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, stagger: 0.04, duration: 0.35, ease: 'power2.out' }
    );
  },

  animateXPBar(barEl, targetWidth) {
    if (!barEl) return;
    gsap.fromTo(barEl,
      { width: '5%' },
      { width: targetWidth, duration: 0.8, ease: 'elastic.out(1, 0.5)' }
    );
  },

  animateCounter(el, targetValue) {
    if (!el) return;
    const num = parseInt(targetValue) || 0;
    const obj = { val: 0 };
    gsap.to(obj, {
      val: num, duration: 0.6, ease: 'power1.out',
      onUpdate: () => { el.textContent = Math.round(obj.val); }
    });
  },

  animateThemeTransition(mainEl, callback) {
    if (!mainEl) { callback?.(); return; }
    gsap.to(mainEl, {
      opacity: 0.3, duration: 0.15,
      onComplete: () => {
        callback?.();
        gsap.to(mainEl, { opacity: 1, duration: 0.3 });
      }
    });
  },

  animateCompanionEntrance(targetEl) {
    if (!targetEl) return;
    gsap.fromTo(targetEl,
      { scale: 0, rotation: -15 },
      { scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.7)' }
    );
  },

  levelUpCelebration(targetEl) {
    if (!targetEl) return;
    const tl = gsap.timeline();
    tl.to(targetEl, { scale: 1.3, duration: 0.3, ease: 'power2.out' })
      .to(targetEl, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.3)' })
      .to(targetEl, { boxShadow: '0 0 30px rgba(245, 158, 11, 0.8)', duration: 0.3 }, 0)
      .to(targetEl, { boxShadow: '0 0 0 rgba(245, 158, 11, 0)', duration: 0.6 }, 0.3);
  },
};

/**
 * motion.dev animation variants for React components
 */
export const motionVariants = {
  cardHover: {
    scale: 1.01,
    transition: { duration: 0.2 },
  },
  fadeIn: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.2 },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3 },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    transition: { duration: 0.3 },
  },
  scrollReveal: {
    initial: { opacity: 0, y: 30 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true },
    transition: { duration: 0.4 },
  },
  staggerContainer: {
    animate: { transition: { staggerChildren: 0.05 } },
  },
  staggerChild: {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
  },
  modalOverlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.15 },
  },
  modalContent: {
    initial: { opacity: 0, scale: 0.95, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 10 },
    transition: { duration: 0.2, ease: 'easeOut' },
  },
};
