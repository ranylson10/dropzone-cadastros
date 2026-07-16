import type { CSSProperties } from 'react'

/** Tema visual do campeonato: adm escolhe cores + opacidade do BG + imagem opcional. */
export type ChampionshipThemeInput = {
  cor_principal?: string | null
  cor_secundaria?: string | null
  /** 0–100: intensidade da cor no fundo. */
  bg_opacidade?: number | string | null
  /** URL pública da imagem de fundo (opcional). */
  bg_image_url?: string | null
  /** Legado — sistema calcula contraste. */
  cor_texto_clara?: string | null
  cor_texto_escura?: string | null
}

export type ResolvedChampionshipTheme = {
  primary: string
  secondary: string
  lighter: string
  darker: string
  button: string
  buttonText: string
  bgOpacity: number
  bgImageUrl: string | null
  bg: string
  surface: string
  surfaceSoft: string
  border: string
  text: string
  textMuted: string
  onPrimary: string
  onSecondary: string
  onButton: string
  onDark: string
  onLight: string
  bannerFrom: string
  bannerTo: string
  onBanner: string
  accentSoft: string
  cssVars: CSSProperties
}

const DEFAULT_PRIMARY = '#ff4655'
const DEFAULT_SECONDARY = '#17191d'
const DEFAULT_BG_OPACITY = 18

export function normalizeHexColor(value: unknown, fallback = DEFAULT_PRIMARY): string {
  const raw = String(value || '').trim()
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const m = raw.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/)
    if (m) return `#${m[1]}${m[1]}${m[2]}${m[2]}${m[3]}${m[3]}`.toLowerCase()
  }
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase()
  return fallback
}

/** Opacidade do fundo 0–100 (padrão 18). */
export function normalizeBgOpacity(value: unknown, fallback = DEFAULT_BG_OPACITY): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(100, Math.max(0, Math.round(n)))
}

export function normalizeBgImageUrl(value: unknown): string | null {
  const raw = String(value || '').trim()
  if (!raw) return null
  if (raw.startsWith('https://') || raw.startsWith('http://') || raw.startsWith('/')) return raw
  return null
}

