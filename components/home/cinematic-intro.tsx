'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'

const INTRO_SESSION_KEY = 'bb_cinematic_intro_shown'
const SHOWCASE = [
  { src: '/images/products/butter-croissant.png', alt: 'Golden butter croissants', title: 'Crafted with Passion.' },
  { src: '/images/products/sourdough-loaf.png', alt: 'Fresh artisan sourdough bread', title: 'Baked Fresh. Served with Love.' },
  { src: '/images/products/chocolate-truffle-cake.png', alt: 'Chocolate celebration cake', title: 'Made for life’s sweetest moments.' },
  { src: '/images/products/choco-chip-cookies.png', alt: 'Fresh chocolate chip cookies', title: 'A little joy in every bite.' },
] as const

type CinematicIntroProps = { onComplete: () => void }

export function BluebellCinematicIntro({ onComplete }: CinematicIntroProps) {
  const [visible, setVisible] = useState(false)
  const [stage, setStage] = useState(0)
  const [showcaseIndex, setShowcaseIndex] = useState(0)
  const [homepageReveal, setHomepageReveal] = useState(false)
  const completed = useRef(false)
  const finishRef = useRef(onComplete)
  finishRef.current = onComplete

  const finish = useCallback(() => {
    if (completed.current) return
    completed.current = true
    try {
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
    } catch {
      // The intro still completes if browser storage is unavailable.
    }
    setVisible(false)
    finishRef.current()
  }, [])

  useEffect(() => {
    let alreadyShown = false
    try {
      alreadyShown = sessionStorage.getItem(INTRO_SESSION_KEY) === 'true'
    } catch {
      // Private browsing/storage restrictions should not block the intro.
    }

    if (alreadyShown || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      completed.current = true
      setVisible(false)
      finishRef.current()
      return
    }

    setVisible(true)
    const timers = [
      window.setTimeout(() => setStage(1), 1500),
      window.setTimeout(() => setStage(2), 3500),
      window.setTimeout(() => setHomepageReveal(true), 5700),
      window.setTimeout(finish, 7000),
    ]
    const showcaseTimer = window.setInterval(() => {
      setShowcaseIndex((index) => (index + 1) % SHOWCASE.length)
    }, 580)

    return () => {
      timers.forEach(window.clearTimeout)
      window.clearInterval(showcaseTimer)
    }
  }, [finish])

  if (!visible) return null

  return (
    <div
      className={`bluebell-intro${homepageReveal ? ' bluebell-intro--revealing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Bluebell Bakehouse introduction"
    >
      <div className="bluebell-intro__navy" aria-hidden="true" />

      <div className={`bluebell-intro__bakery${stage >= 1 ? ' is-visible' : ''}`} aria-hidden="true">
        <Image
          src="/images/about-bakers.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="bluebell-intro__bakery-image"
          onError={(event) => { event.currentTarget.style.display = 'none' }}
        />
        <div className="bluebell-intro__bakery-shade" />
      </div>

      <div className={`bluebell-intro__showcase${stage >= 2 ? ' is-visible' : ''}`} aria-hidden="true">
        <div className="bluebell-intro__frame is-active" key={SHOWCASE[showcaseIndex].src}>
          <Image src={SHOWCASE[showcaseIndex].src} alt="" fill sizes="100vw" className="bluebell-intro__food-image" />
        </div>
        <div className="bluebell-intro__showcase-shade" />
        <p className="bluebell-intro__showcase-copy" key={showcaseIndex}>{SHOWCASE[showcaseIndex].title}</p>
      </div>

      <div className={`bluebell-intro__identity${stage >= 1 ? ' is-visible' : ''}`}>
        <span className="bluebell-intro__ornament" aria-hidden="true"><span /></span>
        <p className="bluebell-intro__eyebrow">ARTISAN BAKERY · FRESH EVERY DAY</p>
        <h1>BLUEBELL <span>BAKEHOUSE</span></h1>
        <p className="bluebell-intro__tagline">Freshly Baked Happiness.</p>
      </div>

      <button className="bluebell-intro__skip" type="button" onClick={finish}>
        Skip intro <span aria-hidden="true">→</span>
      </button>
      <span className="bluebell-intro__progress" aria-hidden="true" />
    </div>
  )
}

// Retain the previous export name for compatibility with any untracked callers.
export const CinematicIntro = BluebellCinematicIntro