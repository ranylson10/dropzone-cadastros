import { LocalStudioHandoff } from '@/components/local-studio/LocalStudioHandoff'

/** O editor visual e a saída OBS migraram para o aplicativo DropZone Live Local. */
export function StreamWorkspace(props: { campeonatoId: string }) {
  return <LocalStudioHandoff campeonatoId={props.campeonatoId} kind="live" />
}
