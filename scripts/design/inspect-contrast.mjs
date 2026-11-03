// Direct text only, on flat surfaces. Image/gradient backgrounds need visual review.
export function inspectContrast(selector) {
  function rgba(value) { return value.match(/[\d.]+/g)?.map(Number) || [0, 0, 0, 0] }
  function luminance(rgb) { return rgb.slice(0, 3).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0) }
  function surface(element) {
    if (!element) return [255, 255, 255]
    const css = getComputedStyle(element)
    if (css.backgroundImage !== 'none') return null
    const rgb = rgba(css.backgroundColor), alpha = rgb[3] ?? 1
    if (alpha === 1) return rgb
    const parent = surface(element.parentElement)
    return parent && rgb.slice(0, 3).map((value, i) => value * alpha + parent[i] * (1 - alpha))
  }
  const findings = []
  for (const element of document.querySelectorAll(selector)) {
    if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || element.closest('svg,[disabled],[aria-disabled=true]')) continue
    const text = [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join('').trim()
    if (!text) continue
    const css = getComputedStyle(element), bg = surface(element)
    if (!bg) continue
    const fg = rgba(css.color), alpha = fg[3] ?? 1
    const foreground = fg.slice(0, 3).map((value, i) => value * alpha + bg[i] * (1 - alpha))
    const [light, dark] = [luminance(foreground), luminance(bg)].sort((a, b) => b - a)
    const ratio = (light + .05) / (dark + .05)
    const large = parseFloat(css.fontSize) >= 24 || parseFloat(css.fontSize) >= 18.66 && parseInt(css.fontWeight) >= 700
    if (ratio < (large ? 3 : 4.5)) findings.push({ selector: element.tagName.toLowerCase() + '.' + element.className, text: text.slice(0, 70), ratio: Number(ratio.toFixed(2)), foreground: css.color, background: bg })
  }
  return findings
}
