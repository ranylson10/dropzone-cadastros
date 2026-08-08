import { ActionCard, ScreenShell } from '@/screens/components'
import { ScreenProps } from '@/types/dropzone'

export function LiliScreen({ onBack, onNavigate }: ScreenProps) {
  return (
    <ScreenShell
      eyebrow="Assistente"
      title="Lili"
      description="A Lili guia o usuário para resolver ações sem precisar conhecer os menus."
      onBack={onBack}
    >
      <ActionCard
        title="“Quero escalar meu elenco”"
        description="A Lili identifica equipe, campeonato, prazo, line e oferece copiar link ou convidar jogadores."
        cta="Abrir escalação"
        onPress={() => onNavigate('lineup')}
      />
      <ActionCard
        title="“Quero comprar uma vaga”"
        description="A Lili mostra campeonatos com vagas, preço, premiação, data e fluxo seguro de pagamento."
        cta="Ver vagas"
        onPress={() => onNavigate('vacancies')}
      />
      <ActionCard
        title="“Onde jogo hoje?”"
        description="A Lili consulta agenda do perfil ativo e mostra jogos, grupo, horário e status da escalação."
        cta="Abrir agenda"
        onPress={() => onNavigate('agenda')}
      />
    </ScreenShell>
  )
}
