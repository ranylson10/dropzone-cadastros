import { Field, UploadField } from '@/features/dropzone/components/form-fields'

type PlayerRegistrationFormProps = {
  player: { nick: string; foto_url: string; id_jogo: string; funcao: string; localidade: string; senha: string }
  setPlayer: (value: any) => void
  uploadPublicFile: (file: File, bucket: string) => Promise<string>
}

export function PlayerRegistrationForm({ player, setPlayer, uploadPublicFile }: PlayerRegistrationFormProps) {
  return (
    <div className="form-grid">
      <Field label="Nick"><input value={player.nick} onChange={(e) => setPlayer({ ...player, nick: e.target.value })} /></Field>
      <Field label="ID de jogo"><input value={player.id_jogo} onChange={(e) => setPlayer({ ...player, id_jogo: e.target.value })} /></Field>
      <UploadField label="Foto do jogador" value={player.foto_url} bucket="jogador" onChange={(url) => setPlayer({ ...player, foto_url: url })} onUpload={uploadPublicFile} />
      <Field label="Funcao">
        <select value={player.funcao} onChange={(e) => setPlayer({ ...player, funcao: e.target.value })}>
          <option value="support">Support</option>
          <option value="rush">Rush</option>
          <option value="sniper">Sniper</option>
          <option value="bomber">Bomber</option>
        </select>
      </Field>
      <Field label="Localidade"><input value={player.localidade} onChange={(e) => setPlayer({ ...player, localidade: e.target.value })} /></Field>
      <Field label="Senha"><input type="password" value={player.senha} onChange={(e) => setPlayer({ ...player, senha: e.target.value })} /></Field>
    </div>
  )
}
