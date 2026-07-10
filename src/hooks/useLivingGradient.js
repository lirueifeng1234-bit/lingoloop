import { useEffect } from 'react'

// Drives the "living gradient" shared across every screen: it writes the
// pointer position into CSS custom properties that the page aurora and the
// card spotlights read. One global listener, throttled to a single write per
// animation frame. A complete no-op on coarse pointers (touch) and when the
// user prefers reduced motion, so nothing moves where it shouldn't.
//
// - --mx / --my : pointer position 0–1, set on <html> so every aurora inherits it
// - --cx / --cy : pointer position inside the hovered card, for its spotlight
const CARD_SELECTOR = '.task, .arc-card, .prompt-card, .card, .panel, .auth__card'

export function useLivingGradient() {
  useEffect(() => {
    if (!window.matchMedia('(pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const root = document.documentElement
    let raf = 0
    let mx = 0.5
    let my = 0.3

    const flush = () => {
      raf = 0
      root.style.setProperty('--mx', mx.toFixed(3))
      root.style.setProperty('--my', my.toFixed(3))
    }

    const onMove = (e) => {
      mx = e.clientX / window.innerWidth
      my = e.clientY / window.innerHeight
      const card = e.target.closest && e.target.closest(CARD_SELECTOR)
      if (card) {
        const r = card.getBoundingClientRect()
        card.style.setProperty('--cx', `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`)
        card.style.setProperty('--cy', `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`)
      }
      if (!raf) raf = requestAnimationFrame(flush)
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
}
