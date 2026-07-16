import type { CSSProperties } from 'react'

/** Tema visual do campeonato: adm escolhe 2 cores; o sistema gera o resto. */
export type ChampionshipThemeInput = {
  cor_principal?: string | null
  cor_secundaria?: string | null
  /** Legado — ignorado na geração (sistema calcula contraste). */
  cor_texto_clara?: string | null
  cor_texto_escura?: string | null
}

export type ResolvedChampionshipTheme = {
  primary: string
  secondary: string
  /** Cor de botão / ação (garante contraste mínimo). */
  button: string
  buttonText: string
  /** Fundos claros (layout). */
  bg: string
  surface: string
  surfaceSoft: string
  border: string
  /** Texto em áreas claras / escuras (auto). */
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

export function normalizeHexColor(value: unknown, fallback = DEFAULT_PRIMARY): string {
  const raw = String(value || '').trim()
  if (/^#([0-9a-fA-F]{3})$/.test(raw)) {
    const [, a, b, c] = raw.match(/^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/) || []
    if (a && b && c) return `#${a}${a}${b}${b}${c}${c}`.toLowerCase()
  }
  if (/^#([0-9a-fA-F]{6})$/.test(raw)) return raw.toLowerCase()
  return fallback
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

/** Luminância relativa (0–1) — WCAG. */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  const lin = [r, g, b].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]
}

/** Mistura hexA com hexB (amount = peso de B, 0–1). */
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

/**
 * Texto legível sobre um fundo: claro se o fundo for escuro, escuro se for claro.
 * Escolhe entre branco e grafite pelo melhor contraste.
 */
export function contrastText(bgHex: string, light = '#ffffff', dark = '#17191d'): string {
  const L = relativeLuminance(bgHex)
  // limiar ~0.45: fundos médios-claros pedem texto escuro
  return L > 0.45 ? dark : light
}

function contrastRatio(a: string, b: string): number {
  const L1 = relativeLuminance(a)
  const L2 = relativeLuminance(b)
  const lighter = Math.max(L1, L2)
  const darker = Math.min(L1, L2)
  return (lighter + 0.05) / (darker + 0.05)
}

/** Garante cor de botão com contraste razoável vs texto (escurece se muito clara). */
function resolveButtonColor(primary: string): string {
  let btn = primary
  // Botões devem ser “fortes”: se a principal for clara demais, escurece
  if (relativeLuminance(btn) > 0.72) {
    btn = darkenHex(btn, 0.35)
  }
  // Garante contraste mínimo ~3:1 com o texto automático
  let text = contrastText(btn)
  let guard = 0
  while (contrastRatio(btn, text) < 3 && guard < 6) {
    btn = darkenHex(btn, 0.12)
    text = contrastText(btn)
    guard += 1
  }
  return btn
}

/**
 * Resolve a paleta completa a partir de 2 cores do adm.
 * - Cor principal → botões, abas ativas, destaques
 * - Cor secundária → suporte (banner, gradientes)
 * - Fundo / cards / texto → gerados automaticamente com contraste
 */
export function resolveChampionshipTheme(input?: ChampionshipThemeInput | null): ResolvedChampionshipTheme {
  const primary = normalizeHexColor(input?.cor_principal, DEFAULT_PRIMARY)
  const secondary = normalizeHexColor(input?.cor_secundaria, DEFAULT_SECONDARY)

  const button = resolveButtonColor(primary)
  const onButton = contrastText(button)
  const onPrimary = contrastText(primary)
  const onSecondary = contrastText(secondary)

  // Layout claro tingido pela cor principal (partes claras do layout)
  const bg = mixHex('#f4f5f7', primary, 0.12)
  const surface = mixHex('#ffffff', primary, 0.05)
  const surfaceSoft = mixHex('#ffffff', primary, 0.1)
  const border = mixHex('#e4e7ec', primary, 0.28)
  const accentSoft = mixHex('#ffffff', primary, 0.18)

  const text = contrastText(surface, '#ffffff', '#17191d')
  const textMuted = mixHex(text, surface, 0.42)
  const onLight = contrastText('#f7f8fa')
  const onDark = contrastText(darkenHex(secondary, 0.15))

  const bannerFrom = primary
  const bannerTo = secondary
  const bannerMid = mixHex(primary, secondary, 0.5)
  const onBanner = contrastText(bannerMid)

  const cssVars = {
    ['--dz-primary' as string]: primary,
    ['--dz-secondary' as string]: secondary,
    ['--dz-btn' as string]: button,
    ['--dz-btn-text' as string]: onButton,
    ['--dz-bg' as string]: bg,
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
    button,
    buttonText: onButton,
    bg,
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
