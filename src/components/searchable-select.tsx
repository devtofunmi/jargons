import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

export type SelectOption = { value: string; label: string }

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyLabel = 'No matches',
  disabled = false,
}: {
  options: SelectOption[]
  value: string
  onChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyLabel?: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onDocMouseDown(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDocMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const selected = options.find((option) => option.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options
    return options.filter((option) => option.label.toLowerCase().includes(q))
  }, [options, query])

  return (
    <div ref={containerRef} className="relative w-full sm:w-72">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.1] bg-[#09090b] px-4 py-3.5 font-mono text-xs text-zinc-300 transition hover:border-white/[0.2] focus:border-amber-300/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className={selected ? 'truncate' : 'truncate text-zinc-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-zinc-500" />
      </button>

      {open ? (
        <div className="absolute left-0 right-0 z-50 mt-2 overflow-hidden rounded-xl border border-white/[0.1] bg-[#0c0c0f] shadow-2xl shadow-black/60">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3">
            <Search className="size-3.5 text-zinc-500" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent py-2.5 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
            />
          </div>
          <ul className="custom-scrollbar max-h-64 overflow-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 font-mono text-xs text-zinc-600">
                {emptyLabel}
              </li>
            ) : (
              filtered.map((option) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left font-mono text-xs text-zinc-300 transition hover:bg-white/[0.04]"
                  >
                    <span className="truncate">{option.label}</span>
                    {option.value === value ? (
                      <Check className="size-3.5 shrink-0 text-amber-300" />
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
