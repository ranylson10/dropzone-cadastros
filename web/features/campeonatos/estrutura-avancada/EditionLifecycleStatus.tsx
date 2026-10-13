'use client'

import { useEffect, useRef, useState } from 'react'
import { useLifecycleMutation } from '@/hooks/useLifecycleMutation'
import { readEditionLifecycleBoard, type EditionLifecycleBoard } from '@/lib/edition-lifecycle-read'
import { previewLifecycle } from '@/lib/lifecycle-write'
import { confirmAction } from '@/components/feedback'
import type { LifecycleAction } from '@backend/campeonatos/lifecycle-contract'

export function EditionLifecycleStatus({ championshipId }: { championshipId: string }) {
  const mutation = useLifecycleMutation(championshipId), scope = mutation.scope
  const [result, setResult] = useState<{ key: string; board: EditionLifecycleBoard | null; error: string } | null>(null)
  const [review, setReview] = useState<{ key: string; action?: LifecycleAction; preview?: any; message: string; error: string; busy: boolean } | null>(null)
  const [revision, setRevision] = useState(0)
  const lock = useRef<number | null>(null)
  const { actor, ready, key, isCurrent } = scope
  useEffect(() => {
    if (!ready || !actor || !championshipId) return
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let active = true
    void readEditionLifecycleBoard(championshipId, actor, () => active && isCurrent(), controller.signal)
      .then(board => { if (active && isCurrent()) setResult({ key, board, error: '' }) })
      .catch(() => { if (active && isCurrent()) setResult({ key, board: null, error: 'Não foi possível consultar o estado da edição.' }) })
      .finally(() => clearTimeout(timeout))
    return () => { active = false; controller.abort(); clearTimeout(timeout) }
    // key changes for account/resource epochs, including A-B-A.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ready, championshipId, revision])
  const current = result?.key === key ? result : null
  const edition = current?.board?.edition, contract = current?.board?.contract
  const view = review?.key === key ? review : null
  const atomic = contract?.lifecycle_write_mode === 'atomic'
  const busy = Boolean(view?.busy || mutation.busy)
  async function inspect() {
    if (!atomic || !contract || !edition || !scope.isCurrent() || mutation.pending || !mutation.ready || lock.current === scope.epoch) return
    lock.current = scope.epoch
    const action: LifecycleAction = edition.status === 'encerrada' ? 'reopen_final' : 'publish_final'
    setReview({ key, message: '', error: '', busy: true })
    try {
      const response = await previewLifecycle(championshipId, contract, action, () => { if (!scope.isCurrent()) throw Error('A conta ou o campeonato mudou.') })
      if (scope.isCurrent()) setReview({ key, action, preview: response.preview, message: 'Confira os dados antes de confirmar.', error: '', busy: false })
    } catch (error) { if (scope.isCurrent()) setReview({ key, message: '', error: error instanceof Error ? error.message : 'Não foi possível preparar a edição.', busy: false }) }
    finally { if (lock.current === scope.epoch) lock.current = null }
  }
  async function confirm() {
    if (!view?.preview || !view.action || !contract || !atomic || busy || mutation.pending || !scope.isCurrent() || lock.current === scope.epoch) return
    lock.current = scope.epoch; setReview({ ...view, busy: true, error: '' })
    try {
      if (!await confirmAction(view.action === 'publish_final'
        ? `Encerrar a edição com ${view.preview.plan.falls} queda(s) finalizada(s) e ${view.preview.plan.total_equipes} equipe(s)? As inscrições serão fechadas.`
        : 'Reabrir a edição e ativar todas as etapas e divisões encerradas? As canceladas serão preservadas e as inscrições continuarão fechadas.') || !scope.isCurrent()) return
      await mutation.run(contract, { action: view.action, expected: view.preview.fence })
      if (scope.isCurrent()) { setReview({ key, message: view.action === 'publish_final' ? 'Encerramento confirmado. Atualize para conferir o estado atual.' : 'Reabertura confirmada. As inscrições continuam fechadas.', error: '', busy: false }); setRevision(value => value + 1) }
    } catch (error) { if (scope.isCurrent()) setReview(previous => ({ ...previous, key, message: '', error: error instanceof Error ? error.message : 'Não foi possível confirmar.', busy: false })) }
    finally { if (lock.current === scope.epoch) lock.current = null; if (scope.isCurrent()) setReview(previous => previous?.key === key ? { ...previous, busy: false } : previous) }
  }
  async function retry() {
    if (busy || !scope.isCurrent() || lock.current === scope.epoch) return
    lock.current = scope.epoch; setReview(previous => ({ ...previous, key, message: '', error: '', busy: true }))
    try { await mutation.retry(); if (scope.isCurrent()) { setReview({ key, message: 'Tentativa original confirmada. Atualize para conferir o estado atual.', error: '', busy: false }); setRevision(value => value + 1) } }
    catch (error) { if (scope.isCurrent()) setReview(previous => ({ ...previous, key, message: '', error: error instanceof Error ? error.message : 'Não foi possível confirmar.', busy: false })) }
    finally { if (lock.current === scope.epoch) lock.current = null; if (scope.isCurrent()) setReview(previous => previous?.key === key ? { ...previous, busy: false } : previous) }
  }
  async function discard() {
    if (busy || !scope.isCurrent() || lock.current === scope.epoch) return
    lock.current = scope.epoch; setReview(previous => ({ ...previous, key, message: '', error: '', busy: true }))
    try {
      if (!await confirmAction('Após conferir a edição e o histórico, encerrar a tentativa local? Isso não desfaz uma operação já confirmada no servidor.') || !scope.isCurrent()) return
      if (await mutation.discard() && scope.isCurrent()) setReview({ key, message: 'Tentativa local encerrada. Confira novamente a edição.', error: '', busy: false })
    } finally { if (lock.current === scope.epoch) lock.current = null; if (scope.isCurrent()) setReview(previous => previous?.key === key ? { ...previous, busy: false } : previous) }
  }
  return <section className="champ-overview-card championship-lifecycle-card">
    <div className="champ-overview-checklist-head">
      <div>
        <p className="eyebrow">Encerramento</p>
        <h3>{edition?.status === 'encerrada' ? 'Season encerrada' : 'Resultado oficial'}</h3>
        <span>{edition?.status === 'encerrada'
          ? `Edição encerrada${edition.data_fim ? ` em ${edition.data_fim}` : ''}.`
          : current?.error ? 'Estado da edição indisponível.'
            : current ? edition ? `Edição ${edition.status}.` : 'Esta edição ainda não possui vínculo de season.'
            : ready && !actor ? 'Entre na sua conta para consultar a edição.' : 'Consultando edição...'}</span>
      </div>
      {edition ? <button type="button" className="button secondary" disabled={!atomic || busy || !mutation.ready || Boolean(mutation.pending)} onClick={() => void inspect()}>
        {atomic ? edition.status === 'encerrada' ? 'Conferir reabertura' : 'Conferir encerramento' : edition.status === 'encerrada' ? 'Reabrir season' : 'Encerrar campeonato'}
      </button> : null}
    </div>
    {!atomic ? <p>Encerramento e reabertura temporariamente indisponíveis.</p> : <p>Confira a classificação e o estado da edição antes de confirmar.</p>}
    {mutation.pending ? <div className="message" role="status"><p>Há uma confirmação pendente. Confira a edição antes de iniciar outra operação.</p>
      <div className="actions"><button type="button" className="button" disabled={busy} onClick={() => void retry()}>Repetir tentativa original</button><button type="button" className="button secondary" disabled={busy} onClick={() => void discard()}>Encerrar tentativa local</button></div>
    </div> : null}
    {view?.preview && !mutation.pending ? <div className="message">
      <p>{view.preview.plan.falls} queda(s) finalizada(s) · {view.preview.plan.total_equipes} equipe(s) · {view.preview.stages} etapa(s) · {view.preview.divisions} divisão(ões).</p>
      {view.action === 'publish_final' && view.preview.plan.champion_name ? <p>Campeão: {view.preview.plan.champion_name}.</p> : null}
      {view.preview.plan.groups.map((group: any) => <p key={group.id}>{group.nome}: {group.total_equipes} equipe(s) com classificação.</p>)}
      {view.action === 'reopen_final' ? <p>Todas as etapas e divisões encerradas serão ativadas. As inscrições continuarão fechadas.</p> : null}
      <button type="button" className="button" disabled={busy || !atomic || !mutation.ready} onClick={() => void confirm()}>{view.action === 'publish_final' ? 'Confirmar encerramento' : 'Confirmar reabertura'}</button>
    </div> : null}
    {view?.message ? <p role="status">{view.message}</p> : null}
    {view?.error || mutation.error ? <div className="message error" role="alert">{view?.error || mutation.error}</div> : null}
    {current?.error ? <div className="message error" role="alert">{current.error}</div> : null}
  </section>
}
