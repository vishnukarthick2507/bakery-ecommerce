'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { formatPrice } from '@/lib/format'
import { categoryOptions } from '@/lib/category-options'
import type { AvailabilityStatus, CategorySlug } from '@/lib/types'

export const PRICE_MIN = 0
export const PRICE_MAX = 2000

export interface FilterState {
  categories: CategorySlug[]
  price: [number, number]
  availability: AvailabilityStatus[]
}

export const defaultFilterState: FilterState = {
  categories: [],
  price: [PRICE_MIN, PRICE_MAX],
  availability: [],
}

const availabilityOptions: Array<{ value: AvailabilityStatus; label: string }> = [
  { value: 'AVAILABLE_NOW', label: 'Available now' },
  { value: 'SOLD_OUT', label: 'Sold out' },
]

export function countActiveFilters(f: FilterState) {
  return (
    f.categories.length +
    f.availability.length +
    (f.price[0] !== PRICE_MIN || f.price[1] !== PRICE_MAX ? 1 : 0)
  )
}

function toggle<T>(list: T[], value: T, checked: boolean) {
  return checked ? [...list, value] : list.filter((v) => v !== value)
}

function CheckboxList<T extends string>({
  idPrefix,
  legend,
  options,
  selected,
  onChange,
}: {
  idPrefix: string
  legend: string
  options: Array<{ value: T; label: string }>
  selected: T[]
  onChange: (next: T[]) => void
}) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{legend}</FieldLegend>
      <FieldGroup className="gap-3">
        {options.map((o) => (
          <Field key={o.value} orientation="horizontal">
            <Checkbox
              id={`${idPrefix}-${o.value}`}
              checked={selected.includes(o.value)}
              onCheckedChange={(checked) => onChange(toggle(selected, o.value, checked === true))}
            />
            <FieldLabel htmlFor={`${idPrefix}-${o.value}`} className="font-normal">
              {o.label}
            </FieldLabel>
          </Field>
        ))}
      </FieldGroup>
    </FieldSet>
  )
}

export function ProductFiltersPanel({
  value,
  onChange,
  idPrefix = 'f',
}: {
  value: FilterState
  onChange: (next: FilterState) => void
  idPrefix?: string
}) {
  const set = <K extends keyof FilterState>(key: K, v: FilterState[K]) => onChange({ ...value, [key]: v })

  return (
    <div className="flex flex-col gap-6">
      <CheckboxList
        idPrefix={`${idPrefix}-cat`}
        legend="Category"
        options={categoryOptions}
        selected={value.categories}
        onChange={(v) => set('categories', v)}
      />

      <Separator />

      <FieldSet>
        <FieldLegend variant="label">Price</FieldLegend>
        <Slider
          min={PRICE_MIN}
          max={PRICE_MAX}
          step={50}
          value={value.price}
          onValueChange={(v) => set('price', v as [number, number])}
          aria-label="Price range"
          className="mt-2"
        />
        <p className="flex justify-between text-sm text-muted-foreground">
          <span>{formatPrice(value.price[0])}</span>
          <span>
            {formatPrice(value.price[1])}
            {value.price[1] === PRICE_MAX ? '+' : ''}
          </span>
        </p>
      </FieldSet>

      <Separator />

      <CheckboxList
        idPrefix={`${idPrefix}-av`}
        legend="Availability"
        options={availabilityOptions}
        selected={value.availability}
        onChange={(v) => set('availability', v)}
      />
    </div>
  )
}
