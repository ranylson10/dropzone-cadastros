# Lili — Assistente Virtual do DropZone

## 1. Objetivo

A Lili é a Assistente Virtual do DropZone. Ela acompanha o usuário durante tarefas já existentes no sistema, traduzindo estados, validações e opções da interface para uma conversa simples e humana.

A Lili não cria regras de negócio, não grava diretamente no banco e não substitui APIs existentes. Ela conduz o usuário e aciona as mesmas funções, componentes e endpoints usados pelo modo rápido.

## 2. Identidade

- Nome público: **Lili**
- Papel: **Assistente Virtual do DropZone**
- Mascote: gata simpática, moderna e reconhecível em tamanhos pequenos
- Tom: acolhedor, direto, paciente e objetivo
- Linguagem: simples, sem termos técnicos desnecessários
- Comportamento: sempre deixa claro o próximo passo

Exemplo de apresentação:

> Oi! Eu sou a Lili 🐱
>
> Vou acompanhar você durante esta inscrição.

## 3. Regra principal

O fluxo real do sistema é a fonte da verdade.

```text
Estado atual da página
        ↓
Lili explica o estado em linguagem humana
        ↓
Usuário escolhe ou responde
        ↓
Lili aciona a mesma ação existente
        ↓
A página recalcula o estado
```

A Lili nunca deve manter um fluxo paralelo independente do fluxo da página.

## 4. O que a Lili pode fazer

- Explicar o que está acontecendo.
- Fazer perguntas curtas.
- Apresentar apenas ações permitidas no estado atual.
- Acionar funções já existentes na página.
- Mostrar componentes existentes dentro da conversa.
- Exibir carregamento e indicador de digitação.
- Retomar a conversa após autenticação ou recarregamento.
- Responder dúvidas usando o contexto já carregado.

## 5. O que a Lili nunca pode fazer

- Inserir, atualizar ou excluir dados diretamente no Supabase.
- Duplicar validações já feitas por API ou página.
- Criar uma segunda implementação de login.
- Liberar uma ação proibida pelo estado atual.
- Inventar equipe, perfil, vaga, slot, line ou inscrição.
- Presumir que uma operação foi concluída sem resposta positiva da API.
- Ocultar erros reais do backend.
- Alterar regras de autenticação, perfil ou permissão.

## 6. Modos de uso

### Modo rápido

Interface tradicional já existente. Usuários experientes continuam usando formulários, listas e botões normalmente.

### Modo com a Lili

A mesma tarefa é apresentada em formato de conversa. Os dois modos compartilham o mesmo estado e as mesmas ações.

A troca de modo não pode apagar seleções já realizadas.

## 7. Fluxo atual — convite de grupo

O fluxo da página `web/app/convite/grupo/[token]/page.tsx` já possui os seguintes estados:

- `inicio`
- `login`
- `sem_equipe`
- `escolher_equipe`
- `confirmar_equipe`
- `escolher_line`
- `sucesso`
- `hub`
- `acompanhar`
- `escalar`
- `jogadores`
- `duvidas`

Esses estados continuam sendo controlados pela página.

### 7.1 Início

A Lili apresenta o campeonato e o grupo e pergunta se o usuário deseja:

- inscrever sua equipe;
- apenas acompanhar as inscrições.

### 7.2 Login necessário

A própria página identifica que não existe sessão válida.

A Lili explica que precisa identificar a conta e apresenta o componente atual de login com Google.

Depois do retorno da autenticação, a página deve recarregar os dados e decidir o próximo estado.

### 7.3 Sem equipe

A sessão existe, mas não foi encontrada uma equipe controlada.

A mensagem depende de `papel_sessao`:

- equipe sem cadastro completo;
- manager sem equipe controlada.

A Lili mostra apenas os caminhos já permitidos, como cadastrar equipe, aceitar vínculo ou trocar de conta.

### 7.4 Escolher equipe

Usado quando o usuário controla mais de uma equipe ou é manager.

A Lili lista somente `equipes_disponiveis` retornadas pelo sistema. A seleção chama a função atual de escolha e recarga do convite.

### 7.5 Confirmar equipe

A página encontrou uma equipe única e solicita confirmação antes da inscrição.

A Lili informa claramente o nome da equipe e do grupo.

### 7.6 Escolher line e slot

A Lili utiliza:

- lines existentes;
- opção de criar nova line;
- slots livres retornados pelo backend;
- validações existentes de nome e disponibilidade.

A submissão continua usando o endpoint atual.

### 7.7 Sucesso

A Lili só confirma sucesso após resposta positiva da API.

Depois disso, pode conduzir para:

