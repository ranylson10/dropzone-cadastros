-- Chaves PIX salvas na carteira (saque preferido)
alter table public.sistema_carteiras
  add column if not exists pix_chave text,
  add column if not exists pix_tipo text
    check (pix_tipo is null or pix_tipo in ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria')),
  add column if not exists pix_titular text;
