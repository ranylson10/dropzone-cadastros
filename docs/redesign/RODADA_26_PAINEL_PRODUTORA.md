# R26 · Painel da produtora — lista e editor integrados

Base: ZIP do projeto atualizado pelo Codex recebido em 04/11/2026.

## Alterações

- Cabeçalho da produtora ganha uma faixa grafite e destaque visual para logo, nome e edição do perfil.
- Desktop: `Criar campeonato` e lista pesquisável/filtros à esquerda; detalhe da competição selecionada permanece à direita, sem voltar à lista para trocar.
- Item ativo fica destacado; o menu de **Organização**, **Fases e grupos**, **Equipes**, **Elencos**, **Jogos e quedas**, **Pontuador**, **Tabelas** e **Inscrições** passa a ser horizontal e rolável acima do conteúdo.
- Mobile: seletor de campeonato e botão de criação acima; abas horizontais roláveis, sem coluna lateral comprimida.
- Pontuador: abre em **nova aba/janela**, com uma rota própria `/campeonatos/[id]/pontuador` que conserva a seleção de fase e jogo. A rota antiga por jogo continua funcionando.
- Nenhuma alteração em APIs, permissões, pagamentos ou migrations.

## Instalação e teste no Windows

Para quem já possui a versão do Codex, extraia o patch R26 mantendo os caminhos e sobrescrevendo os arquivos existentes. Não substitua os demais arquivos do Codex por pacotes antigos.

```cmd
cd /d E:\dropzone-cadastros
TESTAR_RODADA_26.bat
npm run typecheck
npm run build
```

Faça a conferência manual com uma conta de produtora: abra mais de um campeonato, alterne seções, crie campeonato, verifique pagamento e abra o pontuador em outra aba. Depois valide o seletor no celular e a rolagem das abas.

## Limitações de validação

Foram executadas verificações locais de estrutura, sintaxe TSX/CSS e contratos antigos atualizados. Este ambiente não contém as dependências npm necessárias para executar o build Next.js nem uma sessão autenticada para conferir o layout em navegador. Não houve publicação na Vercel ou alteração no Supabase.
