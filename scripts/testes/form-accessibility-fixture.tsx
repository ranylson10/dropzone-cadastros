import {useState} from 'react'
import {Field,Input,Select,Textarea} from '../../web/components/ui/Field'
import {Dialog} from '../../web/components/ui/Dialog'
import {LocationSearch} from '../../web/features/dropzone/components/form-fields'
import {PlayerRegistrationForm} from '../../web/components/dropzone/forms/PlayerRegistrationForm'
export function FormAccessibilityFixture(){
 const [error,setError]=useState(false),[dialog,setDialog]=useState(false),[location,setLocation]=useState({pais:'',estado:'',cidade:''}),[selected,setSelected]=useState(''),[player,setPlayer]=useState({nick:'',foto_url:'',id_jogo:'',funcao:'',localidade:'',senha:''})
 Object.assign(window,{fieldError:setError,locationValue:setLocation})
 return <><button onClick={()=>setError(!error)}>Alternar erro</button><span id="custom-help">Ajuda externa</span><span id="custom-name">Nome externo</span>
 <Field label="Nome" hint="Use seu nome público" error={error?'Nome inválido':undefined} required><Input aria-describedby="custom-help"/></Field>
 <Field label="Escolha" hint="Selecione uma opção"><Select><option>A</option><option>B</option></Select></Field>
 <Field label="Descrição" error="Descrição inválida"><Textarea/></Field>
 <Field label="Visual" hint="Dica visual"><Input aria-label="Nome explícito"/></Field>
 <Field label="Visual externo"><Input aria-labelledby="custom-name"/></Field>
 <Field label="ID preservado" htmlFor="existing-id"><Input id="existing-id"/></Field>
 <Field label="Aninhado" hint="Dica aninhada"><div><Input/><span>Decoração</span></div></Field>
 <Field label="Grupo"><div><Input data-testid="group-a"/><Input data-testid="group-b"/></div></Field>
 <Field label="Externo"><div><Field label="Interno"><Input/></Field></div></Field>
 <Field label="Sem validação nativa" required><Input aria-invalid={false} aria-required={false}/></Field>
 <Field label="Checkbox"><Input type="checkbox"/></Field>
 <Input aria-label="Fora do campo"/>
 <LocationSearch label="Localidade teste" value={location} onSelect={value=>{setLocation(value);setSelected(value.cidade)}}/>
 <button id="after-location">Depois da localidade</button><output>{selected?'Selecionado: '+selected:''}</output>
 <button onClick={()=>setDialog(true)}>Abrir busca no diálogo</button>
 <Dialog open={dialog} title="Busca no formulário" onClose={()=>setDialog(false)}><LocationSearch label="Localidade no diálogo" value={location} onSelect={setLocation}/></Dialog>
 <section aria-label="Cadastro de jogador real"><PlayerRegistrationForm player={player} setPlayer={setPlayer} uploadPublicFile={async()=>{throw Error('No upload in fixture')}}/></section>
 </>
}
