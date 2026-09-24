import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const migration = read('supabase/migrations/20260924200853_produtora_workspaces_convites.sql')
const adminInvite = read('web/app/api/admin/produtoras/convites/route.ts')
const memberApi = read('web/app/api/produtora/membros/route.ts')
const acceptApi = read('web/app/api/produtora/convites/[token]/route.ts')
const invitePage = read('web/app/convite/produtora/[token]/page.tsx')
const memberPanel = read('web/features/produtoras/components/ProducerMembersPanel.tsx')
const producerPanel = read('web/features/dropzone/panels/produtora/ProdutoraPanel.tsx')
const workspaceAccess = read('backend/src/produtora/workspace-access.ts')
const permissions = read('backend/src/campeonatos/campeonato-permissions.ts')
const serverAuth = read('backend/src/auth/server-auth.ts')
const meApi = read('web/app/api/me/route.ts')
const home = read('web/features/dropzone/DropZoneHome.tsx')
const authReturn = read('web/features/auth/auth-return.ts')
const uploadAccess = read('backend/src/uploads/upload-access.ts')


test.describe('Rodada 146 — convites, membros e permissões de produtora', () => {
  test('migration cria membros e convites privados da produtora', () => {
    expect(migration).toContain('create table if not exists public.produtora_membros')
    expect(migration).toContain('create table if not exists public.produtora_convites')
    expect(migration).toContain("tipo text not null check (tipo in ('criacao','membro'))")
    expect(migration).toContain('token_hash text not null unique')
    expect(migration).toContain('alter table public.produtora_membros enable row level security')
    expect(migration).toContain('revoke all on table public.produtora_convites from anon, authenticated')
  })

  test('produtoras existentes recebem proprietário com acesso total', () => {
    expect(migration).toContain('dropzone_produtora_owner_member_trigger')
    expect(migration).toContain("p.id, p.auth_user_id, 'proprietario'")
    expect(migration).toContain('pode_gerenciar_membros = true')
    expect(migration).toContain('pode_criar_campeonato = true')
  })

  test('admin só convida e-mail já cadastrado e envia convite por email', () => {
    expect(adminInvite).toContain('findRegisteredAuthUserByEmail(email)')
    expect(adminInvite).toContain('Este e-mail ainda não possui conta no DropZone.')
    expect(adminInvite).toContain("tipo: 'criacao'")
    expect(adminInvite).toContain('sendDropZoneActionEmail')
    expect(adminInvite).toContain('/convite/produtora/${rawToken}')
  })

  test('token bruto não é persistido no banco', () => {
    expect(adminInvite).toContain("const rawToken = randomBytes(32).toString('hex')")
    expect(adminInvite).toContain('token_hash: hashToken(rawToken)')
    expect(acceptApi).toContain("createHash('sha256').update(value).digest('hex')")
    expect(acceptApi).toContain(".eq('token_hash', hashToken(rawToken))")
  })

  test('aceite cria workspace apenas para a conta destinatária', () => {
    expect(acceptApi).toContain('Este convite pertence a outra conta.')
    expect(acceptApi).toContain("if (invite.tipo === 'criacao')")
    expect(acceptApi).toContain("aprovacao_status: 'aprovado'")
    expect(acceptApi).toContain("status: 'aceito'")
    expect(invitePage).toContain('Criar minha produtora')
    expect(invitePage).toContain('Aceitar acesso')
  })

  test('membros possuem cargos e presets de permissão', () => {
    expect(memberApi).toContain('normalizeProducerMemberRole(body.cargo)')
    expect(memberApi).toContain('producerRolePermissions(role)')
    expect(memberPanel).toContain('PRODUCER_MEMBER_ROLES')
    expect(memberPanel).toContain('Convidar por e-mail')
    expect(memberPanel).toContain('Equipe interna')
  })

  test('somente quem gerencia membros pode convidar alterar ou remover', () => {
    const checks = memberApi.match(/requireProducerWorkspaceAccess\(user\.id, produtoraId, 'gerenciar_membros'\)/g) || []
    expect(checks.length).toBeGreaterThanOrEqual(3)
    expect(workspaceAccess).toContain("gerenciar_membros: 'pode_gerenciar_membros'")
    expect(memberApi).toContain('O proprietário não pode ser removido da própria produtora.')
  })

  test('campeonatos respeitam cargos do workspace', () => {
    expect(permissions).toContain('getProducerWorkspaceAccess(userId, produtoraId)')
    expect(permissions).toContain("role: 'workspace'")
    expect(permissions).toContain('workspace.pode_pontuar')
    expect(permissions).toContain('workspace.pode_comercial')
    expect(permissions).toContain('workspace.pode_operar')
  })

  test('api me inclui workspace de membro e seleciona por profile id', () => {
    expect(migration).toContain("'workspace_member_id', pm.id")
    expect(migration).toContain("'workspace_role', pm.cargo")
    expect(serverAuth).toContain("req.headers.get('x-profile-id')")
    expect(meApi).toContain("req.headers.get('x-profile-id')")
  })

  test('frontend mantém id do workspace ativo para múltiplas produtoras', () => {
    expect(home).toContain("localStorage.getItem('dropzone_active_profile_id')")
    expect(home).toContain("params.get('perfil_id')")
    expect(home).toContain("localStorage.setItem('dropzone_active_profile_id', selectedAccount.id)")
    expect(home).toContain('authHeaders(accessToken, selectedAccount.profile_type, selectedAccount.id)')
    expect(home).toContain('loadMeAndRows(undefined, nextAccount.profile_type as WebProfileType, nextAccount.id)')
  })

  test('login pode retornar direto para convite de produtora', () => {
    expect(authReturn).toContain("path.startsWith('/convite/produtora/')")
    expect(invitePage).toContain('buildLoginHref(null, currentInternalPath())')
    expect(invitePage).toContain('perfil_id=${encodeURIComponent(workspaceId)}')
    expect(invitePage).toContain('Entre com o mesmo e-mail que recebeu o convite')
  })

  test('uploads de produtora e novos campeonatos também respeitam permissões', () => {
    expect(uploadAccess).toContain("requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'administrar')")
    expect(uploadAccess).toContain("requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'operar')")
    expect(uploadAccess).toContain("requireProducerWorkspaceAccess(input.user.id, activeProducer.id, 'criar_campeonato')")
    expect(producerPanel).toContain('<ProducerMembersPanel producerId={props.account.id} />')
  })
})
