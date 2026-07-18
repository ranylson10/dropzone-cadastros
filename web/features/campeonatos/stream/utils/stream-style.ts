import type { CSSProperties } from 'react'
import type { BoxStyle, FillStyle, FieldStyle, TextStyle, TransitionStyle } from '../types/stream.types'

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

export function transitionClass(t?: TransitionStyle): string {
  if (!t || t.enter === 'none') return ''
  return `stream-enter-${t.enter}`
}

/** Classe CSS de saída (preview / hide). */
export function exitTransitionClass(t?: TransitionStyle): string {
  const exit = t?.exit || (t?.enter && t.enter !== 'stagger' ? t.enter : 'fade')
  if (!exit || exit === 'none') return ''
  return `stream-exit-${exit}`
}

export function transitionStyle(
  t?: TransitionStyle,
  index = 0,
  kind: 'enter' | 'exit' = 'enter',
): CSSProperties {
  if (!t) return {}
  const delay =
    kind === 'enter'
      ? (t.delayMs || 0) + (t.enter === 'stagger' ? index * 90 : 0)
      : t.delayMs || 0
  return {
    animationDuration: `${t.durationMs || 400}ms`,
    animationDelay: `${delay}ms`,
    animationFillMode: 'both',
    animationTimingFunction: kind === 'exit' ? 'ease-in' : 'ease-out',
  }
}

/** Converte hex 8 dígitos helper — fallback se overlay alpha inválido */
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
  // não sobrescrever opacity do fill com 1 se box.opacity for undefined
  const opacity = box.opacity != null ? box.opacity : (fillCss.opacity as number | undefined) ?? 1
  return { ...base, ...fillCss, opacity }
}
