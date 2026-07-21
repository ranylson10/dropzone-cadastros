# DropBot real - plano de implementação

Este documento descreve a nova base reutilizável de chatbot criada em `web/features/chatbot`.

## Objetivo

Criar um atendimento automático com sensação de conversa real:

- mensagens em sequência;
- indicador de `digitando...`;
- texto aparecendo como se estivesse sendo digitado;
- respostas rápidas;
- caminhos diferentes conforme escolha do usuário;
- base reutilizável para convite de equipes, escalação de jogadores, cadastro de equipe e futuras páginas.

## Arquivos criados

- `web/features/chatbot/DropBotChat.tsx`
- `web/features/chatbot/index.ts`

## Componentes disponíveis

### `DropBotChat`

Renderiza uma conversa completa.

Recebe:

- `title`: nome do bot;
- `messages`: lista de mensagens;
- `isTyping`: mostra indicador de digitando;
- `className`: classe extra opcional.

### `DropBotTypingIndicator`

Indicador isolado de digitando.

### `DropBotMessage`

Formato de mensagem:

```ts
type DropBotMessage = {
  id: string
  role: 'bot' | 'user'
  author?: string
  text?: string
  content?: React.ReactNode
  typing?: boolean
  typingSpeedMs?: number
  options?: DropBotOption[]
}
```

### `DropBotOption`

Formato das respostas rápidas:

```ts
type DropBotOption = {
  id: string
  label: string
  description?: string
  primary?: boolean
  disabled?: boolean
  onSelect: () => void
}
```

## Como plugar em uma página

Exemplo simples:

```tsx
import { DropBotChat, type DropBotMessage } from '@/features/chatbot'

const messages: DropBotMessage[] = [
  {
    id: 'boas-vindas',
    role: 'bot',
    text: 'Oi! Eu sou o DropBot. Quer cadastrar sua equipe?',
    typing: true,
    options: [
      { id: 'sim', label: 'Cadastrar equipe', primary: true, onSelect: startCadastro },
      { id: 'nao', label: 'Só acompanhar', onSelect: acompanhar },
    ],
  },
]

return <DropBotChat title="DropBot" messages={messages} isTyping={busy} />
```

## Próximas integrações recomendadas

### 1. Convite de grupo

Substituir os blocos locais:

- `BotBubble`
- `UserBubble`
- `TypingBubble`
- `invite-chat-option`
- `invite-chat-actions`

por `DropBotChat`.

### 2. Escalação de jogadores

Usar o mesmo motor em `web/app/escala/[token]/page.tsx`.

Fluxo sugerido:

1. Bot apresenta campeonato/equipe/line.
2. Usuário confirma que quer escalar jogador.
3. Bot verifica login.
4. Bot pede dados do jogador.
5. Bot confirma envio.

### 3. Cadastro de equipe

Usar DropBot como assistente no onboarding:

1. Pergunta nome da equipe.
2. Pede logo.
3. Pede tag/opcional.
4. Confirma criação.

### 4. Futuras páginas

O mesmo componente pode ser usado em:

- compra de vaga;
- criação de campeonato;
- suporte ao manager;
- convite de staff;
- cobrança/pagamento.

## Importante

A base visual e funcional já existe, mas cada página precisa transformar seu estado atual em uma lista de mensagens `DropBotMessage[]`.

Isso evita remendo visual e deixa o comportamento realmente parecido com atendimento automático.
