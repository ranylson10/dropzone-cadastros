# Rodada 87O1 — Agenda contextual somente com datas de jogos

## Ajuste

As agendas públicas/contextuais de campeonato, equipe e demais perfis deixam de exibir a semana ou todos os dias do mês. O componente agrupa os eventos por data e mostra somente datas que possuem jogo ou compromisso.

## Regras

- `/agenda` pessoal mantém a experiência completa e permite criar horários.
- Agenda contextual usa `compact` com `canCreate={false}`.
- Não há botão Novo horário nem horários vazios.
- Datas sem eventos não são renderizadas.
- A lista de datas é horizontal e responsiva.
- Ao selecionar uma data, são exibidos somente os eventos daquele dia.
