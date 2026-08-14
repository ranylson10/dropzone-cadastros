-- MatchResult é evidência da escalação real. Seus jogadores devem permanecer
-- registrados mesmo acima do limite comercial da formação.

drop trigger if exists campeonato_jogadores_validar_slot on public.campeonato_jogadores;

create trigger campeonato_jogadores_validar_slot
before insert or update of campeonato_equipe_id, campeonato_id, equipe_id, line_id, slot_numero, status
on public.campeonato_jogadores
for each row
when (new.status = 'ativo' and coalesce(new.origem, '') <> 'matchresult')
execute function public.validar_slot_escalacao();

comment on trigger campeonato_jogadores_validar_slot on public.campeonato_jogadores is
  'Valida slots de formação manual. Registros do MatchResult são histórico comprovável e não consomem slot.';
