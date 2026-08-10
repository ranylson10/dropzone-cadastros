import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Switch, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { mobileApi } from '@/lib/api'
import { colors, spacing } from '@/theme/tokens'

const TYPES = ['copa', 'liga', 'diario', 'xtreino', 'confronto']

type Props = { championshipId: string; token?: string | null; onSaved?: () => void }

export function ChampionshipSettingsPanel({ championshipId, token, onSaved }: Props) {
  const [data, setData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [feedback, setFeedback] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await mobileApi.championshipAdminRecord(championshipId, token)
      const row = result.rows?.[0]
      if (!row) throw new Error('Campeonato não encontrado no seu acesso administrativo.')
      setData({ ...(row.data || {}), nome: row.data?.nome || row.name || '' })
      setError('')
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar as configurações.')
    } finally { setLoading(false) }
  }, [championshipId, token])

  useEffect(() => { void load() }, [load])
  const patch = (key: string, value: any) => setData(current => current ? { ...current, [key]: value } : current)

  async function save() {
    if (!data) return
    if (!String(data.nome || '').trim()) { setError('Informe o nome do campeonato.'); return }
    if (!String(data.logo_url || '').trim()) { setError('O campeonato precisa manter uma logo válida.'); return }
    setBusy(true); setError(''); setFeedback('')
    try {
      await mobileApi.updateChampionship(championshipId, { ...data, nome: String(data.nome).trim() }, token)
      setFeedback('Configurações atualizadas e regulamento sincronizado.')
      onSaved?.()
      await load()
    } catch (e: any) { setError(e?.message || 'Não foi possível salvar as configurações.') }
    finally { setBusy(false) }
  }

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.brand}/></View>
  if (!data) return <Text style={styles.error}>{error || 'Configurações indisponíveis.'}</Text>

  return <View style={styles.section}>
    <Text style={styles.title}>CONFIGURAÇÕES GERAIS</Text>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {feedback ? <Text style={styles.success}>{feedback}</Text> : null}
    <Field label="Nome" value={String(data.nome || '')} onChangeText={(v:string)=>patch('nome',v)}/>
    <Text style={styles.label}>TIPO</Text>
    <View style={styles.options}>{TYPES.map(type => <TouchableOpacity key={type} style={[styles.option, data.tipo===type&&styles.optionActive]} onPress={()=>patch('tipo',type)}><Text style={[styles.optionText,data.tipo===type&&styles.optionTextActive]}>{type}</Text></TouchableOpacity>)}</View>
    <View style={styles.columns}>
      <FieldBox label="Vagas" keyboardType="numeric" value={String(data.numero_vagas ?? '')} onChangeText={(v:string)=>patch('numero_vagas',v)}/>
      <FieldBox label="Jogadores/vaga" keyboardType="numeric" value={String(data.jogadores_por_vaga ?? data.vagas_por_equipe ?? '')} onChangeText={(v:string)=>{patch('jogadores_por_vaga',v);patch('vagas_por_equipe',v)}}/>
    </View>
    <Field label="Inscrição" keyboardType="numeric" value={String(data.valor_inscricao ?? '')} onChangeText={(v:string)=>patch('valor_inscricao',v)}/>
    <View style={styles.columns}>
      <FieldBox label="Plataforma" value={String(data.plataforma || '')} onChangeText={(v:string)=>patch('plataforma',v)}/>
      <FieldBox label="Servidor" value={String(data.servidor || '')} onChangeText={(v:string)=>patch('servidor',v)}/>
    </View>
    <Field label="Limite de inscrição (AAAA-MM-DD)" value={String(data.data_limite_inscricao || '')} onChangeText={(v:string)=>patch('data_limite_inscricao',v)}/>
    <Field label="Limite de trocas (AAAA-MM-DD)" value={String(data.data_limite_trocas || '')} onChangeText={(v:string)=>patch('data_limite_trocas',v)}/>
    <Toggle label="Aceitar novas inscrições" value={data.aceita_novas_inscricoes_equipes !== false} onValueChange={(v:boolean)=>patch('aceita_novas_inscricoes_equipes',v)}/>
    <Toggle label="Permitir troca de jogadores" value={Boolean(data.permite_troca_jogadores)} onValueChange={(v:boolean)=>patch('permite_troca_jogadores',v)}/>
    <Toggle label="Jogador em múltiplas equipes" value={Boolean(data.permite_jogador_multiplas_equipes)} onValueChange={(v:boolean)=>patch('permite_jogador_multiplas_equipes',v)}/>
    <Toggle label="Tem live" value={Boolean(data.tem_live)} onValueChange={(v:boolean)=>patch('tem_live',v)}/>
    <Toggle label="Tem troféu" value={Boolean(data.tem_trofeu)} onValueChange={(v:boolean)=>patch('tem_trofeu',v)}/>
    <TouchableOpacity disabled={busy} style={[styles.primary,busy&&styles.disabled]} onPress={()=>void save()}>{busy?<ActivityIndicator color={colors.surface}/>:<Text style={styles.primaryText}>SALVAR CONFIGURAÇÕES</Text>}</TouchableOpacity>
  </View>
}

function Field(props:any){return <View><Text style={styles.label}>{props.label}</Text><TextInput {...props} placeholderTextColor="#8a857e" style={styles.input}/></View>}
function FieldBox(props:any){return <View style={styles.fieldBox}><Field {...props}/></View>}
function Toggle({label,value,onValueChange}:{label:string;value:boolean;onValueChange:(value:boolean)=>void}){return <View style={styles.toggle}><Text style={styles.toggleText}>{label}</Text><Switch value={value} onValueChange={onValueChange} trackColor={{false:'#d8d2ca',true:'#ff8a94'}} thumbColor={value?colors.brand:'#f7f4ef'}/></View>}
const styles=StyleSheet.create({section:{marginHorizontal:spacing.md,gap:9},title:{marginTop:8,color:colors.ink,fontSize:10,fontWeight:'900',letterSpacing:1},label:{marginBottom:5,color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},input:{minHeight:40,paddingHorizontal:9,borderRadius:7,color:colors.ink,backgroundColor:'#f2eee7',borderWidth:1,borderColor:colors.line,fontWeight:'700'},columns:{flexDirection:'row',gap:6},fieldBox:{flex:1},options:{flexDirection:'row',flexWrap:'wrap',gap:5},option:{paddingHorizontal:9,paddingVertical:8,backgroundColor:'#eee9e1'},optionActive:{backgroundColor:colors.brandDark},optionText:{color:colors.ink,fontSize:8,fontWeight:'900',textTransform:'uppercase'},optionTextActive:{color:colors.surface},toggle:{minHeight:42,borderRadius:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingHorizontal:11,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},toggleText:{flex:1,color:colors.ink,fontSize:9,fontWeight:'800'},primary:{minHeight:42,borderRadius:8,alignItems:'center',justifyContent:'center',backgroundColor:colors.brand},primaryText:{color:colors.surface,fontWeight:'900'},disabled:{opacity:.55},loading:{minHeight:64,alignItems:'center',justifyContent:'center'},error:{padding:9,color:'#9a3412',backgroundColor:'#fff7ed',fontSize:9,fontWeight:'800'},success:{padding:9,color:'#166534',backgroundColor:'#effaf3',fontSize:9,fontWeight:'800'}})
