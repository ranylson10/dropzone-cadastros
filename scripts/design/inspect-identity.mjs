export function inspectIdentity() {
    function blue(value) {
      return [...value.matchAll(/rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/g)].some(match => {
        const [r, g, b] = match.slice(1, 4).map(Number)
        if (match[4] && Number(match[4]) < .06) return false
        const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min
        const saturation = max === 0 ? 0 : delta / max
        const hue = delta === 0 ? 0 : (max === r ? (g - b) / delta + (g < b ? 6 : 0) : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4) * 60
        return saturation > .18 && hue >= 180 && hue <= 300 && delta > 12
      })
    }
    const groups = new Map()
    for (const element of document.querySelectorAll('body *')) {
      if (element.closest('img,svg,canvas,video,nextjs-portal,[data-identity-color="custom"]')) continue
      const box = element.getBoundingClientRect()
      const css = getComputedStyle(element)
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true }) || box.width < 4 || box.height < 4 || css.display === 'none' || css.visibility === 'hidden' || css.opacity === '0' || !element.getClientRects().length) continue
      const values = { background: css.backgroundColor, gradient: css.backgroundImage, border: css.borderTopWidth !== '0px' ? css.borderTopColor : '', text: css.color }
      const flagged = Object.entries(values).filter(([, value]) => blue(value))
      if (!flagged.length) continue
      const classes = typeof element.className === 'string' ? element.className.split(/\s+/).filter(Boolean) : []
      const selector = element.tagName.toLowerCase() + classes.slice(0, 4).map(name => `.${name}`).join('')
      const semantic = Boolean(element.closest('[data-identity-color="semantic"],.rank-tier,.rank-tier-badge,.dz-ui-badge--info,.message.error,.message.success,.dz-feedback--error,.dz-feedback--success'))
      const key = `${selector}:${JSON.stringify(flagged)}`
      const previous = groups.get(key)
      groups.set(key, { selector, values: Object.fromEntries(flagged), semantic, count: (previous?.count || 0) + 1, sample: (element.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 65) })
    }
    return { title: document.title, overflow: document.documentElement.scrollWidth > innerWidth + 2, findings: [...groups.values()] }
}
