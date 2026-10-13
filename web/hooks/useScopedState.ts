'use client'
import {useRef,useState,type Dispatch,type SetStateAction} from 'react'
/** Hides a previous account/resource snapshot synchronously, including late responses. */
export function useScopedState<T>(scope:string,initial:T):[T,Dispatch<SetStateAction<T>>] {
  const [snapshot,setSnapshot]=useState({scope,value:initial})
  const currentScope=useRef(scope);currentScope.current=scope
  const value=snapshot.scope===scope?snapshot.value:initial
  return [value,next=>{if(currentScope.current!==scope)return;setSnapshot(previous=>currentScope.current!==scope?previous:{scope,value:typeof next==='function'
    ?(next as (value:T)=>T)(previous.scope===scope?previous.value:initial):next})}]
}
