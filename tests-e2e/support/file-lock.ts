import fs from 'node:fs'

type LockPayload = {
  pid: number
  createdAt: number
}

function processIsAlive(pid: number) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function lockIsStale(lockFile: string, staleMs: number) {
  try {
    const stat = fs.statSync(lockFile)
    const age = Date.now() - stat.mtimeMs
    if (age > staleMs) return true

    const raw = fs.readFileSync(lockFile, 'utf8').trim()
    if (!raw) return true

    const payload = JSON.parse(raw) as Partial<LockPayload>
    if (!processIsAlive(Number(payload.pid))) return true
    return false
  } catch {
    return true
  }
}

export async function acquireFileLock(
  lockFile: string,
  label: string,
  timeoutMs = 360_000,
  staleMs = 600_000,
) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const fd = fs.openSync(lockFile, 'wx')
      const payload: LockPayload = { pid: process.pid, createdAt: Date.now() }
      fs.writeFileSync(fd, JSON.stringify(payload))
      fs.closeSync(fd)
      return
    } catch (error: any) {
      if (error?.code !== 'EEXIST') throw error

      if (lockIsStale(lockFile, staleMs)) {
        try {
          fs.unlinkSync(lockFile)
          continue
        } catch {
          // Outro worker pode ter removido ou recriado o lock.
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }

  throw new Error(`Timeout aguardando o lock do teste de ${label}.`)
}

export function releaseFileLock(lockFile: string) {
  try {
    fs.unlinkSync(lockFile)
  } catch {
    // Lock já removido por outro worker ou pela limpeza de segurança.
  }
}
