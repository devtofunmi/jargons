import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { FREE_RUN_LIMIT, PAID_PLAN_IDS, PAID_PLANS } from '../../lib/plans'
import type { Plan } from '../../lib/plans'

const OPTIONS: { id: Plan; name: string; detail: string }[] = [
  { id: 'free', name: 'Free', detail: `$0 · ${FREE_RUN_LIMIT} run` },
  ...PAID_PLAN_IDS.map((id) => ({
    id,
    name: PAID_PLANS[id].name,
    detail: `$${PAID_PLANS[id].priceUsd} · ${PAID_PLANS[id].runLimit} runs`,
  })),
]

const MENU_WIDTH = 208
const MENU_GAP = 6

// Plan picker for the admin users table. The menu is portalled to <body> with
// fixed positioning because the table scrolls inside an overflow container,
// which would clip an absolutely positioned menu on the bottom rows.
export function PlanDropdown({
  plan,
  busy,
  onChange,
}: {
  plan: Plan
  busy: boolean
  onChange: (next: Plan) => void
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [position, setPosition] = useState<{
    top: number
    left: number
    above: boolean
  } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLUListElement>(null)
  const listId = useId()

  function openMenu() {
    setActive(
      Math.max(
        0,
        OPTIONS.findIndex((o) => o.id === plan),
      ),
    )
    setOpen(true)
  }

  function close({ focusTrigger = true } = {}) {
    setOpen(false)
    if (focusTrigger) triggerRef.current?.focus()
  }

  function choose(next: Plan) {
    close()
    if (next !== plan) onChange(next)
  }

  // Place the menu under the trigger, flipping above it near the viewport
  // bottom, and keep it inside the viewport horizontally.
  useLayoutEffect(() => {
    if (!open) return
    const trigger = triggerRef.current?.getBoundingClientRect()
    if (!trigger) return
    const menuHeight = menuRef.current?.offsetHeight ?? 0
    const above =
      trigger.bottom + MENU_GAP + menuHeight > window.innerHeight &&
      trigger.top - MENU_GAP - menuHeight > 0
    setPosition({
      top: above
        ? trigger.top - MENU_GAP - menuHeight
        : trigger.bottom + MENU_GAP,
      left: Math.min(
        Math.max(8, trigger.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - 8,
      ),
      above,
    })
  }, [open])

  // Close on outside click, and on scroll/resize since the fixed menu would
  // otherwise drift away from its trigger.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        close({ focusTrigger: false })
      }
    }
    function onViewportChange(event: Event) {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return
      }
      close({ focusTrigger: false })
    }
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    menuRef.current?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('scroll', onViewportChange, true)
      window.removeEventListener('resize', onViewportChange)
    }
  }, [open])

  function onMenuKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % OPTIONS.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i - 1 + OPTIONS.length) % OPTIONS.length)
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActive(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActive(OPTIONS.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      choose(OPTIONS[active].id)
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      event.preventDefault()
      close()
    }
  }

  const current = OPTIONS.find((o) => o.id === plan) ?? OPTIONS[0]

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Plan: ${current.name}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        disabled={busy}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openMenu()
          }
        }}
        className={`inline-flex min-w-[104px] items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          open
            ? 'border-white/[0.18] bg-white/[0.07] text-zinc-100'
            : 'border-white/[0.1] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <PlanDot plan={current.id} />
          {current.name}
        </span>
        {busy ? (
          <LoaderCircle className="size-3 animate-spin text-zinc-500" />
        ) : (
          <ChevronDown
            className={`size-3 text-zinc-500 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        )}
      </button>

      {open
        ? createPortal(
            <ul
              ref={menuRef}
              id={listId}
              role="listbox"
              tabIndex={-1}
              aria-label="Change plan"
              aria-activedescendant={`${listId}-${OPTIONS[active].id}`}
              onKeyDown={onMenuKeyDown}
              style={{
                top: position?.top ?? 0,
                left: position?.left ?? 0,
                width: MENU_WIDTH,
                visibility: position ? 'visible' : 'hidden',
              }}
              className="fixed z-50 rounded-2xl border border-white/[0.08] bg-[#0d0d10] p-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)] outline-none"
            >
              {OPTIONS.map((option, index) => {
                const selected = option.id === plan
                return (
                  <li
                    key={option.id}
                    id={`${listId}-${option.id}`}
                    role="option"
                    aria-selected={selected}
                    onPointerEnter={() => setActive(index)}
                    onClick={() => choose(option.id)}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 ${
                      index === active ? 'bg-white/[0.06]' : ''
                    }`}
                  >
                    <PlanDot plan={option.id} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block text-sm ${
                          selected ? 'text-zinc-100' : 'text-zinc-300'
                        }`}
                      >
                        {option.name}
                      </span>
                      <span className="block font-mono text-[10px] text-zinc-600">
                        {option.detail}
                      </span>
                    </span>
                    {selected ? (
                      <Check className="size-3.5 text-emerald-300" />
                    ) : null}
                  </li>
                )
              })}
            </ul>,
            document.body,
          )
        : null}
    </>
  )
}

function PlanDot({ plan }: { plan: Plan }) {
  return (
    <span
      aria-hidden
      className={`size-1.5 shrink-0 rounded-full ${
        plan === 'free' ? 'bg-zinc-600' : 'bg-amber-300'
      }`}
    />
  )
}
