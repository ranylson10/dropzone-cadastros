import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), 'utf8')

const login = read('web/app/login/page.tsx')
const home = read('web/features/home/AuthenticatedHomeFeed.tsx')
const dropzone = read('web/features/dropzone/DropZoneHome.tsx')
const styles = read('web/app/globals.css')
const homeStyles = read('web/features/home/authenticated-home.css')
const registerApi = read('web/app/api/auth/register/route.ts')

test.describe('Rodada 140 — onboarding e perfis simples', () => {
  test('conta e perfil continuam conceitos separados', () => {
    expect(home).toContain('Agora escolha apenas a área que você realmente precisa')
    expect(login).toContain('continueWithoutProfile')
    expect(registerApi).toContain('link_existing')
    expect(registerApi).toContain('assertWebProfileType')
  })

  test('criação da conta prioriza Google sem remover cadastro por e-mail', () => {
    expect(login).toContain('Mais rápido')
    expect(login).toContain('Use sua conta Google e pule e-mail, senha e confirmação.')
    expect(login).toContain('<SocialLogin profileType={params.profileType} returnTo={params.returnTo} />')
    expect(login).toContain('ou crie com e-mail')
    expect(login).toContain('supabase.auth.signUp')
  })

  test('cadastro por e-mail sugere arroba a partir do nome e permite edição', () => {
    expect(login).toContain('function usernameSuggestion')
    expect(login).toContain('function updateDisplayName')
    expect(login).toContain('Seu @ no DropZone')
    expect(login).toContain('Sugerimos automaticamente pelo seu nome. Você pode alterar.')
  })

  test('foto deixa de ocupar o primeiro passo do cadastro por e-mail', () => {
    const simpleCreate = login.indexOf("emailMode === 'criar' ? (\n                    <div className=\"login-account-name-fields login-account-name-fields-simple\"")
    const uploadField = login.indexOf('label="Foto de perfil"')
    expect(simpleCreate).toBeGreaterThan(-1)
    expect(uploadField).toBeGreaterThan(-1)
    expect(styles).toContain('.login-account-name-fields-simple')
  })

  test('conta sem perfil recebe escolhas claras de jogador, equipe e produtora', () => {
    expect(home).toContain('Sua conta está pronta')
    expect(home).toContain('Sou jogador')
    expect(home).toContain('Tenho uma equipe')
    expect(home).toContain('Organizo campeonatos')
    expect(home).toContain("createProfileHref('jogador')")
    expect(home).toContain("createProfileHref('equipe')")
    expect(home).toContain("createProfileHref('produtora'")
  })

  test('afiliado fica como opção secundária e explorar continua possível sem perfil', () => {
    expect(home).toContain('Outras opções')
    expect(home).toContain('Sou afiliado')
    expect(home).toContain('Explorar campeonatos')
    expect(home).toContain('AINDA NÃO QUERO CADASTRAR PERFIL')
  })

  test('perfil vinculado agora mostra o arroba obrigatório que antes ficava invisível', () => {
    expect(dropzone).toContain('@usuário deste perfil')
    expect(dropzone).toContain('setUsername(cleanUsername(e.target.value)')
    expect(dropzone).toContain("profileType === 'equipe' && !registerData.tag.trim()")
    expect(dropzone).toContain("profileType === 'jogador' && !registerData.id_jogo.trim()")
  })

  test('foto logo e localização ficam em divulgação progressiva opcional', () => {
    expect(dropzone).toContain('className="profile-onboarding-optional"')
    expect(dropzone).toContain('Adicionar foto/logo e localização')
    expect(dropzone).toContain('<span>Opcional</span>')
    expect(styles).toContain('.profile-onboarding-optional-grid')
  })

  test('cancelar criação de perfil não encerra mais a conta inteira', () => {
    expect(dropzone).toContain('onClick={closeContextualRegistration}>Agora não</button>')
    expect(dropzone).not.toContain('onClick={signOut}>Usar outra conta</button>')
  })

  test('mobile mantém onboarding em uma coluna', () => {
    expect(homeStyles).toContain('.authenticated-home-onboarding-grid{grid-template-columns:1fr')
    expect(homeStyles).toContain('.authenticated-home-focus-onboarding{grid-template-columns:1fr}')
  })

  test('tela real de criar conta mostra caminho rápido e formulário simples', async ({ page }) => {
    await page.goto('/login?mode=criar&returnTo=%2F')
    await expect(page.getByRole('heading', { name: 'CRIE SUA CONTA', exact: true })).toBeVisible()
    await expect(page.getByText('Mais rápido')).toBeVisible()
    await expect(page.getByRole('button', { name: /Continuar com Google/i })).toBeVisible()
    await expect(page.getByText('Seu @ no DropZone')).toBeVisible()
    await expect(page.getByRole('button', { name: /Criar conta com e-mail/i })).toBeVisible()
    await expect(page.locator('body')).not.toHaveCSS('overflow-x', 'scroll')
  })
})
