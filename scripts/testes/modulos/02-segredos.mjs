import fs from 'node:fs';
import path from 'node:path';
import { ROOT, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const ENV_FILES = /(^|\/)(\.env(?:\..+)?|[^/]+\.env(?:\..+)?)$/i;
const SENSITIVE_NAMES = /(SERVICE_ROLE|CLIENT_SECRET|API_KEY|WEBHOOK_TOKEN|AUTH_CODE_SECRET|PRIVATE_KEY|PASSWORD|SECRET)/i;
const PUBLIC_SENSITIVE = /NEXT_PUBLIC_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|API_KEY|WEBHOOK)/i;
const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.sql', '.md', '.yml', '.yaml']);

function isEnvironmentExample(relative) {
  const name = path.posix.basename(relative).toLowerCase();
  return name === '.env.example' || (name.startsWith('.env.') && name.endsWith('.example'));
}

function gitignoreLines() {
  return safeRead(path.join(ROOT, '.gitignore'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function isIgnored(relative, lines) {
  const normalized = normalizePath(relative);
  const basename = path.posix.basename(normalized);

  return lines.some((line) => {
    const clean = line.replace(/^\/+/, '').replace(/\/+$/, '');
    if (!clean || clean.startsWith('!')) return false;

    if (clean === normalized || clean === basename) return true;
    if (clean === '.env.*' && basename.startsWith('.env.')) return true;
    if (clean === 'web/.env.*' && normalized.startsWith('web/.env.')) return true;
    return false;
  });
}

export async function executar() {
  const out = [];
  const files = walk(ROOT, {
    ignored: [
      '.git',
      '.next',
      'node_modules',
      'relatorios-testes',
      '.chrome-auth-profile',
      '.auth',
      'playwright-report',
      'playwright-resultados',
    ],
  });

  const ignoreLines = gitignoreLines();
  const envFiles = files.filter((file) =>
    ENV_FILES.test(normalizePath(path.relative(ROOT, file))),
  );

  for (const file of envFiles) {
    const relative = normalizePath(path.relative(ROOT, file));
    const example = isEnvironmentExample(relative);
    const protectedByGitignore = isIgnored(relative, ignoreLines);

    if (example) {
      out.push(result(
        'OK',
        'Segredos',
        `Arquivo de ambiente: ${relative}`,
        'Arquivo de exemplo permitido; valores reais não foram lidos nem exibidos.',
      ));
      continue;
    }

    out.push(result(
      protectedByGitignore ? 'OK' : 'AVISO',
      'Segredos',
      `Arquivo de ambiente local: ${relative}`,
      protectedByGitignore
        ? 'Arquivo local protegido pelo .gitignore; o conteúdo não foi lido nem exibido.'
        : 'Arquivo sensível presente sem proteção confirmada no .gitignore.',
      protectedByGitignore
        ? ''
        : 'Adicione o caminho ao .gitignore e nunca envie o arquivo em ZIP.',
    ));
  }

  for (const pattern of [
    '.env.local',
    'web/.env.local',
    'node_modules',
    '.next',
    'tests-e2e/.chrome-auth-profile',
    'tests-e2e/.auth',
  ]) {
    const covered = isIgnored(pattern, ignoreLines);

    out.push(result(
      covered ? 'OK' : 'ERRO',
      'Segredos',
      `.gitignore protege ${pattern}`,
      covered ? 'Proteção encontrada.' : 'Proteção ausente.',
      covered ? '' : `Adicione ${pattern} ao .gitignore.`,
    ));
  }

  const findings = [];
  for (const file of files) {
    if (!SOURCE_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    if (ENV_FILES.test(normalizePath(file))) continue;

    const text = safeRead(file);
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      const publicMatch = line.match(PUBLIC_SENSITIVE);
      if (publicMatch) {
        findings.push({
          file,
          line: index + 1,
          kind: `variável pública sensível: ${publicMatch[0]}`,
        });
      }

      const assignment = line.match(/\b([A-Z][A-Z0-9_]{4,})\s*[:=]\s*['"]([^'"]{16,})['"]/);
      if (assignment && SENSITIVE_NAMES.test(assignment[1])) {
        findings.push({
          file,
          line: index + 1,
          kind: `possível segredo fixo em ${assignment[1]}`,
        });
      }
    });
  }

  if (findings.length === 0) {
    out.push(result(
      'OK',
      'Segredos',
      'Segredos fixos no código',
      'Nenhum padrão crítico encontrado. Valores de arquivos .env não foram exibidos.',
    ));
  } else {
    for (const finding of findings.slice(0, 25)) {
      out.push(result(
        'ERRO',
        'Segredos',
        finding.kind,
        `${normalizePath(path.relative(ROOT, finding.file))}:${finding.line}`,
        'Remova o valor do código, rotacione a chave e use variável de ambiente.',
      ));
    }

    if (findings.length > 25) {
      out.push(result(
        'AVISO',
        'Segredos',
        'Resultados adicionais omitidos',
        `${findings.length - 25} ocorrência(s) adicionais.`,
        'Revise o relatório JSON para detalhes.',
      ));
    }
  }

  return out;
}
