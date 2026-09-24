# Rodada 140 — onboarding e criação de perfis simples

## Objetivo

Reduzir a carga cognitiva do primeiro acesso ao DropZone Web sem remover capacidades. A conta de autenticação continua separada dos perfis operacionais. O usuário pode explorar campeonatos apenas com a conta e cria Jogador, Equipe, Produtora ou Afiliado somente quando precisar.

## Ajustes

- criação de conta apresenta Google como caminho rápido e mantém e-mail/senha como alternativa;
- no cadastro por e-mail, o @ é sugerido a partir do nome e continua editável;
- foto não ocupa mais o primeiro passo do cadastro por e-mail;
- conta autenticada sem perfil recebe três caminhos principais: Jogador, Equipe e Produtora;
- Afiliado fica em Outras opções;
- explorar campeonatos continua disponível sem criar perfil operacional;
- formulário de perfil vinculado passa a exibir o @ obrigatório (antes o estado era exigido pelo submit, mas o campo não era mostrado);
- foto/logo e localização passam para uma seção opcional recolhida;
- cancelar a criação de perfil fecha o fluxo, sem deslogar a conta.

## Dependências

Nenhuma biblioteca nova. O fluxo atual já pode ser simplificado com React/Next/Supabase existentes, evitando aumentar bundle e superfície de manutenção.

## Supabase Pro

Esta rodada não adiciona Realtime/Cron apenas por disponibilidade do plano. Esses recursos serão usados nas áreas em que reduzem atualização manual ou automatizam tarefas reais (convites, agenda, notificações, inscrições e pagamentos).
