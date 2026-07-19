import type { CSSProperties } from 'react'
import type {
  BoxStyle,
  FillStyle,
  FieldStyle,
  StreamMotionKind,
  TextStyle,
  TransitionStyle,
} from '../types/stream.types'
import { normalizeTransition } from '../types/stream.types'

export function fillToCss(fill?: FillStyle): CSSProperties {
  if (!fill) return {}
  const opacity = fill.opacity ?? 1
  if (fill.mode === 'none') {
    return {
      backgroundColor: 'transparent',
      backgroundImage: 'none',
      opacity,
    }
  }
  if (fill.mode === 'gradient') {
    const angle = fill.angle ?? 180
    const from = fill.color || '#1a1d24'
    const to = fill.colorTo || fill.color || '#000'
    return {
      backgroundImage: `linear-gradient(${angle}deg, ${from}, ${to})`,
      opacity,
    }
  }
  if (fill.mode === 'image' && fill.imageUrl) {
    const ovAmount = fill.overlayOpacity ?? 0
    const overlay = fill.overlayColor || '#000000'
    const hex = overlay.replace('#', '').slice(0, 6)
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex.padEnd(6, '0')
    const a = Math.round(Math.min(1, Math.max(0, ovAmount)) * 255)
      .toString(16)
      .padStart(2, '0')
    const safeUrl = String(fill.imageUrl).replace(/"/g, '%22')
    return {
      backgroundImage:
        ovAmount > 0
          ? `linear-gradient(#${full}${a}, #${full}${a}), url("${safeUrl}")`
          : `url("${safeUrl}")`,
      backgroundSize: fill.fit === 'contain' ? 'contain' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: 'transparent',
      opacity,
    }
  }
  return {
    backgroundColor: fill.color || 'transparent',
    backgroundImage: 'none',
    opacity,
  }
}

export function textToCss(text?: TextStyle): CSSProperties {
  if (!text) return {}
  return {
    fontFamily: `"${text.fontFamily}", "Segoe UI", Arial, sans-serif`,
    fontWeight: text.fontWeight,
    fontSize: text.fontSize,
    color: text.color,
    textAlign: text.align || 'left',
    textTransform: text.uppercase ? 'uppercase' : 'none',
    letterSpacing: text.letterSpacing != null ? `${text.letterSpacing}em` : undefined,
    textShadow: text.textShadow || undefined,
    lineHeight: 1.15,
  }
}

export function boxToCss(box?: BoxStyle): CSSProperties {
  if (!box) return {}
  const fillCss = fillToCss(box.fill)
  const skewX = box.skewX || 0
  const skewY = box.skewY || 0
  const rotate = box.rotate || 0
  const transforms: string[] = []
  if (skewX || skewY) transforms.push(`skew(${skewX}deg, ${skewY}deg)`)
  if (rotate) transforms.push(`rotate(${rotate}deg)`)
  return {
    ...fillCss,
    borderColor: box.borderColor || 'transparent',
    borderWidth: box.borderWidth ?? 0,
    borderStyle: (box.borderWidth ?? 0) > 0 ? 'solid' : 'none',
    borderRadius: box.borderRadius ?? 0,
    padding: box.padding ?? 0,
    opacity: box.opacity ?? fillCss.opacity ?? 1,
    transform: transforms.length ? transforms.join(' ') : undefined,
    boxSizing: 'border-box',
  }
}

export function fieldToCss(style?: FieldStyle): { wrap: CSSProperties; text: CSSProperties } {
  return {
    wrap: boxToCss(style?.box),
    text: textToCss(style?.text),
  }
}

export function fillToCssSafe(fill?: FillStyle): CSSProperties {
  if (!fill) return {}
  if (fill.mode === 'none') {
    return { backgroundColor: 'transparent', backgroundImage: 'none', opacity: fill.opacity ?? 1 }
  }
  if (fill.mode === 'image' && fill.imageUrl) {
    const ovAmount = fill.overlayOpacity ?? 0
    const ov = withAlpha(fill.overlayColor || '#000000', ovAmount)
    const safeUrl = String(fill.imageUrl).replace(/\\/g, '/').replace(/"/g, '%22')
    return {
      backgroundImage: ovAmount > 0 ? `linear-gradient(${ov}, ${ov}), url("${safeUrl}")` : `url("${safeUrl}")`,
      backgroundSize: fill.fit === 'contain' ? 'contain' : 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: 'transparent',
      opacity: fill.opacity ?? 1,
    }
  }
  return fillToCss(fill)
}

export function boxToCssSafe(box?: BoxStyle): CSSProperties {
  if (!box) return {}
  const fillCss = fillToCssSafe(box.fill)
  const base = boxToCss({ ...box, fill: undefined })
  const opacity = box.opacity != null ? box.opacity : (fillCss.opacity as number | undefined) ?? 1
  return { ...base, ...fillCss, opacity }
}

function motionId(kind?: StreamMotionKind | null): StreamMotionKind {
  if (!kind || kind === 'stagger') return 'fade'
  return kind
}

/** Classe CSS de entrada no wrapper (bloco inteiro). */
export function transitionClass(t?: TransitionStyle | null): string {
  const n = normalizeTransition(t)
  if (n.applyTo === 'children') return ''
  const enter = motionId(n.enter)
  if (enter === 'none') return ''
  return `stream-motion stream-motion-enter stream-motion-enter-${enter}`
}

/** Classe CSS de saída no wrapper. */
export function exitTransitionClass(t?: TransitionStyle | null): string {
  const n = normalizeTransition(t)
  if (n.applyTo === 'children') return ''
  const exit = motionId(n.exit || n.enter)
  if (exit === 'none') return ''
  return `stream-motion stream-motion-exit stream-motion-exit-${exit}`
}

export function transitionStyle(
  t?: TransitionStyle | null,
  index = 0,
  kind: 'enter' | 'exit' = 'enter',
): CSSProperties {
  const n = normalizeTransition(t)
  if (n.applyTo === 'children') return {}
  const delay = n.delayMs + (kind === 'enter' ? index * (n.staggerMs || 0) : 0)
  return unitMotionStyle(n, kind, 0, delay)
}

/**
 * Classe de movimento por unidade (linha / camada / header).
 */
export function unitMotionClass(
  t?: TransitionStyle | null,
  kind: 'enter' | 'exit' = 'enter',
): string {
  const n = normalizeTransition(t)
  if (n.applyTo !== 'children') return ''
  const motion = motionId(kind === 'enter' ? n.enter : n.exit || n.enter)
  if (motion === 'none') return ''
  return `stream-motion stream-motion-${kind} stream-motion-${kind}-${motion}`
}

/**
 * Estilo de animação por unidade.
 * `index` = ordem da linha/item; delay = delayMs + index * staggerMs
 */
export function unitMotionStyle(
  t?: TransitionStyle | null,
  kind: 'enter' | 'exit' = 'enter',
  index = 0,
  delayOverride?: number,
): CSSProperties {
  const n = normalizeTransition(t)
  const motion = motionId(kind === 'enter' ? n.enter : n.exit || n.enter)
  if (motion === 'none') return {}
  const delay =
    delayOverride != null
      ? delayOverride
      : n.delayMs + index * (n.staggerMs || 0)
  return {
    ['--stream-motion-dist' as string]: `${n.distancePx}px`,
    animationDuration: `${n.durationMs}ms`,
    animationDelay: `${delay}ms`,
    animationFillMode: 'both',
    animationTimingFunction: kind === 'exit' ? 'ease-in' : 'cubic-bezier(0.22, 1, 0.36, 1)',
  }
}

/** Tempo total aproximado (ms) para limpar preview. */
export function transitionTotalMs(t?: TransitionStyle | null, unitCount = 1): number {
  const n = normalizeTransition(t)
  const units = Math.max(1, unitCount)
  const stagger = n.applyTo === 'children' ? (units - 1) * (n.staggerMs || 0) : 0
  return n.delayMs + stagger + n.durationMs + 80
}

export function withAlpha(hex: string, alpha: number): string {
  const a = Math.max(0, Math.min(1, alpha))
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    const full = hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex
    const r = parseInt(full.slice(1, 3), 16)
    const g = parseInt(full.slice(3, 5), 16)
    const b = parseInt(full.slice(5, 7), 16)
    return `rgba(${r},${g},${b},${a})`
  }
  return hex
}
