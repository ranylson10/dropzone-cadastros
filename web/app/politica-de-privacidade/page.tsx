import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Política de Privacidade | DropZone',
  description: 'Política de Privacidade da plataforma DropZone Competitive System.',
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      eyebrow="Privacidade e proteção de dados"
      title="Política de Privacidade"
      description="Esta política explica quais dados a DropZone utiliza, por que eles são necessários e quais opções estão disponíveis ao usuário."
      updatedAt="11 de julho de 2026"
      sections={[
        {
          title: '1. Quem somos',
          content: (
            <p>
              A DropZone Competitive System é uma plataforma para organização de campeonatos de Free Fire, gerenciamento de produtoras, equipes, lines, jogadores, managers, convites, inscrições e escalações.
            </p>
          ),
        },
        {
          title: '2. Dados que podemos coletar',
          content: (
            <>
              <p>Dependendo do perfil e das funcionalidades utilizadas, podemos tratar:</p>
              <ul>
                <li>nome, nome de exibição, nick e nome de usuário;</li>
                <li>endereço de e-mail e identificador da conta autenticada;</li>
                <li>foto de perfil, avatar, logo ou outras imagens enviadas;</li>
                <li>ID de jogo, função competitiva, tag e localidade;</li>
                <li>dados de equipes, lines, produtoras, campeonatos, inscrições, convites e escalações;</li>
                <li>informações técnicas necessárias para segurança, autenticação, prevenção de abuso e funcionamento da plataforma.</li>
              </ul>
            </>
          ),
        },
        {
          title: '3. Login com Google, Facebook e Discord',
          content: (
            <p>
              O acesso pode ser realizado por Google, Facebook ou Discord. Ao escolher um desses provedores, a DropZone recebe os dados básicos autorizados pelo usuário, como identificador da conta, nome, e-mail e foto, quando disponibilizados. A DropZone não recebe nem armazena a senha utilizada nesses serviços.
            </p>
          ),
        },
        {
          title: '4. Como usamos os dados',
          content: (
            <ul>
              <li>autenticar o usuário e manter a sessão ativa;</li>
              <li>criar e vincular perfis de produtora, equipe, jogador ou manager;</li>
              <li>permitir inscrições, convites, escalações e gerenciamento de campeonatos;</li>
              <li>exibir informações públicas relacionadas a campeonatos e perfis competitivos;</li>
              <li>proteger contas, investigar falhas e prevenir uso indevido;</li>
              <li>atender solicitações de suporte, correção ou exclusão de dados.</li>
            </ul>
          ),
        },
        {
          title: '5. Serviços utilizados',
          content: (
            <p>
              A plataforma utiliza serviços de terceiros para autenticação, banco de dados, armazenamento e hospedagem, incluindo Supabase e Vercel. Esses fornecedores podem tratar dados técnicos necessários para prestar seus serviços, conforme seus próprios termos e políticas.
            </p>
          ),
        },
        {
          title: '6. Compartilhamento e publicidade das informações',
          content: (
            <p>
              A DropZone não vende dados pessoais. Informações inseridas em páginas públicas, rankings, equipes, escalações ou campeonatos podem ficar visíveis a outros usuários e visitantes. Dados também podem ser compartilhados quando necessário para cumprir obrigação legal, proteger direitos ou manter a segurança do sistema.
            </p>
          ),
        },
        {
          title: '7. Armazenamento e segurança',
          content: (
            <p>
              Adotamos medidas técnicas e organizacionais compatíveis com a natureza da plataforma, como autenticação por provedor, controle de acesso, políticas de banco de dados e conexões seguras. Nenhum sistema é totalmente imune a incidentes, mas buscamos reduzir riscos e corrigir vulnerabilidades identificadas.
            </p>
          ),
        },
        {
          title: '8. Direitos do usuário',
          content: (
            <p>
              O usuário pode solicitar confirmação do tratamento, acesso, correção, atualização ou exclusão de seus dados, observadas as informações que precisam ser mantidas por obrigação legal, prevenção de fraude ou exercício regular de direitos.
            </p>
          ),
        },
        {
          title: '9. Exclusão de dados',
          content: (
            <p>
              As instruções para solicitar a exclusão da conta e dos dados estão disponíveis em <a href="/exclusao-de-dados">Exclusão de Dados</a>.
            </p>
          ),
        },
        {
          title: '10. Alterações desta política',
          content: (
            <p>
              Esta política pode ser atualizada para refletir mudanças na plataforma, nos serviços utilizados ou nas regras aplicáveis. A versão vigente ficará sempre publicada nesta página com a data da última atualização.
            </p>
          ),
        },
        {
          title: '11. Contato',
          content: (
            <p>
              Dúvidas e solicitações relacionadas à privacidade podem ser enviadas para <a href="mailto:ranylson.santos@gmail.com">ranylson.santos@gmail.com</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
