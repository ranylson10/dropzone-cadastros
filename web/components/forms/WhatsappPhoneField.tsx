'use client'

import { useEffect, useMemo, useState } from 'react'

export const WHATSAPP_PHONE_COUNTRIES = [
  { code: 'BR', name: 'Brasil', flag: '🇧🇷', dial: '55', example: '(11) 99999-9999' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', dial: '351', example: '912 345 678' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸', dial: '1', example: '(202) 555-0123' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', dial: '54', example: '11 2345-6789' },
  { code: 'PY', name: 'Paraguai', flag: '🇵🇾', dial: '595', example: '981 123456' },
  { code: 'UY', name: 'Uruguai', flag: '🇺🇾', dial: '598', example: '94 123 456' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', dial: '56', example: '9 1234 5678' },
  { code: 'CO', name: 'Colômbia', flag: '🇨🇴', dial: '57', example: '300 123 4567' },
  { code: 'PE', name: 'Peru', flag: '🇵🇪', dial: '51', example: '912 345 678' },
  { code: 'BO', name: 'Bolívia', flag: '🇧🇴', dial: '591', example: '71234567' },
  { code: 'MX', name: 'México', flag: '🇲🇽', dial: '52', example: '55 1234 5678' },
  { code: 'EC', name: 'Equador', flag: '🇪🇨', dial: '593', example: '99 123 4567' },
  { code: 'VE', name: 'Venezuela', flag: '🇻🇪', dial: '58', example: '412 1234567' },
  { code: 'ES', name: 'Espanha', flag: '🇪🇸', dial: '34', example: '612 345 678' },
  { code: 'FR', name: 'França', flag: '🇫🇷', dial: '33', example: '6 12 34 56 78' },
  { code: 'DE', name: 'Alemanha', flag: '🇩🇪', dial: '49', example: '1512 3456789' },
  { code: 'IT', name: 'Itália', flag: '🇮🇹', dial: '39', example: '312 345 6789' },
  { code: 'GB', name: 'Reino Unido', flag: '🇬🇧', dial: '44', example: '7700 900123' },
] as const

type Country = (typeof WHATSAPP_PHONE_COUNTRIES)[number]

function digits(value: string) { return String(value || '').replace(/\D/g, '') }

function resolveValue(value: string) {
  const raw = digits(value)
  const country = [...WHATSAPP_PHONE_COUNTRIES]
    .sort((a, b) => b.dial.length - a.dial.length)
    .find((item) => raw.startsWith(item.dial)) || WHATSAPP_PHONE_COUNTRIES[0]
  return { country, local: raw.startsWith(country.dial) ? raw.slice(country.dial.length) : raw }
}

function whatsappUrl(country: Country, local: string) {
  const number = digits(local)
  return number ? `https://wa.me/${country.dial}${number}` : ''
}

export function WhatsappPhoneField({ value, onChange, disabled = false, id }: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  id?: string
}) {
  const detected = useMemo(() => resolveValue(value), [value])
  const [countryCode, setCountryCode] = useState<string>(detected.country.code)
  const country = WHATSAPP_PHONE_COUNTRIES.find((item) => item.code === countryCode) || detected.country
  const raw = digits(value)
  const local = raw.startsWith(country.dial) ? raw.slice(country.dial.length) : detected.local

  useEffect(() => {
    if (digits(value)) setCountryCode(detected.country.code)
  }, [detected.country.code, value])

  function selectCountry(code: string) {
    const nextCountry = WHATSAPP_PHONE_COUNTRIES.find((item) => item.code === code) || WHATSAPP_PHONE_COUNTRIES[0]
    setCountryCode(nextCountry.code)
    onChange(whatsappUrl(nextCountry, local))
  }

  return (
    <div className="whatsapp-phone-field">
      <label className="whatsapp-country-select" aria-label="País do WhatsApp">
        <span aria-hidden>{country.flag}</span>
        <select value={country.code} disabled={disabled} onChange={(event) => selectCountry(event.target.value)}>
          {WHATSAPP_PHONE_COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>{country.flag} {country.name} (+{country.dial})</option>
          ))}
        </select>
      </label>
      <span className="whatsapp-phone-dial">+{country.dial}</span>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" disabled={disabled}
        value={local} onChange={(event) => onChange(whatsappUrl(country, event.target.value))}
        placeholder={country.example} aria-label="Número do WhatsApp" />
    </div>
  )
}
