'use client'

import { Plus, Trash2 } from 'lucide-react'
import {
  formatMoneyBRL,
  moneyInputToValue,
  moneyValueToDisplay,
  newDivisaoId,
  parseDivisaoPremiacao,
  parseMoneyNumber,
  remainingPremiacao,
  serializeDivisaoPremiacao,
  sumDivisaoPremiacao,
  type PremiacaoDivisaoItem,
} from '@/lib/premiacao-divisao'

type Props = {
  /** Total da premiação (string numérica "1000.00" ou number) */
  totalPremiacao: string | number
  /** JSON ou texto legado da divisão */
  value: string
  onChange: (serialized: string) => void
  disabled?: boolean
  /** Rótulo do total exibido no topo */
  label?: string
}

export function PremiacaoDivisaoEditor({
  totalPremiacao,
  value,
  onChange,
  disabled,
  label = 'Divisão da premiação',
}: Props) {
  const items = parseDivisaoPremiacao(value)
  const total = parseMoneyNumber(totalPremiacao)
  const used = sumDivisaoPremiacao(items)
  const remaining = remainingPremiacao(total, items)
  const canAdd = !disabled && total > 0 && remaining > 0.001

  function commit(next: PremiacaoDivisaoItem[]) {
    onChange(serializeDivisaoPremiacao(next))
  }

  function addItem() {
    if (!canAdd) return
    const max = Math.round(remaining * 100) / 100
    commit([
      ...items,
      {
        id: newDivisaoId(),
        nome: items.length === 0 ? 'Campeão' : items.length === 1 ? 'Vice' : `${items.length + 1}º lugar`,
        valor: max,
      },
    ])
  }

  function updateItem(id: string, patch: Partial<PremiacaoDivisaoItem>) {
    commit(
      items.map((item) => {
        if (item.id !== id) return item
        const next = { ...item, ...patch }
        if (patch.valor !== undefined) {
          const others = items.filter((i) => i.id !== id)
          const othersSum = sumDivisaoPremiacao(others)
          const maxAllowed = total > 0
            ? Math.max(0, Math.round((total - othersSum) * 100) / 100)
            : parseMoneyNumber(patch.valor)
          next.valor = Math.min(parseMoneyNumber(patch.valor), maxAllowed)
        }
        return next
      }),
    )
  }

  function removeItem(id: string) {
    commit(items.filter((i) => i.id !== id))
  }

  return (
    <div className="premiacao-divisao-editor">
      <div className="premiacao-divisao-head">
        <div>
          <p className="eyebrow">{label}</p>
          <small className="muted">
            Informe o nome da colocação e o valor. O restante do prêmio é calculado automaticamente.
          </small>
        </div>
        <div className="premiacao-budget">
          <div>
            <span>Total</span>
            <strong>{formatMoneyBRL(total)}</strong>
          </div>
          <div>
            <span>Usado</span>
            <strong>{formatMoneyBRL(used)}</strong>
          </div>
          <div className={remaining < -0.001 ? 'over' : remaining < 0.01 ? 'ok' : ''}>
            <span>Restante</span>
            <strong>{formatMoneyBRL(Math.max(0, remaining))}</strong>
          </div>
        </div>
      </div>

      {total <= 0 ? (
        <p className="empty premiacao-divisao-hint">
          Defina primeiro o <strong>valor total da premiação</strong> para liberar as divisões.
        </p>
      ) : null}

      <div className="premiacao-divisao-list">
        {items.map((item, index) => {
          const othersSum = sumDivisaoPremiacao(items.filter((i) => i.id !== item.id))
          const maxThis = total > 0
            ? Math.max(0, Math.round((total - othersSum) * 100) / 100)
            : item.valor
          return (
            <div key={item.id} className="premiacao-divisao-row">
              <label className="premiacao-divisao-field">
                <span>Nome / colocação</span>
                <input
                  type="text"
                  disabled={disabled}
                  value={item.nome}
                  placeholder={index === 0 ? 'Campeão' : `${index + 1}º lugar`}
                  onChange={(e) => updateItem(item.id, { nome: e.target.value })}
                />
              </label>
              <label className="premiacao-divisao-field">
                <span>Premiação</span>
                <input
                  inputMode="numeric"
                  disabled={disabled}
                  value={moneyValueToDisplay(item.valor)}
                  placeholder="R$ 0,00"
                  onChange={(e) => {
                    const nextVal = moneyInputToValue(e.target.value)
                    updateItem(item.id, { valor: parseMoneyNumber(nextVal) })
                  }}
                />
                <small className="muted">Máx. {formatMoneyBRL(maxThis)}</small>
              </label>
              <button
                type="button"
                className="icon-action-button danger"
                disabled={disabled}
                title="Remover divisão"
                onClick={() => removeItem(item.id)}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
      </div>

      <div className="premiacao-divisao-actions">
        <button
          type="button"
          className="button secondary"
          disabled={!canAdd}
          onClick={addItem}
          title={
            total <= 0
              ? 'Informe o valor total da premiação'
              : remaining <= 0
                ? 'Todo o valor já foi distribuído'
                : `Disponível: ${formatMoneyBRL(remaining)}`
          }
        >
          <Plus size={16} /> Adicionar divisão
          {remaining > 0.001 && total > 0 ? (
            <em className="premiacao-rest-tag">restam {formatMoneyBRL(remaining)}</em>
          ) : null}
        </button>
        {remaining < -0.001 ? (
          <span className="premiacao-over-warn">A soma das divisões ultrapassa o total.</span>
        ) : null}
        {total > 0 && remaining <= 0.001 && items.length > 0 ? (
          <span className="premiacao-full-ok">100% da premiação distribuída.</span>
        ) : null}
      </div>
    </div>
  )
}
