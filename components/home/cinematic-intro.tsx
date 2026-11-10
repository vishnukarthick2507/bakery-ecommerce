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

    // Original motion: navy bg (0-1s) -> bakery scene reveals (1-2.5s)
    // -> brand name overlaid (2.5-3.5s) -> tagline (3.5-4.3s)
    // brand stays visible near lower centre through the handoff
    timers.push(setTimeout(() => setScene(2), 1000))
    timers.push(setTimeout(() => setScene(3), 2500))
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
        'fixed inset-0 z-[9999] flex flex-col items-center justify-center',
        'bg-gradient-to-b from-midnight-navy via-deep-navy to-midnight-navy',
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
          className="absolute top-6 right-6 z-[9999] rounded-lg px-3 py-2 bg-champagne-gold/10 backdrop-blur-sm text-champagne-gold hover:text-white hover:bg-champagne-gold/20 transition-colors border border-champagne-gold/30"
          aria-label="Skip intro"
        >
          Skip intro
        </button>
      )}

      {/* Scene 1 — Dark navy atmospheric background (0-1s) */}
      {scene === 1 && !fadingOut && (
        <div className="absolute inset-0" />
      )}

      {/* Scene 2 — Bakery scene reveals itself (1-2.5s) */}
      {scene === 2 && !fadingOut && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative aspect-square w-3/4 max-w-[860px] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(16,26,43,0.5)] border border-champagne-gold/20 animate-scale-up">
            <Image
              src="/images/about-bakers.png"
              alt="Artisan bakery interior"
              fill
              priority
              className="object-cover object-center animate-fade-in-up"
              style={{ animationDelay: '200ms' }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy/70 via-midnight-navy/20 to-transparent" />
          </div>
        </div>
      )}

      {/* Scene 3 — Brand reveal overlaid on the bakery scene (2.5-3.5s) */}
      {scene === 3 && !fadingOut && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Bakery scene remains visible behind the brand */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-square w-3/4 max-w-[860px] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(16,26,43,0.5)] border border-champagne-gold/20 animate-scale-up">
              <Image
                src="/images/about-bakers.png"
                alt="Artisan bakery interior"
                fill
                priority
                className="object-cover object-center animate-fade-in-up"
                style={{ animationDelay: '200ms' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy/70 via-midnight-navy/20 to-transparent" />
            </div>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-champagne-gold/20 text-champagne-gold border border-champagne-gold/40 mb-6 animate-fade-in-up shadow-[0_10px_30px_rgba(198,164,106,0.2)]" style={{ animationDelay: '200ms' }}>
              <span className="text-xs font-semibold tracking-widest uppercase">Established 2024</span>
            </div>
            <h1 className="font-heading text-6xl font-bold tracking-tight leading-tight animate-fade-in-up bg-[linear-gradient(to_right,_#C6A46A,_#B28C52)] bg-clip-text text-transparent" style={{ animationDelay: '400ms' }}>
              BLUEBELL BAKEHOUSE
            </h1>
          </div>
        </div>
      )}

      {/* Scene 4 — Tagline reveal, brand stays visible near lower centre (3.5-4.3s) */}
      {scene === 4 && !fadingOut && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Bakery scene remains visible behind */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative aspect-square w-3/4 max-w-[860px] overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(16,26,43,0.5)] border border-champagne-gold/20 animate-scale-up">
              <Image
                src="/images/about-bakers.png"
                alt="Artisan bakery interior"
                fill
                priority
                className="object-cover object-center animate-fade-in-up"
                style={{ animationDelay: '200ms' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight-navy/70 via-midnight-navy/20 to-transparent" />
            </div>
          </div>
          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-champagne-gold/20 text-champagne-gold border border-champagne-gold/40 mb-6 animate-fade-in-up shadow-[0_10px_30px_rgba(198,164,106,0.2)]" style={{ animationDelay: '200ms' }}>
              <span className="text-xs font-semibold tracking-widest uppercase">Established 2024</span>
            </div>
            <h1 className="font-heading text-6xl font-bold tracking-tight leading-tight animate-fade-in-up bg-[linear-gradient(to_right,_#C6A46A,_#B28C52)] bg-clip-text text-transparent" style={{ animationDelay: '400ms' }}>
              BLUEBELL BAKEHOUSE
            </h1>
            <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-champagne-gold text-midnight-navy mt-6 animate-fade-in-up shadow-[0_10px_30px_rgba(198,164,106,0.3)]" style={{ animationDelay: '600ms' }}>
              <span className="text-xs font-semibold tracking-widest uppercase">Freshly Baked</span>
            </div>
            <h2 className="mt-2 text-5xl font-bold text-white tracking-tight animate-fade-in-up" style={{ animationDelay: '800ms' }}>
              Freshly Baked Happiness.
            </h2>
          </div>
        </div>
      )}
    </div>
  );
}
