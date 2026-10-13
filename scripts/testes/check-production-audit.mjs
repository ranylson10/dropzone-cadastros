import {runCommand} from './lib/util.mjs'
const offline=runCommand('npm',['config','get','offline'])
if(offline.code!==0||offline.stdout.trim()!=='false'){
 console.error('Audit de produção não verificado: npm está offline ou sua configuração não pôde ser lida. Um resultado zero nesse modo não confirma ausência de advisories. Consulte online somente quando autorizado.')
 process.exit(2)
}
// This guard is strictly read-only: the actual audit is a separate, explicit command.
console.error('Audit de produção não verificado: esta guarda não consulta o registro. A consulta online da raiz permanece uma etapa manual que exige autorização; a validação de código é check:code.')
process.exit(2)
