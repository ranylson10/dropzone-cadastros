import {StrictMode,useState} from 'react'
import {Dialog} from '../../web/components/ui/Dialog'
import {StreamSpreadsheetPanel} from '../../web/features/campeonatos/stream/components/StreamSpreadsheetPanel'
import {UploadField} from '../../web/features/dropzone/components/form-fields'
export function DialogFixture(){
 const [outer,setOuter]=useState(false),[inner,setInner]=useState(false),[empty,setEmpty]=useState(false),[inline,setInline]=useState(false),[strict,setStrict]=useState(false)
 Object.assign(window,{closeOuter:()=>setOuter(false),closeInner:()=>setInner(false),openOuter:()=>setOuter(true),openInner:()=>setInner(true),unmountOuter:()=>setOuter(false),showInline:()=>setInline(true)})
 return <><button id="launcher" onClick={()=>setOuter(true)}>Abrir principal</button><button id="background">Ação de fundo</button><button onClick={()=>setEmpty(true)}>Abrir vazio</button><button id="strict-launcher" onClick={()=>setStrict(true)}>Abrir StrictMode</button>
 <Dialog open={outer} title="Principal" description="Descrição da janela principal" onClose={()=>setOuter(false)}>
  <input data-autofocus hidden aria-label="Oculto"/><fieldset disabled><input aria-label="Desativado"/></fieldset><input data-autofocus aria-label="Primeiro campo"/>
  <button onClick={()=>setInner(true)}>Abrir secundário</button><a href="#fixture" tabIndex={-2}>Link fora da sequência</a><button id="last">Último principal</button><div tabIndex={-2}>Texto fora da sequência</div>
  <UploadField label="Imagem local" value="" bucket="campeonato" onChange={()=>{}} onUpload={async()=>{throw Error('Fixture does not upload')}}/>
 </Dialog>
 <Dialog open={inner} title="Secundário" onClose={()=>setInner(false)}><input aria-label="Campo secundário"/><button>Último secundário</button></Dialog>
 <Dialog open={empty} title="Sem controles disponíveis" onClose={()=>setEmpty(false)}><p>Conteúdo informativo.</p></Dialog>
 {strict?<StrictMode><Dialog open title="StrictMode" onClose={()=>setStrict(false)}><input aria-label="Campo StrictMode"/></Dialog></StrictMode>:null}
 <StreamSpreadsheetPanel campeonatoId="00000000-0000-4000-8000-000000000020"/>
 {inline?<StreamSpreadsheetPanel campeonatoId="00000000-0000-4000-8000-000000000020" asModal={false}/>:null}
 </>
}
