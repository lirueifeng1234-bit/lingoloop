import { useEffect, useRef, useState } from 'react'

// Animated count-up for stat numbers: eases from the previously shown value
// to the new target with an ease-out cubic, one setState per animation frame.
// Non-numeric targets pass straight through, and reduced-motion users see the
// final number immediately — the animation is a garnish, never a gate.
export function useCountUp(target, duration = 900) {
  const n = typeof target === 'number' && Number.isFinite(target) ? target : null
  const [shown, setShown] = useState(0)
  const prev = useRef(0)

  useEffect(() => {
    if (n === null) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      prev.current = n
      setShown(n)
      return
    }
    const from = prev.current
    if (from === n) {
      setShown(n)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (n - from) * eased))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        prev.current = n
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [n, duration])

  return n === null ? target : shown
}
