import fs from 'node:fs';
import path from 'node:path';
import { ROOT, result, runCommand, safeRead } from '../lib/util.mjs';

export async function executar() {
  const out = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  out.push(result(nodeMajor >= 20 ? 'OK' : 'ERRO', 'Ambiente', `Node.js ${process.versions.node}`, nodeMajor >= 20 ? 'Versão compatível com o projeto.' : 'O projeto exige Node.js 20 ou superior.', nodeMajor >= 20 ? '' : 'Instale Node.js 20 LTS ou superior.'));

  for (const relative of ['package.json', 'package-lock.json', 'web/package.json', 'web/tsconfig.json']) {
    const exists = fs.existsSync(path.join(ROOT, relative));
    out.push(result(exists ? 'OK' : 'ERRO', 'Ambiente', `Arquivo obrigatório: ${relative}`, exists ? 'Encontrado.' : 'Ausente.', exists ? '' : 'Restaure o arquivo antes de continuar.'));
  }

  const rootPackage = JSON.parse(safeRead(path.join(ROOT, 'package.json')) || '{}');
  const webPackage = JSON.parse(safeRead(path.join(ROOT, 'web/package.json')) || '{}');
  out.push(result(rootPackage.workspaces?.includes('web') ? 'OK' : 'ERRO', 'Ambiente', 'Workspace web configurado', rootPackage.workspaces?.includes('web') ? 'O workspace dropzone-web está ligado à raiz.' : 'O workspace web não está configurado corretamente.'));
  out.push(result(webPackage.scripts?.lint === webPackage.scripts?.typecheck ? 'AVISO' : 'OK', 'Qualidade', 'Lint separado do TypeScript', webPackage.scripts?.lint === webPackage.scripts?.typecheck ? 'Atualmente lint e typecheck executam o mesmo comando.' : 'Comandos separados.', webPackage.scripts?.lint === webPackage.scripts?.typecheck ? 'Adicionar ESLint real em uma rodada futura.' : ''));

  const npmCheck = runCommand('npm', ['--version']);
  out.push(result(npmCheck.code === 0 ? 'OK' : 'ERRO', 'Ambiente', 'npm disponível', npmCheck.code === 0 ? `npm ${npmCheck.stdout.trim()}` : npmCheck.stderr.trim(), npmCheck.code === 0 ? '' : 'Reinstale o Node.js/npm.'));
  return out;
}
