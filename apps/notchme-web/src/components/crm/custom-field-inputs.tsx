"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CustomFieldDefinition, CustomFieldValue } from "@/lib/contracts";

interface CustomFieldInputsProps {
  definitions: CustomFieldDefinition[];
  values: CustomFieldValue[];
  onChange: (values: CustomFieldValue[]) => void;
}

export function CustomFieldInputs({ definitions, values, onChange }: CustomFieldInputsProps) {
  function setValue(definitionId: string, value: unknown) {
    const next = values.filter((v) => v.definitionId !== definitionId);
    if (value !== "" && value !== null && value !== undefined) {
      next.push({ definitionId, value });
    }
    onChange(next);
  }

  function getValue(definitionId: string): unknown {
    return values.find((v) => v.definitionId === definitionId)?.value ?? "";
  }

  if (definitions.length === 0) return null;

  return (
    <div className="space-y-4">
      {definitions.map((field) => (
        <div key={field.id} className="space-y-2">
          <Label htmlFor={`custom-field-${field.id}`}>
            {field.name}
            {field.isRequired && <span className="ml-1 text-error">*</span>}
          </Label>
          <CustomFieldInput
            field={field}
            value={getValue(field.id)}
            onChange={(value) => setValue(field.id, value)}
          />
        </div>
      ))}
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const inputId = `custom-field-${field.id}`;

  switch (field.type) {
    case "text":
      return (
        <Input
          id={inputId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      );
    case "number":
      return (
        <Input
          id={inputId}
          type="number"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          required={field.isRequired}
        />
      );
    case "date":
      return (
        <Input
          id={inputId}
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      );
    case "url":
      return (
        <Input
          id={inputId}
          type="url"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      );
    case "email":
      return (
        <Input
          id={inputId}
          type="email"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      );
    case "single_select":
      return (
        <select
          id={inputId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">Select…</option>
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    case "multi_select":
      return (
        <select
          id={inputId}
          multiple
          value={Array.isArray(value) ? value.map(String) : []}
          onChange={(e) =>
            onChange(Array.from(e.target.selectedOptions).map((o) => o.value))
          }
          required={field.isRequired}
          className="mt-1 block w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <Input
          id={inputId}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      );
  }
}
