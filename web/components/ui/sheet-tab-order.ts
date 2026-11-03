/**
 * R24 — calcula o próximo alvo quando Tab tenta sair de um painel móvel.
 * Uma função pura permite verificar a ordem sem navegador nem sessão real.
 * Retorna null quando o navegador pode avançar normalmente.
 */
export function nextSheetTabTarget<T>(
  controls: readonly T[],
  current: T | null,
  shiftKey: boolean,
  insideSheet: boolean,
): T | null {
  if (controls.length === 0) return null
  const first = controls[0], last = controls[controls.length - 1]
  if (!insideSheet || current === null) return shiftKey ? last : first
  if (shiftKey && current === first) return last
  if (!shiftKey && current === last) return first
  return null
}