function clamp(n: number, min = 0, max = 255) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = normalizeHexColor(hex, '#000000').slice(1)
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`
}

function hexToRgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex)
  const a = Math.min(1, Math.max(0, alpha))
  return `rgba(${r}, ${g}, ${b}, ${Number(a.toFixed(3))})`
}

/** Luminância relativa (0–1) — WCAG. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

export function mixHex(hexA: string, hexB: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount))
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  return rgbToHex(
    a.r + (b.r - a.r) * t,
    a.g + (b.g - a.g) * t,
    a.b + (b.b - a.b) * t,
  )
}

export function darkenHex(hex: string, amount: number): string {
  return mixHex(hex, '#000000', amount)
}

export function lightenHex(hex: string, amount: number): string {
  return mixHex(hex, '#ffffff', amount)
}

export function contrastText(bgHex: string, light = '#ffffff', dark = '#17191d'): string {
  const L = relativeLuminance(bgHex)
  return L > 0.45 ? dark : light
}

function contrastRatio(a: string, b: string): number {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Botões usam sempre a cor mais escura entre as duas escolhidas. */
function resolveDarkerButton(primary: string, secondary: string): string {
  let btn = relativeLuminance(primary) <= relativeLuminance(secondary) ? primary : secondary
  // Se ainda estiver clara demais (duas cores claras), escurece um pouco
  if (relativeLuminance(btn) > 0.55) {
    btn = darkenHex(btn, 0.28)
  }
  let text = contrastText(btn)
  let guard = 0
  while (contrastRatio(btn, text) < 3 && guard < 6) {
    btn = darkenHex(btn, 0.12)
    text = contrastText(btn)
    guard += 1
  }
  return btn
}

function cssUrl(url: string | null): string {
  if (!url) return 'none'
  // escapa aspas na URL
  const safe = url.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  return `url("${safe}")`
}

/**
 * Resolve a paleta completa.
 * - Cor mais escura → botões / ações
 * - Cor mais clara → tingimento do fundo (com % de opacidade do adm)
 * - Imagem de fundo opcional + overlay colorido
 */
export function resolveChampionshipTheme(input?: ChampionshipThemeInput | null): ResolvedChampionshipTheme {
  const primary = normalizeHexColor(input?.cor_principal, DEFAULT_PRIMARY)
  const secondary = normalizeHexColor(input?.cor_secundaria, DEFAULT_SECONDARY)
  const bgOpacity = normalizeBgOpacity(input?.bg_opacidade, DEFAULT_BG_OPACITY)
  const bgImageUrl = normalizeBgImageUrl(input?.bg_image_url)
  const tintAmount = bgOpacity / 100

  const darker = relativeLuminance(primary) <= relativeLuminance(secondary) ? primary : secondary
  const lighter = darker === primary ? secondary : primary

  const button = resolveDarkerButton(primary, secondary)
  const onButton = contrastText(button)
  const onPrimary = contrastText(primary)
  const onSecondary = contrastText(secondary)

  // Fundo: branco + cor mais clara na % escolhida
  const bg = mixHex('#ffffff', lighter, Math.min(0.85, tintAmount * 0.95 + 0.04))
  // Se a “clara” for escura (duas cores escuras), usa a principal mais suave
  const bgSafe =
    relativeLuminance(bg) < 0.55 ? mixHex('#ffffff', primary, Math.min(0.35, tintAmount * 0.5 + 0.06)) : bg

  const surface = mixHex('#ffffff', lighter, Math.min(0.2, tintAmount * 0.25))
  const surfaceSoft = mixHex('#ffffff', lighter, Math.min(0.32, tintAmount * 0.4 + 0.04))
  const border = mixHex('#e4e7ec', darker, Math.min(0.35, tintAmount * 0.35 + 0.08))
  const accentSoft = mixHex('#ffffff', primary, Math.min(0.28, tintAmount * 0.35 + 0.08))

  const text = contrastText(surface, '#ffffff', '#17191d')
  const textMuted = mixHex(text, surface, 0.42)
  const onLight = contrastText('#f7f8fa')
  const onDark = contrastText(darkenHex(darker, 0.1))

  const bannerFrom = primary
  const bannerTo = secondary
  const bannerMid = mixHex(primary, secondary, 0.5)
  const onBanner = contrastText(bannerMid)

  // Overlay só quando há imagem (sem imagem o BG já usa a opacidade na cor sólida)
  const bgOverlay = bgImageUrl
    ? hexToRgba(mixHex('#ffffff', lighter, Math.min(0.9, tintAmount + 0.15)), Math.min(0.92, 0.28 + tintAmount * 0.6))
    : 'transparent'

  const cssVars = {
    ['--dz-primary' as string]: primary,
    ['--dz-secondary' as string]: secondary,
    ['--dz-lighter' as string]: lighter,
    ['--dz-darker' as string]: darker,
    ['--dz-btn' as string]: button,
    ['--dz-btn-text' as string]: onButton,
    ['--dz-bg' as string]: bgSafe,
    ['--dz-bg-opacity' as string]: String(bgOpacity),
    ['--dz-bg-overlay' as string]: bgOverlay,
    ['--dz-bg-image' as string]: cssUrl(bgImageUrl),
    ['--dz-has-bg-image' as string]: bgImageUrl ? '1' : '0',
    ['--dz-surface' as string]: surface,
    ['--dz-surface-soft' as string]: surfaceSoft,
    ['--dz-border' as string]: border,
    ['--dz-text' as string]: text,
    ['--dz-text-muted' as string]: textMuted,
    ['--dz-on-primary' as string]: onPrimary,
    ['--dz-on-secondary' as string]: onSecondary,
    ['--dz-on-dark' as string]: onDark,
    ['--dz-on-light' as string]: onLight,
    ['--dz-text-on-dark' as string]: onDark,
    ['--dz-text-on-light' as string]: onLight,
    ['--dz-banner-from' as string]: bannerFrom,
    ['--dz-banner-to' as string]: bannerTo,
    ['--dz-on-banner' as string]: onBanner,
    ['--dz-accent-soft' as string]: accentSoft,
  } as CSSProperties

  return {
    primary,
    secondary,
    lighter,
    darker,
    button,
    buttonText: onButton,
    bgOpacity,
    bgImageUrl,
    bg: bgSafe,
    surface,
    surfaceSoft,
    border,
    text,
    textMuted,
    onPrimary,
    onSecondary,
    onButton,
    onDark,
    onLight,
    bannerFrom,
    bannerTo,
    onBanner,
    accentSoft,
    cssVars,
  }
}

export function championshipThemeStyle(input?: ChampionshipThemeInput | null): CSSProperties {
  return resolveChampionshipTheme(input).cssVars
}
