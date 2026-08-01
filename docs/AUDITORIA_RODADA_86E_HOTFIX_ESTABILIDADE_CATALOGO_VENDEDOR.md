# Rodada 86E — Hotfix de estabilidade do catálogo do vendedor

## Motivo

O Playwright completo aprovou 151 de 152 testes. A única falha ocorreu no projeto mobile do teste controlado de vendedor, imediatamente após a ativação do vínculo, porque o catálogo público ainda não havia refletido a alteração.

## Ajuste

O teste agora aguarda por até 20 segundos, com consultas progressivas, até o campeonato aparecer no catálogo público do vendedor.

## Garantias

- nenhuma regra de negócio foi alterada;
- nenhuma migration foi adicionada;
- nenhum dado real permanente é criado;
- o lock e a limpeza do teste continuam preservados;
- o teste deixa de depender de consistência imediata entre escrita e leitura pública.
