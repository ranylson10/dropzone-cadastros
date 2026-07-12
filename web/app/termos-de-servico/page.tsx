import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Termos de Serviço | DropZone',
  description: 'Termos de Serviço da plataforma DropZone Competitive System.',
}

export default function TermsPage() {
  return (
    <LegalPage
      eyebrow="Regras de utilização"
      title="Termos de Serviço"
      description="Ao acessar ou utilizar a DropZone, o usuário concorda com as regras descritas nestes termos."
      updatedAt="11 de julho de 2026"
      sections={[
        {
          title: '1. Finalidade da plataforma',
          content: (
            <p>
              A DropZone oferece ferramentas para criação e gestão de perfis, produtoras, equipes, lines, jogadores, managers, campeonatos, convites, inscrições, escalações, resultados e classificações relacionadas a competições de Free Fire.
            </p>
          ),
        },
        {
          title: '2. Acesso e autenticação',
          content: (
            <p>
              O acesso é realizado por Google, Facebook ou Discord. O usuário é responsável por manter segura a conta utilizada no provedor escolhido e por informar dados verdadeiros, atualizados e compatíveis com sua participação na plataforma.
            </p>
          ),
        },
        {
          title: '3. Perfis e responsabilidade pelas informações',
          content: (
            <p>
              O usuário é responsável pelas informações, imagens, logos, nomes, IDs de jogo e demais conteúdos inseridos. Não é permitido utilizar dados de terceiros sem autorização, assumir identidade falsa, infringir direitos autorais ou publicar conteúdo ilegal, ofensivo ou enganoso.
            </p>
          ),
        },
        {
          title: '4. Campeonatos e inscrições',
          content: (
            <p>
              Organizadores e produtoras são responsáveis pelas regras, horários, premiações, cobranças, decisões competitivas e comunicação de seus eventos. A DropZone fornece a infraestrutura de gerenciamento, mas não garante o cumprimento de obrigações assumidas diretamente entre organizadores, equipes e jogadores.
            </p>
          ),
        },
        {
          title: '5. Condutas proibidas',
          content: (
            <ul>
              <li>tentar acessar contas, dados ou áreas sem autorização;</li>
              <li>explorar falhas, automatizar abuso ou prejudicar o funcionamento do sistema;</li>
              <li>forjar inscrições, resultados, convites ou identidades;</li>
              <li>publicar malware, spam ou conteúdo ilícito;</li>
              <li>usar a plataforma para fraude, assédio ou violação de direitos de terceiros.</li>
            </ul>
          ),
        },
        {
          title: '6. Suspensão e encerramento',
          content: (
            <p>
              Contas, perfis ou conteúdos podem ser limitados, suspensos ou removidos quando houver violação destes termos, risco à segurança, fraude, determinação legal ou uso que prejudique outros usuários e a plataforma.
            </p>
          ),
        },
        {
          title: '7. Disponibilidade e alterações',
          content: (
            <p>
              A plataforma pode passar por manutenção, indisponibilidade temporária ou alterações de funcionalidades. Buscamos manter o serviço operacional, mas não garantimos funcionamento ininterrupto nem ausência total de erros.
            </p>
          ),
        },
        {
          title: '8. Propriedade intelectual',
          content: (
            <p>
              A identidade visual, o código, a interface e os elementos próprios da DropZone são protegidos pela legislação aplicável. Marcas, logos, imagens e conteúdos enviados pelos usuários continuam sujeitos aos direitos de seus respectivos titulares.
            </p>
          ),
        },
        {
          title: '9. Privacidade',
          content: (
            <p>
              O tratamento de dados pessoais está descrito na <a href="/politica-de-privacidade">Política de Privacidade</a>. As instruções para remoção estão na página de <a href="/exclusao-de-dados">Exclusão de Dados</a>.
            </p>
          ),
        },
        {
          title: '10. Alterações dos termos',
          content: (
            <p>
              Estes termos podem ser atualizados conforme a evolução do sistema. A versão vigente e a data da última atualização permanecerão publicadas nesta página.
            </p>
          ),
        },
        {
          title: '11. Contato',
          content: (
            <p>
              Questões relacionadas a estes termos podem ser enviadas para <a href="mailto:ranylson.santos@gmail.com">ranylson.santos@gmail.com</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
