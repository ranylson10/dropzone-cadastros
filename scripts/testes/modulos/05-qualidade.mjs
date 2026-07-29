import { result, runCommand } from '../lib/util.mjs';

export async function executar({ full = false } = {}) {
  const out = [];
  const typecheck = runCommand('npm', ['run', 'typecheck']);
  out.push(result(typecheck.code === 0 ? 'OK' : 'ERRO', 'Qualidade', 'TypeScript', typecheck.code === 0 ? `Concluído em ${(typecheck.durationMs/1000).toFixed(1)}s.` : `${typecheck.stderr || typecheck.stdout}`.slice(-4000), typecheck.code === 0 ? '' : 'Corrija os erros antes de publicar.'));

  if (!full) {
    out.push(result('AVISO', 'Qualidade', 'Build completo não executado', 'Modo rápido ativo.', 'Execute TESTAR_DROPZONE.bat completo antes de deploy.'));
    return out;
  }
  const build = runCommand('npm', ['run', 'build']);
  out.push(result(build.code === 0 ? 'OK' : 'ERRO', 'Qualidade', 'Build de produção', build.code === 0 ? `Concluído em ${(build.durationMs/1000).toFixed(1)}s.` : `${build.stderr || build.stdout}`.slice(-6000), build.code === 0 ? '' : 'Não publique enquanto o build falhar.'));
  return out;
}
