import { ActionCard, MetricPill, ScreenShell } from '@/screens/components'
import { spacing } from '@/theme/tokens'
import { ScreenProps } from '@/types/dropzone'
import { View } from 'react-native'

export function RankScreen({ onBack, onNavigate }: ScreenProps) {
  return (
    <ScreenShell
      eyebrow="Rank"
      title="Ranking competitivo"
      description="Primeira versão do rank no app: acesso rápido para estatísticas globais, equipes e jogadores. O ranking global real ainda precisa de uma API consolidada."
      onBack={onBack}
    >
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <MetricPill label="escopo" value="global" />
        <MetricPill label="status" value="planejado" />
      </View>
      <ActionCard
        title="Rank de equipes"
        description="Deve consolidar pontos, abates, posições, mapas fortes e desempenho por campeonato."
        cta="Ver campeonatos"
        onPress={() => onNavigate('my_championships')}
      />
      <ActionCard
        title="Rank de jogadores"
        description="Deve consolidar MVP, abates, presença em escalações, vitórias e histórico por equipe."
        cta="Ver agenda"
        onPress={() => onNavigate('agenda')}
      />
      <ActionCard
        title="Próximo passo técnico"
        description="Criar endpoint único de ranking para o app e site consumirem a mesma fonte, sem duplicar regra no mobile."
        tone="dark"
      />
    </ScreenShell>
  )
}

