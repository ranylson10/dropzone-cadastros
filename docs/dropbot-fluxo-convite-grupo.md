# Fluxo do DropBot - Convite de Grupo

Arquivo para revisão dos textos do chat de inscrição de equipes.

Edite livremente as falas, perguntas e opções. Depois me envie o arquivo ou cole os trechos alterados que eu aplico no sistema.

---

## 1. Início do convite

### Bot
Oi! Eu sou o DropBot 🤖

Você recebeu um convite para o grupo **{grupo}** do campeonato **{campeonato}**.

O que você quer fazer?

### Opções do usuário
- Quero inscrever minha equipe
- Só acompanhar as inscrições

---

## 2. Usuário quer inscrever, mas não está logado

### Usuário
Quero inscrever minha equipe

### Bot
Verifiquei aqui: você ainda não está logado em nenhuma conta de equipe.

Entre com Google para eu identificar sua equipe. Se ainda não tiver uma, eu te levo para cadastrar.

### Opções do usuário
- Continuar com Google
- Só acompanhar as inscrições

---

## 3. Link não aceita novas inscrições

### Usuário
Quero inscrever minha equipe

### Bot
Esse link não aceita novas inscrições agora.

Se sua equipe já está no grupo, entre com Google para escalar o elenco.

### Opções do usuário
- Continuar com Google
- Só acompanhar as inscrições

---

## 4. Usuário logou, mas não tem equipe cadastrada

### Usuário
Quero inscrever minha equipe

### Bot
Seu Google entrou certinho.

Mas ainda não encontrei uma **equipe cadastrada** nessa conta.

Cadastre sua equipe e depois eu continuo a inscrição.

### Opções do usuário
- Cadastrar minha equipe
- Continuar com Google
- Só acompanhar

---

## 5. Usuário entrou como manager sem equipe controlada

### Usuário
Quero inscrever minha equipe

### Bot
Você entrou como manager, mas ainda não controla nenhuma equipe. Cadastre ou aceite uma equipe para continuar.

### Opções do usuário
- Cadastrar minha equipe
- Continuar com Google
- Só acompanhar

---

## 6. Usuário controla mais de uma equipe

### Usuário
Quero inscrever minha equipe

### Bot - se for manager
Você entrou como **manager**.

Escolha com qual equipe deseja se inscrever neste campeonato.

### Bot - se não for manager
Você controla mais de uma equipe. Com qual deseja entrar?

### Opções do usuário
- Usar {equipe 1}
- Usar {equipe 2}
- Usar {equipe 3}
- Continuar com {equipe atual}
- Só acompanhar

---

## 7. Link fechado, mas usuário pode gerenciar equipe inscrita

### Bot - se for manager
Você entrou como **manager**.

Escolha a equipe inscrita neste grupo para gerenciar a escalação.

### Bot - se não for manager
Você controla mais de uma equipe. Escolha a inscrita neste grupo para gerenciar a escalação.

### Opções do usuário
- Gerenciar {equipe inscrita 1}
- Gerenciar {equipe inscrita 2}
- Só acompanhar

---

## 8. Confirmar equipe logada

### Usuário
Quero inscrever minha equipe

### Bot
Você está logado com a equipe **{equipe}**.

Quer inscrever essa equipe no grupo **{grupo}**?

### Usuário
{equipe}

### Opções do usuário
- Sim, inscrever {equipe}
- Continuar com Google
- Só acompanhar

---

## 9. Escolher slot

### Usuário
Sim, quero inscrever a {equipe}

### Bot
Fechado. Escolha um slot livre para a **{equipe}**.

### Bot - lista de slots
Slots do grupo **{grupo}**

Livres agora: {slots_livres}

### Opções do usuário
- Slot A
- Slot B
- Slot C
- Slot D
- Slot E
- Slot F
- Slot G
- Slot H
- Slot I
- Slot J
- Slot K
- Slot L

---

## 10. Usuário escolhe slot ocupado

### Usuário
Escolho o slot {slot}

### Bot
Esse slot {slot} já está ocupado. Escolha outro livre: {slots_livres}.

### Bot - lista de slots novamente
Slots do grupo **{grupo}**

Livres agora: {slots_livres}

### Opções do usuário
- Slots livres disponíveis
- Slots ocupados aparecem bloqueados/ocupados

---

## 11. Usuário escolhe slot livre

### Usuário
Escolho o slot {slot}

### Bot
Boa. Slot {slot} selecionado.

---

## 12. Aviso de lines já inscritas

### Bot
Agora precisamos escolher uma line.

Essas aqui já estão no campeonato e não podem ser inscritas de novo:

**{lines_ja_inscritas}**

---

## 13. Escolher line

### Bot
Você pode inscrever uma dessas lines livres ou criar uma nova:

### Opções do usuário
- {line livre 1}
- {line livre 2}
- + Criar nova line

---

## 14. Usuário escolhe line existente

### Usuário
Vai ser a line {line}

### Bot
Resumo antes de confirmar:

Equipe: **{equipe}**  
Grupo: **{grupo}**  
Slot: **{slot}**  
Line: **{line}**

Posso finalizar sua inscrição?

