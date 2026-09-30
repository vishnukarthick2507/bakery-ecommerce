'use client'

import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { categories } from '@/lib/mock-data'
import { formatPrice } from '@/lib/format'
import type { AvailabilityStatus, CategorySlug, WeightRange } from '@/lib/types'

export const PRICE_MIN = 0
export const PRICE_MAX = 2000

export interface FilterState {
  categories: CategorySlug[]
  price: [number, number]
  weights: WeightRange[]
  availability: AvailabilityStatus[]
  minRating: number
  vegOnly: boolean
}

export const defaultFilterState: FilterState = {
  categories: [],
  price: [PRICE_MIN, PRICE_MAX],
  weights: [],
  availability: [],
  minRating: 0,
  vegOnly: false,
}

const weightOptions: Array<{ value: WeightRange; label: string }> = [
  { value: 'under-250', label: 'Under 250 g' },
  { value: '250-500', label: '250 g – 500 g' },
  { value: '500-1000', label: '500 g – 1 kg' },
  { value: 'over-1000', label: 'Above 1 kg' },
]

const availabilityOptions: Array<{ value: AvailabilityStatus; label: string }> = [
  { value: 'AVAILABLE_NOW', label: 'Available now' },
  { value: 'READY_IN_TIME', label: 'Ready in a few hours' },
  { value: 'PRE_ORDER', label: 'Pre-order' },
  { value: 'SOLD_OUT', label: 'Sold out' },
]

export function countActiveFilters(f: FilterState) {
  return (
    f.categories.length +
    f.weights.length +
    f.availability.length +
    (f.minRating ? 1 : 0) +
    (f.vegOnly ? 1 : 0) +
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
      <Field orientation="horizontal" className="rounded-lg border bg-card p-3">
        <Checkbox
          id={`${idPrefix}-veg`}
          checked={value.vegOnly}
          onCheckedChange={(checked) => set('vegOnly', checked === true)}
        />
        <FieldLabel htmlFor={`${idPrefix}-veg`} className="font-medium">
          Veg / eggless only
        </FieldLabel>
      </Field>

      <CheckboxList
        idPrefix={`${idPrefix}-cat`}
        legend="Category"
        options={categories.map((c) => ({ value: c.slug, label: c.name }))}
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
        idPrefix={`${idPrefix}-wt`}
        legend="Weight"
        options={weightOptions}
        selected={value.weights}
        onChange={(v) => set('weights', v)}
      />

      <Separator />

      <CheckboxList
        idPrefix={`${idPrefix}-av`}
        legend="Availability"
        options={availabilityOptions}
        selected={value.availability}
        onChange={(v) => set('availability', v)}
      />

      <Separator />

      <FieldSet>
        <FieldLegend variant="label">Customer rating</FieldLegend>
        <ToggleGroup
          variant="outline"
          value={[String(value.minRating)]}
          onValueChange={(v) => set('minRating', Number(v[0] ?? 0))}
          className="w-full"
        >
          <ToggleGroupItem value="0" className="flex-1">
            Any
          </ToggleGroupItem>
          <ToggleGroupItem value="4" className="flex-1">
            4★ +
          </ToggleGroupItem>
          <ToggleGroupItem value="4.5" className="flex-1">
            4.5★ +
          </ToggleGroupItem>
        </ToggleGroup>
      </FieldSet>
    </div>
  )
}
