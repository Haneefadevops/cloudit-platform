'use client'

import type { CustomFieldDefinition, CustomFieldValue } from '@/hooks/useOrganizationConfig'

interface CustomFieldInputsProps {
  definitions: CustomFieldDefinition[]
  values: CustomFieldValue[]
  onChange: (values: CustomFieldValue[]) => void
}

export function CustomFieldInputs({ definitions, values, onChange }: CustomFieldInputsProps) {
  function setValue(fieldKey: string, value: unknown) {
    const next = values.filter((v) => v.fieldKey !== fieldKey)
    if (value !== '' && value !== null && value !== undefined && value !== false) {
      next.push({ fieldKey, value })
    }
    onChange(next)
  }

  function getValue(fieldKey: string): unknown {
    return values.find((v) => v.fieldKey === fieldKey)?.value ?? ''
  }

  if (definitions.length === 0) return null

  return (
    <div className="space-y-4">
      {definitions.map((field) => (
        <div key={field.id}>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.fieldLabel}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </label>
          <CustomFieldInput
            field={field}
            value={getValue(field.fieldKey)}
            onChange={(value) => setValue(field.fieldKey, value)}
          />
        </div>
      ))}
    </div>
  )
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}) {
  const baseClassName =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500'

  switch (field.fieldType) {
    case 'text':
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClassName}
        />
      )
    case 'number':
      return (
        <input
          type="number"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          required={field.required}
          className={baseClassName}
        />
      )
    case 'date':
      return (
        <input
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClassName}
        />
      )
    case 'dropdown':
      return (
        <select
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={`${baseClassName} bg-white`}
        >
          <option value="">Select…</option>
          {Array.isArray(field.options?.choices)
            ? field.options.choices.map((option: string) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))
            : null}
        </select>
      )
    case 'checkbox':
      return (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
          />
          <span className="text-sm text-gray-700">{field.fieldLabel}</span>
        </label>
      )
    default:
      return (
        <input
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          className={baseClassName}
        />
      )
  }
}
