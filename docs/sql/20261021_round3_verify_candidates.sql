-- SELECT-ONLY: para HOMOLOGACAO, compara indice aplicado com definicao esperada.
-- Resultado: ausente / invalid / revisar_definicao / valido. Sem efeitos colaterais.
with expected(idx,table_name,column_name) as (values
 ('campeonato_jogadores_jogo_id_r03_idx','campeonato_jogadores','jogo_id'),
 ('campeonato_slots_line_id_r03_idx','campeonato_slots','line_id'),
 ('sistema_auditoria_administrador_r03_idx','sistema_auditoria','administrador_auth_user_id')
), observed as (
 select e.*,i.indexrelid, i.indisvalid, i.indisready, i.indisunique,
   pg_get_indexdef(i.indexrelid) as definition,
   pg_get_expr(i.indpred,i.indrelid) as predicate,
   am.amname as method,
   a.attname as leading_column,
   t.relname as index_table
 from expected e
 left join pg_class ix on ix.oid=to_regclass('public.'||e.idx)
 left join pg_index i on i.indexrelid=ix.oid
 left join pg_class t on t.oid=i.indrelid
 left join pg_am am on am.oid=ix.relam
 left join pg_attribute a on a.attrelid=t.oid and a.attnum=i.indkey[0]
)
select idx,index_table,definition,
 case when indexrelid is null then 'ausente'
      when not coalesce(indisvalid,false) or not coalesce(indisready,false) then 'indice_invalido'
      when index_table<>table_name or leading_column<>column_name or method<>'btree'
        or indisunique is distinct from false then 'revisar_definicao'
      when regexp_replace(lower(coalesce(predicate,'')),'[() \"\t\n]','','g') <> lower(column_name)||'isnotnull' then 'revisar_predicado'
      else 'valido' end as verificacao
from observed order by idx;
