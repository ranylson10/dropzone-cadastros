import {operationJson,operationUuid} from '../shared/operation-json'
export type EditionReadContract={edition_write_mode?:unknown;edition_actor_id?:unknown}
export type EditionIntent={action:'save_edition';franchise_id:string|null;source_championship_id:string|null;franchise_name:string;edition_number:number|null;season:string|null;public_title:string|null;expected:{edition:Record<string,any>|null;franchise:Record<string,any>|null;source:{campeonato_id:string;edition:Record<string,any>|null}|null};franchise_description?:string|null;franchise_status?:string;edition_status?:string}
const text=(value:unknown,max:number,nullable=false)=>{if(value==null&&nullable)return null;if(typeof value!=='string'||value.length>max)throw new Error('Campos da edição inválidos.');const result=value.trim();if(!result&&!nullable)throw new Error('Informe o nome histórico.');return result||null}
const timestamp=(value:unknown)=>{if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))throw new Error('Atualize a edição antes de confirmar.');return value}
const observedText=(value:unknown,max:number,nullable=false)=>{if(value===null&&nullable)return null;if(typeof value!=='string'||value.length>max)throw new Error('Snapshot da edição inválido.');return value}
export function editionProjection(value:Record<string,any>|null,franchise=false):Record<string,any>|null{
 if(value===null)return null;if(!value||Array.isArray(value))throw new Error('Atualize a edição antes de confirmar.')
 const base={id:operationUuid(value.id),updated_at:timestamp(value.updated_at)}
 if(franchise)return{...base,nome:observedText(value.nome,180),descricao:observedText(value.descricao,1200,true),status:observedText(value.status,20),criado_por:value.criado_por==null?null:operationUuid(value.criado_por)}
 const number=value.numero_edicao;if(number!=null&&(!Number.isInteger(number)||number<1||number>2147483647))throw new Error('Número da edição inválido.')
 return{...base,franquia_id:operationUuid(value.franquia_id),campeonato_id:operationUuid(value.campeonato_id),numero_edicao:number??null,temporada:observedText(value.temporada,80,true),titulo_publico:observedText(value.titulo_publico,180,true),status:observedText(value.status,20)}
}
export function editionIntent(value:Record<string,any>):EditionIntent{
 if(value?.action!=='save_edition'||!value.expected||!Object.hasOwn(value.expected,'edition')||!Object.hasOwn(value,'edition_number')||!Object.hasOwn(value,'season')||!Object.hasOwn(value,'public_title'))throw new Error('Atualize a edição antes de confirmar.')
 const raw=value.edition_number,number=raw===''||raw==null?null:typeof raw==='number'?raw:typeof raw==='string'&&/^\d+$/.test(raw.trim())?Number(raw):NaN
 if(number!=null&&(!Number.isInteger(number)||number<1||number>2147483647))throw new Error('Número da edição inválido.')
 const expected={edition:editionProjection(value.expected.edition),franchise:editionProjection(value.expected.franchise??null,true),source:value.expected.source?{campeonato_id:operationUuid(value.expected.source.campeonato_id),edition:editionProjection(value.expected.source.edition)}:null}
 const intent:EditionIntent={action:'save_edition',franchise_id:value.franchise_id?operationUuid(value.franchise_id):null,source_championship_id:value.source_championship_id?operationUuid(value.source_championship_id):null,franchise_name:text(value.franchise_name,180)!,edition_number:number,season:text(value.season,80,true),public_title:text(value.public_title,180,true),expected}
 if(expected.franchise&&value.franchise_name===expected.franchise.nome)intent.franchise_name=expected.franchise.nome
 if(intent.source_championship_id!==(expected.source?.campeonato_id??null)||expected.source?.edition&&expected.source.edition.campeonato_id!==expected.source.campeonato_id)throw new Error('Origem da edição incompatível.')
 for(const key of ['franchise_description','franchise_status','edition_status'] as const)if(Object.hasOwn(value,key)){
  const result=text(value[key],key==='franchise_description'?1200:20,key==='franchise_description')
  if(key!=='franchise_description'&&!(key==='franchise_status'?['ativo','inativo','arquivado']:['planejada','ativa','encerrada','cancelada','arquivada']).includes(result!))throw new Error('Status de edição inválido.')
  Object.assign(intent,{[key]:result})
 }
 return JSON.parse(operationJson(intent))
}
export function assertEditionResponse(value:any,actor:string,champ:string,key:string,intent:EditionIntent){
 if(value?.ok!==true||value.operation_confirmed!==true||value.actor_id!==actor||value.campeonato_id!==champ||value.request_id!==key||value.edition_action!=='save')throw new Error('Não foi possível confirmar a edição. Confira o histórico e repita a tentativa original.')
 const edition=editionProjection(value.edition),franchise=editionProjection(value.franchise,true)
 if(!edition||!franchise||edition.campeonato_id!==champ||edition.franquia_id!==franchise.id||intent.franchise_id&&franchise.id!==intent.franchise_id||edition.numero_edicao!==intent.edition_number||edition.temporada!==intent.season||edition.titulo_publico!==intent.public_title||franchise.nome!==intent.franchise_name)throw new Error('Não foi possível confirmar a edição. Confira o histórico e repita a tentativa original.')
 const status=intent.edition_status??intent.expected.edition?.status??'planejada'
 if(edition.status!==status||Object.hasOwn(intent,'franchise_description')&&franchise.descricao!==intent.franchise_description||intent.franchise_status&&franchise.status!==intent.franchise_status)throw new Error('Não foi possível confirmar a edição. Confira o histórico e repita a tentativa original.')
 const newFranchise=!intent.expected.edition&&!intent.expected.franchise&&!intent.expected.source?.edition&&!intent.franchise_id
 if(newFranchise&&(franchise.criado_por!==actor||franchise.descricao!==(intent.franchise_description??null)||franchise.status!==(intent.franchise_status??'ativo')))throw new Error('Não foi possível confirmar a edição. Confira o histórico e repita a tentativa original.')
}
