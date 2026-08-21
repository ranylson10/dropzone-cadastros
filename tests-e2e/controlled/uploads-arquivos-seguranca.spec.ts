import { test, expect, type APIRequestContext } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { activeAuthToken } from '../support/auth-session'

const produtoraAuthFile = path.resolve('tests-e2e/.auth/produtora.json')
const equipeAuthFile = path.resolve('tests-e2e/.auth/equipe.json')

type StorageState = {
  origins?: Array<{
    origin?: string
    localStorage?: Array<{ name?: string; value?: string }>
  }>
}

function headers(token: string, profileType: string) {
  return {
    Authorization: `Bearer ${token}`,
    'x-profile-type': profileType,
    'Content-Type': 'application/json',
  }
}

async function json(response: Awaited<ReturnType<APIRequestContext['post']>>) {
  return response.json().catch(() => null)
}

test.describe('Uploads e arquivos — formatos, limites e permissões', () => {
  test.setTimeout(150_000)

  test('upload direto e assinado bloqueiam abuso sem criar arquivos reais', async ({ request, browser, baseURL }) => {
    test.skip(
      ![produtoraAuthFile, equipeAuthFile].every(fs.existsSync),
      'As sessões são geradas automaticamente por npm run testar:tudo.',
    )

    const origin = new URL(baseURL || 'http://localhost:3000').origin
    const produtoraToken = await activeAuthToken(browser, produtoraAuthFile, '/campeonatos')
    const equipeToken = await activeAuthToken(browser, equipeAuthFile, '/equipes')

    const unauthenticated = await request.post(`${origin}/api/upload/signed`, {
      data: {
        bucket: 'produtora',
        file_name: 'logo.png',
        content_type: 'image/png',
        size: 1024,
      },
      timeout: 30_000,
    })
    expect(unauthenticated.ok(), 'Upload assinado sem login deve ser bloqueado.').toBe(false)

    const invalidBucket = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'bucket-inexistente',
        file_name: 'arquivo.png',
        content_type: 'image/png',
        size: 1024,
      },
      timeout: 30_000,
    })
    const invalidBucketBody = await json(invalidBucket)
    expect(invalidBucket.status(), 'Bucket inválido deve retornar 400.').toBe(400)
    expect(String(invalidBucketBody?.error || '')).toContain('Bucket invalido')

    const unsupportedFormat = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'documento.exe',
        content_type: 'application/octet-stream',
        size: 1024,
      },
      timeout: 30_000,
    })
    expect(unsupportedFormat.status(), 'Formato não suportado deve retornar 400.').toBe(400)

    const oversizedImage = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'imagem.png',
        content_type: 'image/png',
        size: 5 * 1024 * 1024 + 1,
      },
      timeout: 30_000,
    })
    const oversizedImageBody = await json(oversizedImage)
    expect(oversizedImage.status(), 'Imagem acima de 5 MB deve retornar 400.').toBe(400)
    expect(String(oversizedImageBody?.error || '')).toContain('5 MB')

    const videoWrongBucket = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'fundo.mp4',
        content_type: 'video/mp4',
        size: 1024,
      },
      timeout: 30_000,
    })
    expect(videoWrongBucket.status(), 'Vídeo fora do bucket campeonato deve retornar 400.').toBe(400)

    const profileEscalation = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(equipeToken, 'equipe'),
      data: {
        bucket: 'produtora',
        file_name: 'tentativa.png',
        content_type: 'image/png',
        size: 1024,
      },
      timeout: 30_000,
    })
    expect(profileEscalation.ok(), 'Equipe não pode enviar arquivo no perfil da produtora.').toBe(false)

    const championshipWithoutId = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'campeonato',
        file_name: 'banner.png',
        content_type: 'image/png',
        size: 1024,
      },
      timeout: 30_000,
    })
    expect(championshipWithoutId.status(), 'Upload de campeonato sem ID/intenção deve retornar 400.').toBe(400)

    const validSigned = await request.post(`${origin}/api/upload/signed`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'Logo da Produtora TESTE.png',
        content_type: 'image/png',
        size: 1024,
      },
      timeout: 30_000,
    })
    const validSignedBody = await json(validSigned)
    expect(
      validSigned.ok(),
      `Falha ao gerar URL assinada segura: ${validSignedBody?.error || validSigned.status()}`,
    ).toBe(true)
    expect(typeof validSignedBody?.signed_url).toBe('string')
    expect(typeof validSignedBody?.token).toBe('string')
    expect(String(validSignedBody?.path || '')).toMatch(/logo-da-produtora-teste\.png$/)
    expect(validSignedBody?.bucket).toBe('produtora')
    expect(validSignedBody?.content_type).toBe('image/png')
    expect(validSignedBody?.kind).toBe('image')
    expect(typeof validSignedBody?.public_url).toBe('string')

    const emptyDirect = await request.post(`${origin}/api/upload`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'vazio.png',
        content_type: 'image/png',
        base64: '',
      },
      timeout: 30_000,
    })
    expect(emptyDirect.status(), 'Upload direto vazio deve retornar 400.').toBe(400)

    const fakePng = await request.post(`${origin}/api/upload`, {
      headers: headers(produtoraToken, 'produtora'),
      data: {
        bucket: 'produtora',
        file_name: 'falso.png',
        content_type: 'image/png',
        base64: Buffer.from('isto nao e png').toString('base64'),
      },
      timeout: 30_000,
    })
    const fakePngBody = await json(fakePng)
    expect(fakePng.status(), 'Conteúdo que não possui assinatura PNG deve retornar 400.').toBe(400)
    expect(String(fakePngBody?.error || '')).toContain('Imagem invalida')
  })
})
