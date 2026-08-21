'use client'

import { useEffect, useRef, useState } from 'react'

const DROPZONE_MOTION_VIDEO_WEBM = '/media/dropzone-bg-desktop.webm'
const DROPZONE_MOTION_VIDEO_MP4 = '/media/dropzone-bg-desktop.mp4'
const DROPZONE_MOTION_VIDEO_MOBILE = '/media/dropzone-bg-mobile.mp4'
const DROPZONE_MOTION_POSTER = '/media/dropzone-bg-poster.webp'

type NavigatorWithConnection = Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }

export function LealtMotionScene({ className = '' }: { className?: string }) {
  const sceneRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoEnabled, setVideoEnabled] = useState(false)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const connection = (navigator as NavigatorWithConnection).connection

    const syncVideoPreference = () => {
      const slowConnection = connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g'
      setVideoEnabled(!reduceMotion.matches && !connection?.saveData && !slowConnection)
    }

    syncVideoPreference()
    reduceMotion.addEventListener('change', syncVideoPreference)
    return () => reduceMotion.removeEventListener('change', syncVideoPreference)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoEnabled) return

    const syncVisibility = () => {
      if (document.hidden) {
        video.pause()
        return
      }
      void video.play().catch(() => undefined)
    }

    syncVisibility()
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [videoEnabled])

  useEffect(() => {
    const scene = sceneRef.current
    const host = scene?.closest<HTMLElement>('[data-lealt-motion-host]') || scene?.parentElement
    if (!scene || !host) return

    let cancelled = false
    let cleanup: (() => void) | undefined

    const setupAmbient = () => {
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
      const scrollTarget: Window | HTMLElement = host.classList.contains('login-portal-stage') ? host : window
      let frame = 0
      let revealObserver: IntersectionObserver | null = null
      const observed = new WeakSet<Element>()

      const setStaticMotion = () => {
        host.style.setProperty('--lealt-scroll-shift', '0px')
        host.style.setProperty('--lealt-bg-shift', '0px')
        host.style.setProperty('--lealt-pointer-x', '0px')
        host.style.setProperty('--lealt-pointer-y', '0px')
        host.style.setProperty('--lealt-pointer-x-inverse', '0px')
        host.style.setProperty('--lealt-pointer-y-inverse', '0px')
        host.style.setProperty('--lealt-mobile-shift', '0px')
        host.style.setProperty('--lealt-hero-opacity', '1')
      }

      const readScrollY = () => scrollTarget === window ? window.scrollY : (scrollTarget as HTMLElement).scrollTop
      const renderScroll = () => {
        frame = 0
        if (reduceMotion.matches) {
          setStaticMotion()
          return
        }
        const y = Math.max(0, readScrollY())
        host.style.setProperty('--lealt-bg-shift', `${Math.min(y * 0.24, 180).toFixed(2)}px`)
        host.style.setProperty('--lealt-mobile-shift', `${(-Math.min(y * 0.22, 96)).toFixed(2)}px`)
        host.style.setProperty('--lealt-hero-opacity', `${Math.max(0.26, 1 - y / 720).toFixed(3)}`)
      }
      const queueScroll = () => { if (!frame) frame = window.requestAnimationFrame(renderScroll) }

      const pointerMove = (event: PointerEvent) => {
        if (reduceMotion.matches || event.pointerType === 'touch') return
        const x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
        const y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
        host.style.setProperty('--lealt-pointer-x', `${(x * 26).toFixed(2)}px`)
        host.style.setProperty('--lealt-pointer-y', `${(y * 19).toFixed(2)}px`)
        host.style.setProperty('--lealt-pointer-x-inverse', `${(x * -20).toFixed(2)}px`)
        host.style.setProperty('--lealt-pointer-y-inverse', `${(y * -15).toFixed(2)}px`)
      }
      const pointerLeave = () => {
        host.style.setProperty('--lealt-pointer-x', '0px')
        host.style.setProperty('--lealt-pointer-y', '0px')
        host.style.setProperty('--lealt-pointer-x-inverse', '0px')
        host.style.setProperty('--lealt-pointer-y-inverse', '0px')
      }

      const setupRevealObserver = () => {
        revealObserver?.disconnect()
        host.classList.add('lealt-motion-ready')
        if (reduceMotion.matches || !('IntersectionObserver' in window)) {
          host.querySelectorAll('.lealt-scroll-reveal').forEach((element) => element.classList.add('lealt-in-view'))
          return
        }
        revealObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('lealt-in-view')
            revealObserver?.unobserve(entry.target)
          })
        }, { root: scrollTarget === window ? null : scrollTarget as HTMLElement, threshold: 0.08, rootMargin: '0px 0px -3% 0px' })
        host.querySelectorAll<HTMLElement>('.lealt-scroll-reveal').forEach((element) => {
          if (observed.has(element)) return
          observed.add(element)
          revealObserver?.observe(element)
        })
      }

      const handleMotionPreference = () => {
        setStaticMotion()
        setupRevealObserver()
        queueScroll()
      }

      setStaticMotion()
      setupRevealObserver()
      queueScroll()
      scrollTarget.addEventListener('scroll', queueScroll, { passive: true })
      window.addEventListener('pointermove', pointerMove, { passive: true })
      window.addEventListener('pointerleave', pointerLeave)
      reduceMotion.addEventListener('change', handleMotionPreference)

      return () => {
        if (frame) window.cancelAnimationFrame(frame)
        revealObserver?.disconnect()
        scrollTarget.removeEventListener('scroll', queueScroll)
        window.removeEventListener('pointermove', pointerMove)
        window.removeEventListener('pointerleave', pointerLeave)
        reduceMotion.removeEventListener('change', handleMotionPreference)
        host.classList.remove('lealt-motion-ready')
      }
    }

    const setupDropSequence = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ])
      if (cancelled) return
      gsap.registerPlugin(ScrollTrigger)

      const shell = host.querySelector<HTMLElement>('[data-drop-sequence-shell]')
      const hero = host.querySelector<HTMLElement>('[data-drop-sequence-stage]')
      const copy = host.querySelector<HTMLElement>('[data-drop-copy]')
      const kicker = host.querySelector<HTMLElement>('[data-drop-kicker]')
      const description = host.querySelector<HTMLElement>('[data-drop-description]')
      const search = host.querySelector<HTMLElement>('[data-drop-search]')
      const trust = host.querySelector<HTMLElement>('[data-drop-trust]')
      const featured = host.querySelector<HTMLElement>('[data-drop-featured]')
      const lines = Array.from(host.querySelectorAll<HTMLElement>('[data-drop-line]'))
      const route = host.querySelector<HTMLElement>('[data-drop-route]')
      const transitionWord = host.querySelector<HTMLElement>('[data-drop-transition-word]')
      const curtain = host.querySelector<HTMLElement>('[data-drop-curtain]')
      const sceneHud = host.querySelector<HTMLElement>('[data-drop-hud]')
      const video = scene.querySelector<HTMLVideoElement>('.lealt-motion-video')
      const phaseA = scene.querySelector<HTMLElement>('[data-drop-phase="a"]')
      const phaseB = scene.querySelector<HTMLElement>('[data-drop-phase="b"]')
      const core = scene.querySelector<HTMLElement>('.lealt-motion-core')
      const tracerOne = scene.querySelector<HTMLElement>('.lealt-motion-tracer-one')
      const tracerTwo = scene.querySelector<HTMLElement>('.lealt-motion-tracer-two')
      const pulseOne = scene.querySelector<HTMLElement>('.lealt-motion-pulse-one')
      const pulseTwo = scene.querySelector<HTMLElement>('.lealt-motion-pulse-two')
      const stats = host.querySelector<HTMLElement>('.home-stat-strip')

      if (!shell || !hero || !copy || !lines.length) return
      host.classList.add('drop-sequence-ready')

      const context = gsap.context(() => {
        const mediaMatcher = gsap.matchMedia()
        mediaMatcher.add({
          desktop: '(min-width: 901px)',
          mobile: '(max-width: 900px)',
          reduce: '(prefers-reduced-motion: reduce)',
        }, (matchContext) => {
          const conditions = matchContext.conditions as { desktop?: boolean; mobile?: boolean; reduce?: boolean }
          const sceneItems = [video, phaseA, phaseB, core, tracerOne, tracerTwo, pulseOne, pulseTwo]
          if (conditions.reduce) {
            gsap.set([lines, kicker, description, search, trust, featured, route, transitionWord, curtain, sceneHud, ...sceneItems], { clearProps: 'all' })
            return
          }

          gsap.set(lines, { yPercent: 118, rotateX: -16, opacity: 0, transformOrigin: '50% 100%' })
          gsap.set([kicker, description, search, trust], { y: 26, opacity: 0 })
          if (featured) gsap.set(featured, { x: 44, y: 30, opacity: 0, rotateY: -7, transformPerspective: 1000 })
          if (route) gsap.set(route, { scaleY: 0.16, opacity: 0.18, transformOrigin: '50% 0%' })
          if (transitionWord) gsap.set(transitionWord, { yPercent: 118, opacity: 0, scale: 0.74 })
          if (curtain) gsap.set(curtain, { yPercent: 102 })
          if (sceneHud) gsap.set(sceneHud, { opacity: 0 })
          if (phaseB) gsap.set(phaseB, { opacity: 0 })
          if (video) gsap.set(video, { scale: 1.035, xPercent: 0, yPercent: 0, transformOrigin: '50% 50%' })

          const entrance = gsap.timeline({ defaults: { ease: 'power3.out' } })
          entrance
            .to(kicker, { y: 0, opacity: 1, duration: 0.48 }, 0.04)
            .to(lines, { yPercent: 0, rotateX: 0, opacity: 1, duration: 0.76, stagger: 0.075 }, 0.08)
            .to(description, { y: 0, opacity: 1, duration: 0.46 }, 0.3)
            .to(search, { y: 0, opacity: 1, duration: 0.46 }, 0.38)
            .to(trust, { y: 0, opacity: 1, duration: 0.42 }, 0.46)
          if (featured) entrance.to(featured, { x: 0, y: 0, opacity: 1, rotateY: 0, duration: 0.68 }, 0.24)
          if (sceneHud) entrance.to(sceneHud, { opacity: 1, duration: 0.64 }, 0.22)

          if (conditions.desktop) {
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: shell,
                start: 'top top',
                end: 'bottom bottom',
                scrub: 0.72,
                invalidateOnRefresh: true,
                onUpdate: (self) => host.style.setProperty('--drop-sequence-progress', self.progress.toFixed(4)),
              },
            })

            timeline
              .to(video, { scale: 1.16, xPercent: -2.4, yPercent: 1.8, ease: 'none' }, 0)
              .to(phaseA, { opacity: 0.08, ease: 'none' }, 0)
              .to(phaseB, { opacity: 1, ease: 'none' }, 0.04)
              .to(core, { xPercent: -48, yPercent: 30, scale: 1.44, opacity: 0.74, ease: 'none' }, 0.03)
              .to(tracerOne, { xPercent: 180, yPercent: -120, scale: 1.25, opacity: 1, ease: 'none' }, 0.06)
              .to(tracerTwo, { xPercent: -150, yPercent: 125, scale: 1.18, opacity: 0.9, ease: 'none' }, 0.08)
              .to(pulseOne, { xPercent: -60, yPercent: 35, scale: 1.6, opacity: 0.12, ease: 'none' }, 0.05)
              .to(pulseTwo, { xPercent: 45, yPercent: -28, scale: 1.45, opacity: 0.16, ease: 'none' }, 0.08)
              .to(route, { scaleY: 1.22, opacity: 1, ease: 'none' }, 0.05)
              .to(lines[0], { xPercent: -18, yPercent: -94, opacity: 0.08, scale: 0.9, ease: 'none' }, 0.05)
              .to(lines[1], { xPercent: 12, yPercent: -48, opacity: 0.22, scale: 1.24, ease: 'none' }, 0.05)
              .to(lines[2], { xPercent: -8, yPercent: -18, opacity: 0, scale: 0.94, ease: 'none' }, 0.05)
              .to([kicker, description, search, trust], { y: -112, opacity: 0, stagger: 0.02, ease: 'none' }, 0.08)
            if (featured) {
              timeline
                .to(featured, { xPercent: -52, yPercent: 10, scale: 1.12, rotateZ: -1.2, ease: 'none' }, 0.14)
                .to(featured, { yPercent: 98, scale: 0.82, opacity: 0, ease: 'none' }, 0.62)
            }
            if (transitionWord) {
              timeline
                .to(transitionWord, { yPercent: 0, opacity: 0.24, scale: 1, ease: 'none' }, 0.44)
                .to(transitionWord, { yPercent: -24, opacity: 0.08, scale: 1.18, ease: 'none' }, 0.76)
            }
            if (curtain) timeline.to(curtain, { yPercent: 0, ease: 'none' }, 0.68)
          } else {
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger: hero,
                start: 'top top+=56',
                end: 'bottom top+=110',
                scrub: 0.55,
                invalidateOnRefresh: true,
                onUpdate: (self) => host.style.setProperty('--drop-sequence-progress', self.progress.toFixed(4)),
              },
            })
            timeline
              .to(video, { scale: 1.11, xPercent: -1.4, yPercent: 1.2, ease: 'none' }, 0)
              .to(phaseA, { opacity: 0.08, ease: 'none' }, 0)
              .to(phaseB, { opacity: 0.9, ease: 'none' }, 0.05)
              .to(core, { xPercent: -24, yPercent: 18, scale: 1.22, ease: 'none' }, 0)
              .to(lines[0], { xPercent: -8, yPercent: -62, opacity: 0.18, ease: 'none' }, 0)
              .to(lines[1], { xPercent: 7, yPercent: -34, opacity: 0.32, scale: 1.08, ease: 'none' }, 0)
              .to(lines[2], { yPercent: -15, opacity: 0, ease: 'none' }, 0)
              .to([kicker, description, search, trust], { y: -70, opacity: 0, stagger: 0.02, ease: 'none' }, 0.04)
            if (transitionWord) timeline.to(transitionWord, { yPercent: 0, opacity: 0.12, scale: 1, ease: 'none' }, 0.48)
          }

          host.querySelectorAll<HTMLElement>('.lealt-scroll-reveal').forEach((element, index) => {
            if (element === stats) return
            gsap.fromTo(element,
              { y: 72, opacity: 0, scale: 0.965, clipPath: 'inset(12% 0 0 0)' },
              {
                y: 0,
                opacity: 1,
                scale: 1,
                clipPath: 'inset(0% 0 0 0)',
                duration: 0.78,
                ease: 'power3.out',
                scrollTrigger: { trigger: element, start: 'top 91%', once: true },
                delay: Math.min(index, 3) * 0.02,
              },
            )
          })

          if (stats) {
            gsap.fromTo(stats,
              { y: 72, opacity: 0, scaleY: 0.92 },
              { y: 0, opacity: 1, scaleY: 1, ease: 'power3.out', scrollTrigger: { trigger: stats, start: 'top 96%', end: 'top 78%', scrub: 0.5 } },
            )
          }

          return () => entrance.kill()
        })
      }, host)

      let pointerFrame = 0
      const pointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch' || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
        pointerFrame = window.requestAnimationFrame(() => {
          const x = (event.clientX / Math.max(1, window.innerWidth) - 0.5) * 2
          const y = (event.clientY / Math.max(1, window.innerHeight) - 0.5) * 2
          host.style.setProperty('--lealt-pointer-x', `${(x * 32).toFixed(2)}px`)
          host.style.setProperty('--lealt-pointer-y', `${(y * 24).toFixed(2)}px`)
          host.style.setProperty('--lealt-pointer-x-inverse', `${(x * -24).toFixed(2)}px`)
          host.style.setProperty('--lealt-pointer-y-inverse', `${(y * -18).toFixed(2)}px`)
          pointerFrame = 0
        })
      }
      const pointerLeave = () => {
        host.style.setProperty('--lealt-pointer-x', '0px')
        host.style.setProperty('--lealt-pointer-y', '0px')
        host.style.setProperty('--lealt-pointer-x-inverse', '0px')
        host.style.setProperty('--lealt-pointer-y-inverse', '0px')
      }

      const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(() => ScrollTrigger.refresh()) : null
      resizeObserver?.observe(host)
      window.addEventListener('pointermove', pointerMove, { passive: true })
      window.addEventListener('pointerleave', pointerLeave)
      window.setTimeout(() => ScrollTrigger.refresh(), 90)

      cleanup = () => {
        if (pointerFrame) window.cancelAnimationFrame(pointerFrame)
        resizeObserver?.disconnect()
        window.removeEventListener('pointermove', pointerMove)
        window.removeEventListener('pointerleave', pointerLeave)
        context.revert()
        host.classList.remove('drop-sequence-ready')
        host.style.removeProperty('--drop-sequence-progress')
      }
    }

    if (host.classList.contains('public-home-redesign')) {
      void setupDropSequence()
    } else {
      cleanup = setupAmbient()
    }

    return () => {
      cancelled = true
      cleanup?.()
    }
  }, [])

  return (
    <div ref={sceneRef} className={`lealt-motion-scene ${className}`.trim()} aria-hidden="true">
      <span
        className="lealt-motion-video-poster"
        style={{ backgroundImage: `url(${DROPZONE_MOTION_POSTER})` }}
      />
      {videoEnabled ? (
        <video
          ref={videoRef}
          className="lealt-motion-video"
          muted
          loop
          playsInline
          preload="metadata"
          poster={DROPZONE_MOTION_POSTER}
          disablePictureInPicture
          tabIndex={-1}
        >
          <source media="(max-width: 900px)" src={DROPZONE_MOTION_VIDEO_MOBILE} type="video/mp4" />
          <source src={DROPZONE_MOTION_VIDEO_WEBM} type="video/webm" />
          <source src={DROPZONE_MOTION_VIDEO_MP4} type="video/mp4" />
        </video>
      ) : null}
      <span className="lealt-motion-video-tint" />
      <span className="lealt-motion-phase lealt-motion-phase-a" data-drop-phase="a" />
      <span className="lealt-motion-phase lealt-motion-phase-b" data-drop-phase="b" />
      <span className="lealt-motion-core" />
      <span className="lealt-motion-tracer lealt-motion-tracer-one" />
      <span className="lealt-motion-tracer lealt-motion-tracer-two" />
      <span className="lealt-motion-pulse lealt-motion-pulse-one" />
      <span className="lealt-motion-pulse lealt-motion-pulse-two" />
      <span className="lealt-motion-shard lealt-motion-shard-one" />
      <span className="lealt-motion-shard lealt-motion-shard-two" />
      <span className="lealt-motion-glow" />
      <span className="lealt-motion-cross lealt-motion-cross-one" />
      <span className="lealt-motion-cross lealt-motion-cross-two" />
    </div>
  )
}
