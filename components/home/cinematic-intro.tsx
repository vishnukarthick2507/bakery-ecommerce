'use client'

import { useEffect, useState, useRef } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const INTRO_SESSION_KEY = 'bb_cinematic_intro_shown'

export function CinematicIntro({ onComplete }: { onComplete: () => void }) {
  const [scene, setScene] = useState(1)
  const [mounted, setMounted] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const introCompleteRef = useRef(false)

  useEffect(() => {
    // Skip intro if already shown in this session
    if (sessionStorage.getItem(INTRO_SESSION_KEY)) {
      setMounted(false)
      onComplete()
      return
    }

    setMounted(true)

    const timers: NodeJS.Timeout[] = []

    // Scene timing: 1s per scene, total ~5s
    timers.push(setTimeout(() => setScene(2), 1000))
    timers.push(setTimeout(() => setScene(3), 2000))
    timers.push(setTimeout(() => setScene(4), 3500))

    // Begin fade-out at 4.3s, complete transition at ~5s
    timers.push(setTimeout(() => {
      setFadingOut(true)
    }, 4300))

    timers.push(setTimeout(() => {
      introCompleteRef.current = true
      sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
      setMounted(false)
      onComplete()
    }, 5000))

    return () => {
      timers.forEach((t) => clearTimeout(t))
    }
  }, [])

  const skipIntro = () => {
    introCompleteRef.current = true
    sessionStorage.setItem(INTRO_SESSION_KEY, 'true')
    setMounted(false)
    onComplete()
  }

  if (!mounted) return null

  return (
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-midnight-navy',
        'transition-opacity duration-700',
        fadingOut ? 'opacity-0' : 'opacity-100',
      )}
      aria-hidden={!mounted}
      aria-label="Brevo diagnostic settings"
    >
      {/* Skip button */}
      {scene === 1 && !fadingOut && (
        <button
          onClick={skipIntro}
          className="absolute top-6 right-6 z-[9999] rounded-lg px-3 py-2 bg-white/10 backdrop-blur-sm text-white/70 hover:text-white hover:bg-white/20 transition-colors border border-white/20"
          aria-label="Skip intro"
        >
          Skip intro
        </button>
      )}

      {/* Scene 1 — Bakery Atmosphere (0-1s) */}
      {scene === 1 && !fadingOut && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-3/4 max-w-[800px] overflow-hidden rounded-2xl shadow-2xl border border-white/20 animate-scale-up">
            <Image
              src="/images/about-bakers.png"
              alt="Artisan bakery interior"
              fill
              priority
              className="object-cover object-center animate-fade-in-up"
              style={{ animationDelay: '200ms' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy/60 via-transparent to-transparent" />
          </div>
        </div>
      )}

      {/* Scene 2 — Artisan Craftsmanship (1-2s) */}
      {scene === 2 && !fadingOut && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-1/2 max-w-[600px] overflow-hidden rounded-2xl shadow-2xl border border-white/20 animate-scale-up">
            <Image
              src="/images/butter-croissant.jpg"
              alt="Fresh croissants"
              fill
              priority
              className="object-cover object-center animate-fade-in-up"
              style={{ animationDelay: '400ms' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy/40 via-transparent to-transparent" />
          </div>
        </div>
      )}

      {/* Scene 3 — Brand Reveal (2-3.5s) */}
      {scene === 3 && !fadingOut && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-champagne-gold/10 text-champagne-gold border border-champagne-gold/30 mb-6 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <span className="text-xs font-semibold tracking-widest uppercase">Established 2024</span>
          </div>
          <h1 className="font-heading text-5xl font-bold text-white tracking-tight leading-tight animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            BLUEBELL<span className="text-champagne-gold"> BAKEHOUSE</span>
          </h1>
        </div>
      )}

      {/* Scene 4 — Tagline Reveal (3.5-4.3s) */}
      {scene === 4 && !fadingOut && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-champagne-gold text-midnight-navy animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <span className="text-xs font-semibold tracking-widest uppercase">Freshly Baked</span>
          </div>
          <h2 className="mt-2 text-4xl font-bold text-white tracking-tight animate-fade-in-up" style={{ animationDelay: '400ms' }}>
            Freshly Baked Happiness.
          </h2>
        </div>
      )}
    </div>
  );
}
