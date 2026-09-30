import './FilterBar.css'
type FilterOption<T extends string> = { value: T; label: string; count: number }

type FilterBarProps<T extends string> = {
  label: string
  controls: string
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
}

/** A single-selection filter group with native keyboard and pressed semantics. */
export function FilterBar<T extends string>({
  label,
  controls,
  options,
  value,
  onChange,
}: FilterBarProps<T>) {
  return (
    <div aria-label={label} className="filter-bar" role="group">
      {options.map((option) => (
        <button
          aria-controls={controls}
          aria-pressed={value === option.value}
          className={value === option.value ? 'is-active' : undefined}
          key={option.value}
          onClick={() => onChange(option.value)}
          type="button"
        >
          {option.label}
          <span>{option.count}</span>
        </button>
      ))}
    </div>
  )
}
