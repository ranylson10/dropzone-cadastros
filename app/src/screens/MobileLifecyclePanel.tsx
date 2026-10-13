import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { useMobileLifecycleScope } from '../hooks/useMobileLifecycleScope'
import { discardMobileLifecycle, mobileLifecycleAttempts, previewMobileLifecycle, readMobileLifecycleBoard, retryMobileLifecycle, writeMobileLifecycle, type LifecycleAction, type LifecycleIntent, type MobileLifecycleAttempt } from '../lib/lifecycle-write'
import { colors } from '../theme/tokens'

type Board = Awaited<ReturnType<typeof readMobileLifecycleBoard>>
type State = { key: string; board: Board | null; pending: MobileLifecycleAttempt | null; preview: any; error: string; feedback: string; busy: boolean; ready: boolean }
const empty = (key: string): State => ({ key, board: null, pending: null, preview: null, error: '', feedback: '', busy: false, ready: false })

export function MobileLifecyclePanel({ championshipId }: { championshipId: string }) {
  const scope = useMobileLifecycleScope(championshipId), lease = useRef<number | null>(null)
  const [state, setState] = useState<State>(() => empty(''))
  const latest = useRef(state), dialog = useRef<object | null>(null)
  latest.current = state
  const visible = state.key === scope.key ? state : empty(scope.key)
  const assertCurrent = () => { if (!scope.actor || !scope.isCurrent()) throw new Error('A conta ou o campeonato mudou. Consulte a tentativa anterior.') }
  useEffect(() => {
    if (!scope.actor) return
    let alive = true; const controller = new AbortController()
    const read = async () => {
      try {
        const [board, pending] = await Promise.allSettled([readMobileLifecycleBoard(championshipId, scope.actor!, assertCurrent, controller.signal), mobileLifecycleAttempts.read(scope.actor!, championshipId)])
        if (alive && scope.isCurrent()) setState({ ...empty(scope.key), board: board.status === 'fulfilled' ? board.value : null,
          pending: pending.status === 'fulfilled' ? pending.value : null, ready: pending.status === 'fulfilled',
          error: pending.status === 'rejected' ? message(pending.reason) : board.status === 'rejected' ? message(board.reason) : '' })
      } catch (error) { if (alive && scope.isCurrent()) setState({ ...empty(scope.key), error: message(error), ready: false }) }
    }
    void read()
    return () => { alive = false; controller.abort() }
  }, [scope.key, championshipId])

  async function run(work: () => Promise<void>) {
    assertCurrent()
    if (!visible.ready || lease.current === scope.epoch) return
    lease.current = scope.epoch
    setState(previous => ({ ...previous, key: scope.key, busy: true, error: '' }))
    try { await work() }
    catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, error: message(error) })) }
    finally {
      if (scope.isCurrent()) {
        try {
          const pending = await mobileLifecycleAttempts.read(scope.actor!, championshipId)
          if (scope.isCurrent()) setState(previous => ({ ...previous, pending, busy: false }))
        } catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, busy: false, ready: false, error: message(error) })) }
      }
      if (lease.current === scope.epoch) lease.current = null
    }
  }

  async function confirm(body: LifecycleIntent, retry?: MobileLifecycleAttempt) {
    await run(async () => {
      const result = retry ? await retryMobileLifecycle(championshipId, scope.actor!, retry, assertCurrent)
        : await writeMobileLifecycle(championshipId, scope.actor!, visible.board!.contract, body, assertCurrent)
      assertCurrent()
      setState(previous => ({ ...previous, preview: null, feedback: result.action === 'reopen_final' ? 'Reabertura confirmada. Inscrições permanecem fechadas.' : 'Publicação final confirmada.' }))
      try {
        const board = await readMobileLifecycleBoard(championshipId, scope.actor!, assertCurrent)
        if (scope.isCurrent()) setState(previous => ({ ...previous, board }))
      } catch (error) { if (scope.isCurrent()) setState(previous => ({ ...previous, error: 'Operação confirmada. Não foi possível atualizar a edição: ' + message(error) })) }
    })
  }

  function requestConfirmation() {
    if (!visible.preview || visible.busy || visible.pending || !scope.isCurrent() || latest.current.key !== scope.key
      || latest.current.preview?.request_id !== visible.preview.request_id || latest.current.busy || latest.current.pending) return
    const token = {}; dialog.current = token
    const body: LifecycleIntent = { action: visible.preview.action.slice(8), expected: visible.preview.preview.fence }
    Alert.alert(body.action === 'reopen_final' ? 'Reabrir edição?' : 'Publicar resultado final?', body.action === 'reopen_final'
      ? 'Todas as etapas e divisões encerradas serão ativadas. As canceladas serão preservadas. As inscrições continuarão fechadas.'
      : 'A edição e suas etapas e divisões serão encerradas, preservando as canceladas. As inscrições serão fechadas.', [
      { text: 'Cancelar', style: 'cancel', onPress: () => { if (dialog.current === token) dialog.current = null } },
      { text: 'Confirmar', onPress: () => { if (dialog.current !== token) return; dialog.current = null; if (scope.isCurrent()) void confirm(body) } },
    ])
  }

  function requestDiscard() {
    const pending = visible.pending
    if (!pending || visible.busy || !scope.isCurrent()) return
    Alert.alert('Encerrar tentativa local?', 'A operação pode já ter sido confirmada no servidor. Revise o estado da edição antes de encerrar. Isso remove apenas a tentativa deste aparelho.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Encerrar tentativa local', style: 'destructive', onPress: () => {
        if (scope.isCurrent()) void run(async () => {
          await readMobileLifecycleBoard(championshipId, scope.actor!, assertCurrent)
          await discardMobileLifecycle(championshipId, scope.actor!, pending, assertCurrent)
          assertCurrent(); setState(previous => ({ ...previous, preview: null, feedback: 'Tentativa local encerrada.' }))
        })
      } },
    ])
  }

  const available = visible.ready && visible.board?.contract.lifecycle_write_mode === 'atomic'
  const disabled = visible.busy || !available || !!visible.pending
  const action: LifecycleAction = visible.board?.edition?.status === 'encerrada' ? 'reopen_final' : 'publish_final'
  return <View style={styles.root}>
    <Text style={styles.title}>ENCERRAMENTO</Text>
    {visible.feedback ? <Text accessibilityRole="text" style={styles.feedback}>{visible.feedback}</Text> : null}
    {visible.error ? <Text accessibilityRole="alert" style={styles.error}>{visible.error}</Text> : null}
    {visible.busy ? <ActivityIndicator color={colors.brand} /> : null}
    {visible.board ? <Text style={styles.note}>Edição: {visible.board.edition?.status || 'sem edição'}</Text> : null}
    {available ? <Text style={styles.note}>Confira a prévia antes de confirmar. As inscrições ficam fechadas na publicação e na reabertura.</Text>
      : <Text style={styles.note}>Encerramento e reabertura temporariamente indisponíveis.</Text>}
    {visible.pending ? <View style={styles.group}>
      <Text style={styles.note}>Há uma confirmação pendente neste aparelho. Repita a tentativa original para consultar o resultado.</Text>
      <Button label="Repetir tentativa original" disabled={visible.busy || !visible.ready} onPress={() => { if (scope.isCurrent()) void confirm(visible.pending!.body, visible.pending!) }} />
      <Button label="Encerrar tentativa local" disabled={visible.busy || !visible.ready} onPress={requestDiscard} />
    </View> : null}
    {visible.preview ? <View style={styles.group}>
      <Text style={styles.note}>{visible.preview.preview.plan.falls} quedas · {visible.preview.preview.plan.total_equipes} equipes · {visible.preview.preview.stages} etapas · {visible.preview.preview.divisions} divisões</Text>
      <Text style={styles.note}>{visible.preview.preview.plan.champion_name ? `Campeã: ${visible.preview.preview.plan.champion_name}` : 'Classificação por grupos, sem campeã geral.'}</Text>
      {visible.preview.preview.plan.groups.map((group: any) => <Text key={group.id} style={styles.note}>{group.nome}: {group.total_equipes} equipes</Text>)}
      {action === 'reopen_final' ? <Text style={styles.note}>Ativar todas as etapas e divisões encerradas. Preservar canceladas e manter inscrições fechadas.</Text> : null}
      <Button label={action === 'reopen_final' ? 'Confirmar reabertura' : 'Confirmar publicação final'} disabled={disabled} onPress={requestConfirmation} />
      <Button label="Cancelar prévia" disabled={visible.busy} onPress={() => setState(previous => ({ ...previous, preview: null }))} />
    </View> : <Button label={action === 'reopen_final' ? 'Conferir reabertura' : 'Conferir encerramento'} disabled={disabled} onPress={() => {
      if (scope.isCurrent()) void run(async () => {
        const preview = await previewMobileLifecycle(championshipId, scope.actor!, visible.board!.contract, action, assertCurrent)
        assertCurrent(); setState(previous => ({ ...previous, preview, feedback: '' }))
      })
    }} />}
  </View>
}

function message(error: unknown) { return error instanceof Error ? error.message : 'Não foi possível confirmar a operação.' }
function Button({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} style={[styles.button, disabled && styles.disabled]} onPress={onPress}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>
}
const styles = StyleSheet.create({
  root: { gap: 8, padding: 12, backgroundColor: colors.brandDark, borderRadius: 10, borderWidth: 1, borderColor: colors.brand },
  group: { gap: 8 }, title: { color: colors.ink, fontSize: 12, fontWeight: '900' },
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 }, feedback: { color: colors.success, fontSize: 12 }, error: { color: colors.danger, fontSize: 12 },
  button: { padding: 12, minHeight: 44, borderRadius: 8, backgroundColor: colors.brand, alignItems: 'center' }, disabled: { opacity: 0.5 },
  buttonText: { color: colors.onBrand, fontSize: 12, fontWeight: '900' },
})
