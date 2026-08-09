import { ComponentProps } from 'react'
import Ionicons from '@expo/vector-icons/Ionicons'
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { externalUrl } from '@/config/env'
import { useAuth } from '@/lib/auth'
import { colors, spacing } from '@/theme/tokens'
import { MobileRoute, ProfileType, ScreenProps } from '@/types/dropzone'

type IconName = ComponentProps<typeof Ionicons>['name']
type Action = { title:string; description:string; icon:IconName; route:MobileRoute; primary?:boolean }
const labels:Record<ProfileType,string>={jogador:'Jogador',equipe:'Equipe',produtora:'Produtora',manager:'Manager / vendedor',broadcast:'Transmissão'}
const panels:Record<ProfileType,Action[]>={
  equipe:[
    {title:'Gerenciar equipe',description:'Elenco, lines, staff e dados públicos.',icon:'shield-checkmark-outline',route:'team_roster',primary:true},
    {title:'Escalações',description:'Monte os jogadores de cada campeonato.',icon:'people-circle-outline',route:'lineup'},
    {title:'Meus campeonatos',description:'Inscrições, vagas e ações da equipe.',icon:'trophy-outline',route:'my_championships'},
    {title:'Agenda',description:'Jogos, prazos e próximos compromissos.',icon:'calendar-outline',route:'agenda'},
    {title:'Convites',description:'Jogadores, staff e solicitações.',icon:'mail-unread-outline',route:'invites'},
    {title:'Carteira',description:'Pagamentos, compras e comprovantes.',icon:'wallet-outline',route:'wallet'},
  ],
  jogador:[
    {title:'Central do jogador',description:'Equipe, line, agenda, escalações e desempenho.',icon:'person-circle-outline',route:'player_dashboard',primary:true},
    {title:'Minha agenda',description:'Jogos, chamadas e prazos de escalação.',icon:'calendar-outline',route:'agenda'},
    {title:'Meus campeonatos',description:'Participações e inscrições ativas.',icon:'trophy-outline',route:'my_championships'},
    {title:'Convites',description:'Propostas de equipe e confirmações.',icon:'mail-unread-outline',route:'invites'},
    {title:'Ranking',description:'Desempenho e classificação individual.',icon:'podium-outline',route:'rank'},
    {title:'Buscar equipes',description:'Organizações e lines públicas.',icon:'people-outline',route:'team_directory'},
  ],
  produtora:[
    {title:'Central da produtora',description:'Resumo financeiro e operacional.',icon:'business-outline',route:'producer_overview',primary:true},
    {title:'Administrar campeonatos',description:'Criação, estrutura, jogos e inscrições.',icon:'trophy-outline',route:'championship_management'},
    {title:'Agenda operacional',description:'Jogos e tarefas dos campeonatos.',icon:'calendar-outline',route:'agenda'},
    {title:'Carteira',description:'Receitas, saldos e saques.',icon:'wallet-outline',route:'wallet'},
    {title:'Equipe comercial',description:'Managers, vendedores e convites.',icon:'person-add-outline',route:'invites'},
    {title:'Vitrine pública',description:'Campeonatos publicados.',icon:'storefront-outline',route:'vacancies'},
  ],
  manager:[
    {title:'Minhas vendas',description:'Conversões, comissões e resultados.',icon:'cash-outline',route:'seller_sales',primary:true},
    {title:'Equipes gerenciadas',description:'Equipes em que você faz parte da staff.',icon:'shield-outline',route:'team_roster'},
    {title:'Campeonatos',description:'Eventos autorizados, estrutura e jogos.',icon:'trophy-outline',route:'championship_management'},
    {title:'Agenda',description:'Prazos sob sua responsabilidade.',icon:'calendar-outline',route:'agenda'},
    {title:'Convites',description:'Vínculos e solicitações pendentes.',icon:'mail-unread-outline',route:'invites'},
    {title:'Carteira',description:'Comissões, saldos e comprovantes.',icon:'wallet-outline',route:'wallet'},
  ],
  broadcast:[
    {title:'Agenda de transmissões',description:'Partidas e horários programados.',icon:'videocam-outline',route:'agenda',primary:true},
    {title:'Campeonatos',description:'Estrutura, equipes e classificação.',icon:'trophy-outline',route:'my_championships'},
    {title:'Convites',description:'Autorizações e acessos recebidos.',icon:'mail-unread-outline',route:'invites'},
    {title:'Diretório público',description:'Navegue pelos eventos ativos.',icon:'globe-outline',route:'vacancies'},
    {title:'Ranking',description:'Classificações para a transmissão.',icon:'podium-outline',route:'rank'},
    {title:'Lili',description:'Encontre funções rapidamente.',icon:'sparkles-outline',route:'lili'},
  ],
}

