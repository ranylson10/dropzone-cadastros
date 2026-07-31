import fs from 'node:fs';
import path from 'node:path';
import { ROOT, formatBytes, normalizePath, result, safeRead, walk } from '../lib/util.mjs';

const SOURCE_RESIDUE_NAMES = new Set(['.turbo', 'coverage', 'dist', 'build']);
const GENERATED_DIRS = new Set([
  '.git',
  '.next',
  'node_modules',
  'relatorios-testes',
  '.chrome-auth-profile',
  '.auth',
  'playwright-report',
  'playwright-resultados',
]);

function findSourceResidues(dir, found = []) {
  if (!fs.existsSync(dir)) return found;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || GENERATED_DIRS.has(entry.name)) continue;

    const full = path.join(dir, entry.name);
    if (SOURCE_RESIDUE_NAMES.has(entry.name)) {
      found.push(full);
      continue;
    }

    findSourceResidues(full, found);
  }

  return found;
}

function gitignoreCovers(pattern) {
  const gitignore = safeRead(path.join(ROOT, '.gitignore'));
  return gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) =>
      line === pattern ||
      line === `/${pattern}` ||
      line === `${pattern}/` ||
      line === `**/${pattern}/`,
    );
}

export async function executar() {
  const out = [];

  const generatedCoverage = [
    ['node_modules', gitignoreCovers('node_modules')],
    ['.next', gitignoreCovers('.next')],
    ['tests-e2e/.chrome-auth-profile', gitignoreCovers('tests-e2e/.chrome-auth-profile')],
    ['tests-e2e/.auth', gitignoreCovers('tests-e2e/.auth')],
    ['relatorios-testes', gitignoreCovers('relatorios-testes')],
  ];

  const uncoveredGenerated = generatedCoverage.filter(([, covered]) => !covered);
  if (uncoveredGenerated.length === 0) {
    out.push(result(
      'OK',
      'Estrutura',
      'Artefatos gerados protegidos',
      'Dependências, builds, perfis temporários do navegador, sessões E2E e relatórios estão excluídos do Git e da varredura de arquivos-fonte.',
    ));
  } else {
    uncoveredGenerated.forEach(([name]) =>
      out.push(result(
        'AVISO',
        'Estrutura',
        `Artefato gerado sem proteção: ${name}`,
        'O diretório pode deixar entregas e commits muito pesados.',
        `Adicione ${name}/ ao .gitignore.`,
      )),
    );
  }

  const residues = findSourceResidues(ROOT);
  if (residues.length === 0) {
    out.push(result(
      'OK',
      'Estrutura',
      'Resíduos de fonte',
      'Nenhuma pasta de cobertura, distribuição ou build manual foi encontrada fora dos diretórios gerados esperados.',
    ));
  } else {
    residues.forEach((dir) =>
      out.push(result(
        'AVISO',
        'Estrutura',
        `Resíduo de fonte: ${normalizePath(path.relative(ROOT, dir))}`,
        'A pasta pode tornar ZIPs, buscas e cópias muito pesados.',
        'Confirme se é artefato necessário; caso contrário, remova antes de entregar.',
      )),
    );
  }

  const files = walk(ROOT, {
    ignored: [...GENERATED_DIRS],
  });

  const large = files
    .map((file) => ({ file, size: fs.statSync(file).size }))
    .filter((item) => item.size >= 5 * 1024 * 1024)
    .sort((a, b) => b.size - a.size);

  if (large.length === 0) {
    out.push(result(
      'OK',
      'Estrutura',
      'Arquivos-fonte grandes',
      'Nenhum arquivo-fonte acima de 5 MB foi encontrado.',
    ));
  } else {
    large.slice(0, 20).forEach(({ file, size }) =>
      out.push(result(
        'AVISO',
        'Estrutura',
        `Arquivo-fonte grande: ${normalizePath(path.relative(ROOT, file))}`,
        formatBytes(size),
        'Confirme se o arquivo precisa estar no repositório ou mova-o para Storage.',
      )),
    );
  }

  out.push(result(
    'OK',
    'Estrutura',
    'Rotas de debug delegadas',
    'A presença e a proteção das rotas /api/debug são verificadas exclusivamente pelo módulo específico de segurança, evitando avisos duplicados.',
  ));

  return out;
}
