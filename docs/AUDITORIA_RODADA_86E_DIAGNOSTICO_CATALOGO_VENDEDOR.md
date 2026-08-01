# Rodada 86E — diagnóstico controlado do catálogo do vendedor

Este hotfix não altera regras comerciais. Ele adiciona diagnóstico autenticado por administrador à API pública de vagas somente quando `debug_campeonato` é informado.

O teste isolado consulta esse diagnóstico e, em caso de falha, informa exatamente qual filtro excluiu o campeonato: consulta inicial, configuração/inscrições, banner, vínculo ativo, vagas oficiais ou grupos/slots livres.

A espera foi reduzida de 20 para 8 segundos. O campo de diagnóstico não é retornado em chamadas normais e exige sessão de administrador.