export function ControlPanelScreen({onNavigate,onSelectPlayer,onManageTeam}:ScreenProps){
  const auth=useAuth(),account=auth.activeAccount,type=auth.activeProfileType,image=externalUrl(account?.image_url||''),data:any=account?.data||{}
  function open(action:Action){
    if(action.route==='player_public'&&account?.id)return onSelectPlayer?.(account.id)
    if(action.route==='team_roster'&&type==='equipe'&&account?.id)return onManageTeam?.(account.id)
    onNavigate(action.route)
  }
  return <ScrollView style={styles.page} contentContainerStyle={styles.content}>
    <View style={styles.hero}><View style={styles.identity}>
      {image?<Image source={{uri:image}} style={styles.avatar}/>:<View style={[styles.avatar,styles.fallback]}><Text style={styles.initial}>{String(account?.name||'DZ').slice(0,2).toUpperCase()}</Text></View>}
      <View style={styles.heroCopy}><Text style={styles.eyebrow}>PAINEL · {labels[type]}</Text><Text style={styles.name} numberOfLines={1}>{account?.name||'Meu perfil'}</Text><Text style={styles.handle}>{account?.username?`@${account.username}`:'Central de controle DropZone'}</Text></View>
    </View><Text style={styles.intro}>Tudo que este perfil precisa para operar no competitivo, organizado por prioridade.</Text><TouchableOpacity style={styles.editProfile} onPress={()=>onNavigate('profile_management')}><Ionicons name="create-outline" size={16} color={colors.surface}/><Text style={styles.editProfileText}>Editar perfil</Text></TouchableOpacity></View>
    <View style={styles.statusRow}><Status icon="checkmark-circle-outline" label="Perfil" value={String(data.status||'Ativo')}/><Status icon="notifications-outline" label="Pendências" value="Convites"/><Status icon="calendar-outline" label="Próximo" value="Agenda"/></View>
    <View style={styles.heading}><Text style={styles.kicker}>CONTROLES</Text><Text style={styles.title}>O que você quer fazer?</Text></View>
    <View style={styles.grid}>{panels[type].map(action=><TouchableOpacity key={action.title} style={[styles.card,action.primary&&styles.primary]} onPress={()=>open(action)}>
      <View style={[styles.iconBox,action.primary&&styles.primaryIcon]}><Ionicons name={action.icon} size={24} color={action.primary?colors.surface:colors.brand}/></View><Text style={[styles.cardTitle,action.primary&&styles.light]}>{action.title}</Text><Text style={[styles.description,action.primary&&styles.lightMuted]}>{action.description}</Text><Ionicons name="arrow-forward" size={18} color={action.primary?colors.surface:colors.brand}/>
    </TouchableOpacity>)}</View>
    <TouchableOpacity style={styles.help} onPress={()=>onNavigate('lili')}><Ionicons name="sparkles-outline" size={22} color={colors.brand}/><View style={styles.helpCopy}><Text style={styles.helpTitle}>Não encontrou uma função?</Text><Text style={styles.helpText}>Peça ajuda à Lili para chegar à ação certa.</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted}/></TouchableOpacity>
  </ScrollView>
}
function Status({icon,label,value}:{icon:IconName;label:string;value:string}){return <View style={styles.status}><Ionicons name={icon} size={17} color={colors.brand}/><Text style={styles.statusLabel}>{label}</Text><Text style={styles.statusValue}>{value}</Text></View>}
const styles=StyleSheet.create({page:{flex:1,backgroundColor:colors.background},content:{paddingBottom:spacing.xxl},hero:{padding:spacing.lg,backgroundColor:colors.brandDark,borderBottomWidth:4,borderBottomColor:colors.brand},identity:{flexDirection:'row',alignItems:'center',gap:spacing.md},avatar:{width:64,height:64,borderRadius:10,backgroundColor:'#202938',borderWidth:1,borderColor:'rgba(255,255,255,.18)'},fallback:{alignItems:'center',justifyContent:'center'},initial:{color:colors.surface,fontSize:18,fontWeight:'900'},heroCopy:{flex:1},eyebrow:{color:colors.brand,fontSize:9,fontWeight:'900',letterSpacing:1.5},name:{marginTop:4,color:colors.surface,fontSize:21,fontWeight:'900',textTransform:'uppercase'},handle:{marginTop:3,color:'#aeb8c5',fontSize:11,fontWeight:'700'},intro:{marginTop:spacing.md,color:'#c5ccd5',fontSize:12,lineHeight:18},editProfile:{alignSelf:'flex-start',marginTop:12,minHeight:34,flexDirection:'row',alignItems:'center',gap:6,paddingHorizontal:11,borderWidth:1,borderColor:'rgba(255,255,255,.25)'},editProfileText:{color:colors.surface,fontSize:9,fontWeight:'900',textTransform:'uppercase'},statusRow:{margin:spacing.md,marginBottom:0,flexDirection:'row',gap:1,backgroundColor:colors.line},status:{flex:1,padding:9,backgroundColor:colors.surface},statusLabel:{marginTop:5,color:colors.muted,fontSize:8,fontWeight:'900',textTransform:'uppercase'},statusValue:{marginTop:2,color:colors.ink,fontSize:10,fontWeight:'900'},heading:{margin:spacing.md,marginBottom:9},kicker:{color:colors.brand,fontSize:9,fontWeight:'900',letterSpacing:1.5},title:{marginTop:3,color:colors.ink,fontSize:20,fontWeight:'900',textTransform:'uppercase'},grid:{paddingHorizontal:spacing.md,flexDirection:'row',flexWrap:'wrap',gap:8},card:{width:'48.7%',minHeight:158,padding:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.line},primary:{backgroundColor:colors.brandDark,borderColor:colors.brandDark},iconBox:{width:42,height:42,alignItems:'center',justifyContent:'center',backgroundColor:'#fff0f2'},primaryIcon:{backgroundColor:colors.brand},cardTitle:{marginTop:10,color:colors.ink,fontSize:12,fontWeight:'900',textTransform:'uppercase'},light:{color:colors.surface},description:{flex:1,marginTop:5,color:colors.muted,fontSize:9.5,lineHeight:14,fontWeight:'600'},lightMuted:{color:'#bac3ce'},help:{margin:spacing.md,marginTop:16,minHeight:68,flexDirection:'row',alignItems:'center',gap:10,padding:12,backgroundColor:'#e8e2d8'},helpCopy:{flex:1},helpTitle:{color:colors.ink,fontSize:11,fontWeight:'900'},helpText:{marginTop:3,color:colors.muted,fontSize:9.5,fontWeight:'700'}})
