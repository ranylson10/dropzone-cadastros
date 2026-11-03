# DropZone R19 - correcao apos testes reais do Windows

## Resultado recebido
- `npm ci`: 414 pacotes instalados.
- `tsc --noEmit`: aprovado.
- `eslint`: aprovado.
- `next build`: compilou; falhou no prerender de `/campeonatos` com `ENOTFOUND build-placeholder.supabase.co`.
- `HOMOLOGAR_POSTGRES_R19.bat`: parou antes de iniciar o laboratorio; ZIP original nao informado.
- `test:round19`: um teste de contrato do launcher Web falhou na instalacao local reportada. O arquivo do pacote original passou neste ambiente; foi feito um teste menos dependente de caminho e diretorio atual.

## Ajustes
- Direitorios `/campeonatos`, `/equipes`, `/jogadores`, `/produtoras`, `/managers` usam renderizacao por requisicao, evitando consultar o Supabase durante o build ficticio.
- Cache do resultado da listagem (`unstable_cache`) ainda tem validade de 30 segundos.
- O teste do BAT aceita barras do Windows e usa raiz absoluta.
- O executor Web sobrescreve no processo filho chaves sensiveis que o Next carregaria de `.env.local`; nunca envia os valores reais do arquivo ao subprocesso. A protecao cobre os nomes de chave reconhecidos, nao e um substituto para testes em staging.
- O atalho PostgreSQL reconhece o ZIP original na raiz do projeto e mostra instrucoes de arrastar/caminho completo.
- Incluido teste automatico de regressao `npm run test:round19:buildfix`.

## Como confirmar no Windows
Abra o CMD na pasta raiz corrigida e execute:

```cmd
HOMOLOGAR_WEB_R19.bat
TESTAR_RODADA_19.bat
```

O segundo atalho pode terminar com o bloqueio de publicacao esperado, apesar de a bateria de regressao passar. Nao confundir com erro de teste.

Para o laboratorio Docker (isola PostgreSQL, **nao usa producao**), coloque `dropzone-cadastros-ENVIO.zip` na pasta raiz ou execute:

```cmd
HOMOLOGAR_POSTGRES_R19.bat "CAMINHO_COMPLETO_DO_ZIP_ORIGINAL"
```

Nao copie a saida do CMD de volta no CMD. Ela e um relatorio; envie o texto ao suporte.

**Limitacoes:** esta correção nao executou o build Next.js completo nem o PostgreSQL isolado neste ambiente. O resultado precisa ser conferido no Windows do usuario.
