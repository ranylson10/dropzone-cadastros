import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { apiUrl } from '@/config/env'
import { lineupDateLabel, lineupSubtitle } from '@/lib/lineups'
import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { colors, spacing, typography } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'

export function ChampionshipActionsScreen({ onBack, onNavigate, selectedLineup }: ScreenProps) {
  if (!selectedLineup) {
    return (
      <ScreenShell eyebrow="Campeonato" title="Ações" description="Escolha um campeonato para abrir as ações rápidas." onBack={onBack}>
        <ActionCard title="Nenhum campeonato selecionado" description="Abra a lista de campeonatos inscritos e escolha uma line/equipe." cta="Meus campeonatos" onPress={() => onNavigate('my_championships')} />
      </ScreenShell>
    )
  }

  const confirmed = Number(selectedLineup.jogadores_confirmados || selectedLineup.jogadores?.length || 0)
  const limit = Number(selectedLineup.limite_jogadores || 6)
  const championshipTeamId = String(selectedLineup.campeonato_equipe_id || '')
  const siteUrl = championshipTeamId ? apiUrl(`/painel?campeonatoEquipe=${encodeURIComponent(championshipTeamId)}`) : apiUrl('/painel')

  return (
    <ScreenShell
      eyebrow="Campeonato"
      title={selectedLineup.campeonato_nome || 'Campeonato'}
      description={lineupSubtitle(selectedLineup)}
      onBack={onBack}
    >
      <View style={styles.metrics}>
        <MetricPill label="jogadores" value={`${confirmed}/${limit}`} />
        <MetricPill label="vagas line" value={Math.max(0, limit - confirmed)} />
        <MetricPill label="status" value={confirmed >= limit ? 'OK' : 'Pendente'} />
      </View>

      <View style={styles.matchStrip}>
        <Text style={styles.stripLabel}>Próximo jogo</Text>
        <Text style={styles.stripValue}>{lineupDateLabel(selectedLineup)}</Text>
      </View>

      <ActionCard
        title="Escalar elenco"
        description="Gerar token, copiar link de escalação e acompanhar jogadores confirmados."
        cta="Abrir escalação"
        tone={confirmed < limit ? 'warning' : 'success'}
        onPress={() => onNavigate('lineup')}
      />

      <ActionCard
        title="Jogadores da line"
        description="Veja quem já entrou na line e o limite permitido para esse jogo."
        cta="Ver line"
        onPress={() => onNavigate('team_roster')}
      />

      <ActionCard
        title="Agenda do campeonato"
        description="Datas, horários e compromissos ligados ao seu perfil neste campeonato."
        cta="Abrir agenda"
        onPress={() => onNavigate('agenda')}
      />

      <ActionCard
        title="Convites e avisos"
        description="Pedidos de jogador, convite de campeonato, pendências e notificações."
        cta="Abrir convites"
        onPress={() => onNavigate('invites')}
      />

      <TouchableOpacity style={styles.siteButton} onPress={() => Linking.openURL(siteUrl)}>
        <Text style={styles.siteButtonText}>Abrir painel completo</Text>
      </TouchableOpacity>
    </ScreenShell>
  )
}

const styles = StyleSheet.create({
  metrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  matchStrip: {
    backgroundColor: colors.brandDark,
    borderBottomWidth: 3,
    borderBottomColor: colors.brand,
    padding: spacing.md,
    gap: spacing.xs,
  },
  stripLabel: {
    color: '#aeb6c0',
    fontSize: typography.tiny,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  stripValue: {
    color: colors.surface,
    fontSize: typography.subtitle,
    fontWeight: '900',
  },
  siteButton: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.brandDark,
    backgroundColor: colors.surface,
  },
  siteButtonText: {
    color: colors.brandDark,
    fontSize: typography.caption,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
})
