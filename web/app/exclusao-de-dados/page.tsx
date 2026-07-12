import type { Metadata } from 'next'
import { LegalPage } from '@/components/legal/LegalPage'

export const metadata: Metadata = {
  title: 'Exclusão de Dados | DropZone',
  description: 'Instruções para solicitar a exclusão de conta e dados pessoais da DropZone.',
}

export default function DataDeletionPage() {
  return (
    <LegalPage
      eyebrow="Controle da sua conta"
      title="Exclusão de Dados"
      description="Nesta página você encontra as instruções para solicitar a exclusão da sua conta DropZone e dos dados pessoais vinculados a ela."
      updatedAt="11 de julho de 2026"
      sections={[
        {
          title: '1. Como solicitar',
          content: (
            <>
              <p>Envie um e-mail para <a href="mailto:ranylson.santos@gmail.com?subject=Exclus%C3%A3o%20de%20dados%20DropZone">ranylson.santos@gmail.com</a> com o assunto:</p>
              <p><strong>Exclusão de dados DropZone</strong></p>
              <p>No corpo da mensagem, informe:</p>
              <ul>
                <li>o e-mail utilizado no login;</li>
                <li>o provedor utilizado: Google, Facebook ou Discord;</li>
                <li>o nome de usuário ou perfil DropZone, quando existir;</li>
                <li>uma confirmação clara de que deseja excluir a conta e os dados vinculados.</li>
              </ul>
            </>
          ),
        },
        {
          title: '2. Verificação de identidade',
          content: (
            <p>
              Para impedir a exclusão indevida de contas, poderemos solicitar uma confirmação adicional pelo mesmo e-mail ou provedor utilizado no login. Não envie senhas, códigos de acesso ou segredos do provedor.
            </p>
          ),
        },
        {
          title: '3. O que será excluído',
          content: (
            <p>
              Após a validação, serão removidos ou desvinculados os dados pessoais e perfis sob controle direto da DropZone, incluindo informações de autenticação vinculadas, perfis, imagens e dados cadastrais, respeitadas as limitações técnicas e legais aplicáveis.
            </p>
          ),
        },
        {
          title: '4. Dados que podem ser preservados',
          content: (
            <p>
              Alguns registros podem ser mantidos pelo período necessário para cumprimento de obrigação legal, prevenção de fraude, segurança, resolução de disputas ou exercício regular de direitos. Resultados históricos de campeonatos podem ser anonimizados quando a remoção integral comprometer a integridade da competição.
            </p>
          ),
        },
        {
          title: '5. Prazo e confirmação',
          content: (
            <p>
              A solicitação será analisada e respondida pelo e-mail informado. Após a conclusão, enviaremos uma confirmação da exclusão ou explicaremos eventual necessidade de manter determinados registros.
            </p>
          ),
        },
        {
          title: '6. Revogar o acesso no provedor',
          content: (
            <p>
              O usuário também pode remover a autorização da DropZone diretamente nas configurações da conta Google, Facebook ou Discord. Essa revogação interrompe novos acessos pelo provedor, mas não substitui o pedido de exclusão dos dados já armazenados na DropZone.
            </p>
          ),
        },
        {
          title: '7. Contato',
          content: (
            <p>
              Para dúvidas sobre o processo, utilize <a href="mailto:ranylson.santos@gmail.com">ranylson.santos@gmail.com</a>.
            </p>
          ),
        },
      ]}
    />
  )
}
