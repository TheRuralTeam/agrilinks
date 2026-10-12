import React, { useMemo, useState } from 'react'
import { MapPin, Search } from 'lucide-react'
import { getProvincesForCountry } from '../data/country-locations'

type LocationAutocompleteProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  inputClassName?: string
  inputStyle?: React.CSSProperties
  onBlur?: () => void
  onFocus?: () => void
}

const normalize = (value: string) =>
  value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-AO').trim()

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'Município, bairro ou zona',
  disabled = false,
  inputClassName = '',
  inputStyle,
  onBlur,
  onFocus,
}: LocationAutocompleteProps) {
  const [focused, setFocused] = useState(false)
  const suggestions = useMemo(() => {
    const provinces = getProvincesForCountry('AO')
    const all = provinces.flatMap((province) => [
      { label: `${province.name}, Angola`, search: province.name },
      ...province.municipalities.map((municipality) => ({
        label: `${municipality.name}, ${province.name}, Angola`,
        search: `${municipality.name} ${province.name}`,
      })),
    ])
    const query = normalize(value)
    if (!query) {
      return all.filter((item) => /Luanda|Viana|Cacuaco|Benguela|Huambo|Lubango|Malanje/i.test(item.label)).slice(0, 7)
    }
    return all
      .filter((item) => normalize(item.label).includes(query) || normalize(item.search).includes(query))
      .filter((item, index, list) => list.findIndex((candidate) => candidate.label === item.label) === index)
      .slice(0, 7)
  }, [value])

  return (
    <div className="relative w-full">
      <div className="relative">
        <MapPin
          aria-hidden="true"
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#758A79] pointer-events-none"
        />
        <input
          type="text"
          autoComplete="off"
          maxLength={180}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          aria-label="Local de entrega"
          aria-autocomplete="list"
          aria-expanded={focused && suggestions.length > 0}
          onFocus={() => { setFocused(true); onFocus?.() }}
          onBlur={() => { window.setTimeout(() => setFocused(false), 120); onBlur?.() }}
          onChange={(event) => onChange(event.target.value)}
          className={`w-full pl-10 pr-3 ${inputClassName}`}
          style={inputStyle}
        />
      </div>
      {focused && suggestions.length > 0 && (
        <div
          role="listbox"
          aria-label="Sugestões de localização em Angola"
          className="absolute z-[80] mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-[#DCE8DD] bg-white py-1 shadow-xl"
        >
          {suggestions.map((item) => (
            <button
              key={item.label}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => { onChange(item.label); setFocused(false) }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-[#26382A] transition-colors hover:bg-[#F2FAF3]"
            >
              <Search aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-[#2c863b]" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}
      <p className="mt-1.5 text-[11px] leading-4 text-[#758A79]">
        Escreva município e bairro/zona. Pode escolher uma sugestão ou manter o texto livre; não precisa de partilhar a sua localização GPS.
      </p>
    </div>
  )
}
