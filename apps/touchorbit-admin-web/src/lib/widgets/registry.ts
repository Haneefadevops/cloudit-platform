import type { WidgetDefinition, WidgetType } from './types'

export const WIDGET_REGISTRY: Partial<Record<WidgetType, WidgetDefinition>> = {}

export function registerWidget(def: WidgetDefinition): void {
  WIDGET_REGISTRY[def.type] = def
}

export function getWidget(type: WidgetType): WidgetDefinition | undefined {
  return WIDGET_REGISTRY[type]
}

export function getAllWidgets(): WidgetDefinition[] {
  return Object.values(WIDGET_REGISTRY) as WidgetDefinition[]
}