### Opções do usuário
- Sim, confirmar inscrição
- Só acompanhar por enquanto

---

## 15. Usuário escolhe criar nova line

### Usuário
Quero criar uma nova line

### Bot
Perfeito. Digite o nome da nova line. Exemplo: **ALOE ELITE 2**.

### Campo do usuário
Nome da line: {nome_nova_line}

### Bot
Resumo antes de confirmar:

Equipe: **{equipe}**  
Grupo: **{grupo}**  
Slot: **{slot}**  
Line: **{nome_nova_line}**

Posso finalizar sua inscrição?

### Opções do usuário
- Sim, confirmar inscrição
- Só acompanhar por enquanto

---

## 16. Erros antes de confirmar inscrição

### Caso: usuário não está logado
Bot: Entre com sua conta de equipe para continuar.

### Caso: usuário não tem equipe
Bot: Redireciona para etapa de equipe não encontrada.

### Caso: criar nova line sem nome
Bot: Selecione uma line livre ou digite o nome de uma nova line.

### Caso: nome inválido de line
Bot: Use um nome real para a line (ex.: ALOE ELITE 2), não "Nova Line".

### Caso: nenhum slot selecionado
Bot: Selecione o slot que sua equipe vai ocupar.

### Caso: API retorna erro
Bot: {erro_retornado_pela_api}

---

## 17. Inscrição confirmada

### Bot
Pronto, inscrição confirmada ✅

Guarde o comprovante abaixo. Boa sorte no campeonato!

### Usuário
{line} · slot {slot}

### Bot
O que você quer fazer agora?

### Opções do usuário
- Gerenciar minha inscrição
- Ver grupo

---

## 18. Inscrição confirmada com pagamento pendente

### Bot
Falta só o pagamento da inscrição: **{valor}**

Quer gerar o pagamento agora?

### Opções do usuário
- Pagar inscrição
- Abrir fatura novamente

---

## 19. Central da inscrição

### Bot
Você está na central da sua inscrição.

Escolha o que quer fazer agora:

### Se tiver mais de uma line inscrita
Bot: Você tem mais de uma line inscrita. Qual delas vamos gerenciar?

### Opções do usuário
- {line inscrita 1} · slot {slot}
- {line inscrita 2} · slot {slot}
- Escalar elenco
- Jogadores inscritos
- Acompanhar inscrições
- Inscrever outra line

---

## 20. Acompanhar inscrições

### Bot
Essas são as inscrições do grupo **{grupo}**.

Toque em uma equipe ocupada para ver line e jogadores.

### Bot - mapa de slots
Mapa de slots

### Opções do usuário
- Escalar minha equipe
- Gerenciar minha inscrição
- Entrar para gerenciar escalação
- Gerenciar escalação da minha equipe

### Se inscrições encerradas
Bot: {status_mensagem} ou Novas inscrições por este link estão encerradas.

---

## 21. Escalar elenco

### Usuário
Quero escalar o elenco

### Bot
Certo. Vou cuidar da escalação da line **{line}**.

Você pode copiar o link atual ou gerar um novo.

---

## 22. Link de escalação ativo

### Bot
Link ativo:

{url_do_link_ativo}

### Opções do usuário
- Copiar link ativo
- Gerar novo link
- Voltar para minha inscrição

---

## 23. Gerar novo link de escalação

### Usuário
Gerar link de escalação

### Bot
Pronto, gerei um link novo:

{url_do_novo_link}

### Opções do usuário
- Copiar link
- Voltar para minha inscrição

---

## 24. Erros ao gerar link de escalação

### Caso: nenhuma line inscrita
Bot: Nenhuma line inscrita neste grupo.

### Caso: usuário não está logado
Bot: Entre com sua conta de equipe para continuar.

### Caso: API retorna erro
Bot: {erro_retornado_pela_api} ou Erro ao gerar link de escalação.

---

## 25. Jogadores inscritos

### Usuário
Ver jogadores inscritos

### Bot
Lista de jogadores da line **{line}**:

### Se não tiver jogadores
Bot: Nenhum jogador confirmou escalação ainda.

### Se tiver jogadores
Bot mostra lista:
- {nick} · {função} · ID {id_jogo}
- {nick} · {função} · ID {id_jogo}

### Opções do usuário
- Gerar link de escalação
- Voltar para minha inscrição

---

## 26. Modal público ao tocar em slot ocupado

### Sistema
Abre detalhes da line do slot.

### Conteúdo
Slot {slot}

{line_ou_equipe}

{equipe}

### Se não tiver jogadores
Nenhum jogador escalado ainda.

### Se tiver jogadores
- {nick} · {função} · ID {id_jogo}
- {nick} · {função} · ID {id_jogo}

---

## Observações para edição

- Textos entre `{chaves}` são variáveis do sistema. Pode mudar a frase, mas mantenha a variável se quiser que o dado continue aparecendo.
- Pode trocar o tom do bot para mais formal, divertido, curto ou humanizado.
- Pode adicionar novas respostas sugeridas. Eu depois avalio se precisa mexer só no texto ou também no código do fluxo.
- Se quiser remover alguma opção, marque como `REMOVER` embaixo dela.
