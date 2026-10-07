/** Capa 3: coreografía GSAP, solo en páginas con <html data-gsap>. Atributos: data-gsap="words|rise|count|pop|fan", data-gsap-hide. */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(ScrollTrigger, SplitText);
const EASE = 'power3.out';
const release = () => document.documentElement.classList.remove('gsap-wait');
const below = (el: Element) => el.getBoundingClientRect().top > innerHeight;

const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  const heroTl = gsap.timeline({ defaults: { ease: EASE, duration: 0.8 } });
  document.fonts.ready.then(() => {
    document.querySelectorAll<HTMLElement>('[data-gsap="words"]').forEach((el, i) => {
      SplitText.create(el, { type: 'words', mask: 'words', autoSplit: true, onSplit(self) {
        gsap.set(el, { visibility: 'visible' }); const b = below(el);
        return gsap.from(self.words, { yPercent: 110, duration: 0.8, ease: EASE, stagger: 0.045, delay: b ? 0 : i * 0.1,
          scrollTrigger: b ? { trigger: el, start: 'top 85%', once: true } : undefined });
      } });
    });
    release();
  });

  const groups = new Map<Element, HTMLElement[]>();
  document.querySelectorAll<HTMLElement>('[data-gsap="rise"]').forEach((el) => { const p = el.parentElement!; groups.set(p, [...(groups.get(p) ?? []), el]); });
  groups.forEach((els) => {
    const tw = { y: 24, autoAlpha: 0, stagger: 0.08, duration: 0.8, ease: EASE, clearProps: 'transform,opacity,visibility' };
    if (!below(els[0])) heroTl.from(els, tw, 0.15);
    else gsap.from(els, { ...tw, scrollTrigger: { trigger: els[0], start: 'top 85%', once: true } });
  });

  document.querySelectorAll<HTMLElement>('[data-gsap="count"]').forEach((el) => {
    const end = Number((el.textContent ?? '').replace(/\D/g, '')); if (!end) return;
    const obj = { v: end > 1900 && end < 2100 ? end - 8 : 0 };
    el.setAttribute('aria-label', String(end));
    gsap.to(obj, { v: end, duration: 1.2, ease: 'power2.out', snap: { v: 1 }, onUpdate: () => { el.textContent = String(Math.round(obj.v)); },
      scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });

  document.querySelectorAll<HTMLElement>('[data-gsap="pop"]').forEach((el) => {
    const tw = { scale: 0.85, rotation: -6, autoAlpha: 0, filter: 'blur(6px)', duration: 1.1, ease: EASE, clearProps: 'transform,opacity,visibility,filter' };
    if (!below(el)) heroTl.from(el, tw, 0); else gsap.from(el, { ...tw, scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  document.querySelectorAll<HTMLElement>('[data-gsap="fan"]').forEach((el) => {
    const kids = [...el.children], mid = (kids.length - 1) / 2;
    gsap.from(kids, { x: (i: number) => (mid - i) * 40, rotation: (i: number) => (i - mid) * -6, y: 30, autoAlpha: 0, duration: 0.9, ease: EASE,
      stagger: 0.08, clearProps: 'transform,opacity,visibility', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  if (!document.querySelector('[data-gsap="words"]')) release();
  return () => release();
});
mm.add('(prefers-reduced-motion: reduce)', () => { release(); });
