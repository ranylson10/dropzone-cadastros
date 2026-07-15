-- =============================================================================
-- Regras de permissão do campeonato (banco + contrato para backend/frontend)
-- =============================================================================
--
-- Papéis:
--   owner   = produtora dona (produtoras.auth_user_id) ou campeonatos.criado_por
--   manager = staff em manager_produtora (pode_ver / pode_gerar_token / pode_gerenciar)
--   seller  = manager em campeonato_vendedores com permissoes jsonb
--
-- Quem faz o quê:
--   Criar campeonato .............. somente owner (perfil produtora)
--   Criar/editar/excluir jogos .... owner ou manager com pode_gerenciar_campeonato
--   Editar fases/grupos/slots ..... owner ou manager com gestão (seller só se organizar_grupos)
--   Adicionar/remover equipes ..... owner/manager com gestão; seller só se flags opt-in
--   Gerar link único .............. owner / manager com token / seller com gerar_convites_equipe
--   Link de grupo ................. owner; expira (ativo=false) quando grupo sem slots livres
--   Pontuar tabela ................ owner / manager com gestão / seller com pontuar_tabela
--   Demais usuários ............... leitura sem mutação
--
-- Link único (tokens.tipo = convite_equipe_campeonato):
--   - single use: status usado + usado=true no aceite
--   - safety: expira_em (app usa 24h)
--
-- Link de grupo (campeonato_links.tipo = inscricao_equipes_grupo):
--   - multi use até encher o grupo
--   - trigger fecha ativo=false quando não restam slots livres
-- =============================================================================

-- Defaults de vendedor em novas linhas (opt-in para add/remove/estrutura write)
alter table public.campeonato_vendedores
  alter column permissoes set default jsonb_build_object(
    'vendedor_vagas', true,
    'adicionar_equipes', false,
    'remover_proprias_equipes', false,
    'gerar_convites_equipe', true,
    'ver_estrutura', true,
    'organizar_grupos', false,
    'pontuar_tabela', false
  );

alter table public.tokens
  alter column manager_permissoes set default jsonb_build_object(
    'vendedor_vagas', true,
    'adicionar_equipes', false,
    'remover_proprias_equipes', false,
    'gerar_convites_equipe', true,
    'ver_estrutura', true,
    'organizar_grupos', false,
    'pontuar_tabela', false
  );

-- Comentários de documentação
comment on column public.campeonato_vendedores.permissoes is
  'Flags de vendedor: gerar_convites_equipe (padrão true); adicionar_equipes/remover_proprias_equipes/organizar_grupos/pontuar_tabela opt-in.';

comment on column public.manager_produtora.pode_gerenciar_campeonato is
  'Manager staff: editar grupos/jogos/tabelas e equipes do campeonato da produtora.';

comment on column public.manager_produtora.pode_gerar_token is
  'Manager staff: pode gerar convites únicos de equipe.';

-- -----------------------------------------------------------------------------
-- Fecha link de grupo quando todos os slots do grupo estão ocupados
-- -----------------------------------------------------------------------------
create or replace function public.fn_fechar_link_grupo_se_cheio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total int;
  v_livres int;
  v_campeonato_id uuid;
  v_grupo_id uuid;
begin
  v_campeonato_id := coalesce(new.campeonato_id, old.campeonato_id);
  v_grupo_id := coalesce(new.grupo_id, old.grupo_id);
  if v_campeonato_id is null or v_grupo_id is null then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_total
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id
    and s.grupo_id = v_grupo_id;

  if coalesce(v_total, 0) < 1 then
    return coalesce(new, old);
  end if;

  select count(*)::int into v_livres
  from public.campeonato_slots s
  where s.campeonato_id = v_campeonato_id
    and s.grupo_id = v_grupo_id
    and s.line_id is null
    and s.equipe_id is null;

  if coalesce(v_livres, 0) = 0 then
    update public.campeonato_links l
       set ativo = false,
           metadata = coalesce(l.metadata, '{}'::jsonb)
                      || jsonb_build_object(
                           'closed_reason', 'grupo_cheio',
                           'closed_at', now()
                         )
     where l.campeonato_id = v_campeonato_id
       and l.grupo_id = v_grupo_id
       and l.tipo = 'inscricao_equipes_grupo'
       and l.ativo is true;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_fechar_link_grupo_slot on public.campeonato_slots;
create trigger trg_fechar_link_grupo_slot
after insert or update of line_id, equipe_id, grupo_id, campeonato_id
on public.campeonato_slots
for each row
execute function public.fn_fechar_link_grupo_se_cheio();

-- View de auditoria de permissões de vendedor (somente leitura)
create or replace view public.vw_campeonato_permissoes_vendedores as
select
  cv.id,
  cv.campeonato_id,
  cv.produtora_id,
  cv.manager_id,
  cv.status,
  cv.limite_vagas,
  coalesce((cv.permissoes->>'gerar_convites_equipe')::boolean, true) as gerar_convites_equipe,
  coalesce((cv.permissoes->>'adicionar_equipes')::boolean, false) as adicionar_equipes,
  coalesce((cv.permissoes->>'remover_proprias_equipes')::boolean, false) as remover_proprias_equipes,
  coalesce((cv.permissoes->>'ver_estrutura')::boolean, true) as ver_estrutura,
  coalesce((cv.permissoes->>'organizar_grupos')::boolean, false) as organizar_grupos,
  coalesce((cv.permissoes->>'pontuar_tabela')::boolean, false) as pontuar_tabela
from public.campeonato_vendedores cv;

comment on view public.vw_campeonato_permissoes_vendedores is
  'Expõe flags de permissão do vendedor com defaults do modelo (convite sim; add/remove não).';