- pagamento;
- criação do link de escalação;
- gerenciamento de jogadores;
- acompanhamento do grupo.

### 7.8 Hub

Usado quando já existe participação da equipe no grupo.

A Lili não tenta inscrever novamente. Ela apresenta as ações permitidas para a participação existente.

### 7.9 Acompanhar

Permite consultar slots, equipes e jogadores sem iniciar uma nova inscrição.

Quando inscrições estiverem fechadas, a Lili respeita `status_mensagem` e não oferece cadastro indevido.

## 8. Autenticação e perfis

Cada fluxo possui exigências diferentes.

### Convite de grupo ou equipe

Pode exigir:

- sessão ativa;
- perfil de equipe;
- perfil de manager;
- equipe controlada;
- seleção de uma equipe entre várias.

### Link de escalação

Pode exigir:

- sessão ativa;
- perfil de jogador;
- vínculo permitido com a line ou equipe;
- validações específicas do convite.

A Lili deve usar o perfil solicitado pelo fluxo atual. Ela não deve reutilizar automaticamente `profileType="equipe"` em fluxos de jogador.

## 9. Arquitetura recomendada

### 9.1 Camada visual

Responsável por:

- avatar;
- bolhas;
- indicador de digitação;
- texto progressivo;
- botões rápidos;
- campo de mensagem;
- acessibilidade.

Os nomes técnicos atuais podem permanecer temporariamente (`DropBotChat`, `DropBotAssistant`) para reduzir risco. O nome público deve ser Lili.

### 9.2 Adaptador de conversa

Cada página transforma seu estado real em uma descrição de conversa.

Exemplo conceitual:

```ts
type AssistantConversationState = {
  id: string
  messages: AssistantMessage[]
  actions: AssistantAction[]
  busy?: boolean
}
```

O adaptador não altera o estado da página sozinho. As ações recebidas apontam para funções já existentes.

### 9.3 Motor de dúvidas

O motor atual de intenções pode continuar atendendo perguntas livres. Ele deve ficar separado do fluxo guiado.

Assim a Lili terá duas capacidades:

- guiar uma tarefa;
- responder dúvidas sobre os dados carregados.

## 10. Persistência da conversa

A persistência deve guardar apenas dados de interface, por exemplo:

- modo escolhido;
- idioma;
- etapa visual;
- mensagens já exibidas;
- identificador seguro do convite.

Não guardar em `localStorage`:

- tokens de autenticação;
- dados sensíveis;
- respostas que substituam o backend;
- confirmação falsa de operações.

O estado real sempre deve ser revalidado pela API ao retornar.

## 11. Tratamento de erros

A Lili deve mostrar o erro real em linguagem simples e oferecer uma próxima ação segura.

Exemplo:

> Não consegui concluir a inscrição porque esse slot acabou de ser ocupado.
>
> Escolha outro slot livre para continuar.

Nunca responder apenas “Algo deu errado” quando existir uma mensagem útil retornada pela API.

## 12. Plano de implementação

### Etapa 1 — Identidade pública

- Alterar textos visíveis de DropBot para Lili.
- Manter nomes internos para evitar quebra.
- Alterar “atendimento automático” para “Assistente Virtual do DropZone”.
- Manter o ícone atual temporariamente.

### Etapa 2 — Mapeamento formal do convite de grupo

- Extrair mensagens e ações de cada `step`.
- Evitar repetição de marcação JSX.
- Manter todas as funções atuais.

### Etapa 3 — Adaptador reutilizável

- Criar tipos neutros para mensagens e ações.
- Fazer a página produzir o estado da conversa.
- Reutilizar o componente visual.

### Etapa 4 — Persistência segura

- Retomar modo e conversa visual.
- Revalidar dados no carregamento.

### Etapa 5 — Link de escalação

- Mapear autenticação e perfil de jogador.
- Aplicar a mesma arquitetura sem copiar regras do convite de equipe.

### Etapa 6 — Outros fluxos

- convite de equipe;
- cadastro de campeonato;
- venda de vagas;
- pagamentos;
- painel administrativo.

## 13. Critérios de aceite

Uma etapa só pode ser considerada concluída quando:

- o modo rápido continua funcionando;
- a Lili chega ao mesmo resultado do modo rápido;
- os mesmos endpoints são chamados;
- as mesmas validações são respeitadas;
- trocar de modo não perde os dados atuais;
- login e retorno mantêm o convite correto;
- convite fechado não oferece inscrição;
- usuário com várias equipes precisa escolher uma;
- sucesso só aparece após confirmação da API;
- build e TypeScript passam sem erro.
