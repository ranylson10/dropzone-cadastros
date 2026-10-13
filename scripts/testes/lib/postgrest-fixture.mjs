import assert from 'node:assert/strict'

export function split(text) {
  const result=[]; let depth=0,quote=false,escaped=false,start=0
  for (let i=0;i<text.length;i++) {
    const char=text[i]
    if (escaped) {escaped=false;continue}
    if (quote && char==='\\') {escaped=true;continue}
    if (char==='"') quote=!quote
    if (quote) continue
    if (char==='(') depth++
    if (char===')') depth--
    if (char===',' && depth===0) {result.push(text.slice(start,i));start=i+1}
  }
  result.push(text.slice(start));return result
}
const value = text => text.startsWith('"') ? JSON.parse(text) : text
export function match(row, expression) {
  if (expression.startsWith('(')) return split(expression.slice(1,-1)).some(part=>match(row,part))
  const logical = expression.match(/^(and|or)\((.*)\)$/s)
  if (logical) { const results=split(logical[2]).map(part=>match(row,part));return logical[1]==='and'?results.every(Boolean):results.some(Boolean) }
  const [,column,op,raw] = expression.match(/^([\w_]+)\.([\w]+)\.(.*)$/s) || []
  assert.ok(column, `Invalid filter grammar: ${expression}`)
  const actual=row[column], expected=value(raw)
  if (op==='eq') return String(actual)===expected
  if (op==='neq') return actual != null && String(actual)!==expected
  if (op==='gt') return actual != null && String(actual).localeCompare(expected)>0
  if (op==='lte') return actual != null && String(actual).localeCompare(expected)<=0
  if (op==='not') return expected==='is.null' && actual!=null
  if (op==='is') return expected==='null' && actual==null
  if (op==='in') return split(raw.slice(1,-1)).map(value).includes(String(actual))
  if (op==='ilike') {
    let pattern='';let escaped=false
    for (const char of expected) {
      if (!escaped && char==='\\') {escaped=true;continue}
      pattern += !escaped && (char==='%'||char==='*') ? '.*' : !escaped && char==='_' ? '.' : char.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')
      escaped=false
    }
    return actual != null && new RegExp(`^${pattern}$`,'i').test(String(actual))
  }
  throw new Error(`Unexpected operator ${op}`)
}
