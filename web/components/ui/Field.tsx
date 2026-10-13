'use client'

import {
  Children,
  cloneElement,
  createContext,
  forwardRef,
  isValidElement,
  useContext,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

type FieldAssociation = { labelId?: string; descriptionId?: string; invalid?: boolean; required?: boolean }
const FieldContext = createContext<FieldAssociation>({})

function useFieldAssociation(props: { 'aria-label'?: string; 'aria-labelledby'?: string; 'aria-describedby'?: string; 'aria-invalid'?: InputHTMLAttributes<HTMLInputElement>['aria-invalid']; 'aria-required'?: boolean | 'true' | 'false' }) {
  const field = useContext(FieldContext)
  const descriptions = [...new Set([props['aria-describedby'], field.descriptionId].filter(Boolean).join(' ').split(/\s+/).filter(Boolean))].join(' ')
  return {
    'aria-labelledby': props['aria-labelledby'] || (!props['aria-label'] ? field.labelId : undefined),
    'aria-describedby': descriptions || undefined,
    'aria-invalid': props['aria-invalid'] ?? (field.invalid || undefined),
    'aria-required': props['aria-required'] ?? (field.required || undefined),
  }
}

export type FieldProps = {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  className?: string
  htmlFor?: string
  required?: boolean
}

export function Field({
  label,
  hint,
  error,
  children,
  className = '',
  htmlFor,
  required = false,
}: FieldProps) {
  const generatedId = useId()
  const labelId = `${generatedId}-label`, descriptionId = `${generatedId}-description`
  const child = Children.count(children) === 1 ? Children.toArray(children)[0] : null
  const singleControl = isValidElement<{id?: string}>(child) && [Input, Select, Textarea].includes(child.type as typeof Input)
  const controlId = htmlFor || (singleControl ? child.props.id || `${generatedId}-control` : undefined)
  const content = singleControl && !child.props.id ? cloneElement(child, {id:controlId}) : children
  const classes = [
    'field',
    'dz-ui-field',
    error ? 'dz-ui-field--error' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} data-dz-field="true">
      {label ? (
        <label id={labelId} className="dz-ui-field__label" htmlFor={controlId}>
          {label}
          {required ? <span className="dz-ui-field__required" aria-hidden="true"> *</span> : null}
        </label>
      ) : null}
      <FieldContext.Provider value={{labelId:label ? labelId : undefined,descriptionId:error || hint ? descriptionId : undefined,invalid:!!error,required}}>
        <div className="dz-ui-field__control">{content}</div>
      </FieldContext.Provider>
      {error ? (
        <span id={descriptionId} className="dz-ui-field__error" role="alert">{error}</span>
      ) : hint ? (
        <span id={descriptionId} className="dz-ui-field__hint">{hint}</span>
      ) : null}
    </div>
  )
}

const UNSTYLED_INPUT_TYPES = new Set(['checkbox', 'radio', 'file', 'color', 'range', 'hidden'])

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className = '', type = 'text', ...props },
  ref,
) {
  const association = useFieldAssociation(props)
  const normalizedType = String(type || 'text').toLowerCase()
  const isNativeControl = UNSTYLED_INPUT_TYPES.has(normalizedType)
  const classes = [
    isNativeControl ? 'dz-ui-native-control' : 'dz-ui-control',
    isNativeControl ? `dz-ui-native-control--${normalizedType}` : 'dz-ui-input',
    className,
  ].filter(Boolean).join(' ')

  return (
    <input
      ref={ref}
      type={type}
      className={classes}
      data-dz-control="input"
      data-dz-control-type={normalizedType}
      {...props}
      {...association}
    />
  )
})

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className = '', children, ...props },
  ref,
) {
  const association = useFieldAssociation(props)
  return (
    <select
      ref={ref}
      className={['dz-ui-control', 'dz-ui-select', className].filter(Boolean).join(' ')}
      data-dz-control="select"
      {...props}
      {...association}
    >
      {children}
    </select>
  )
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea(
  { className = '', ...props },
  ref,
) {
  const association = useFieldAssociation(props)
  return (
    <textarea
      ref={ref}
      className={['dz-ui-control', 'dz-ui-textarea', className].filter(Boolean).join(' ')}
      data-dz-control="textarea"
      {...props}
      {...association}
    />
  )
})
