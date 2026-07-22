type OwlMarkProps = {
  className?: string
}

export function OwlMark({ className = 'size-9' }: OwlMarkProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8.2 12.4 14 7.8l6 3.4 6-3.4 5.8 4.6v10.2L26 31.2 20 34l-6-2.8-5.8-8.6V12.4Z"
        fill="#f59e0b"
      />
      <path
        d="m10.8 11.8 4.1-1.5 5.1 3.1 5.1-3.1 4.1 1.5v9.8l-4.8 6.8L20 31l-4.4-2.6-4.8-6.8v-9.8Z"
        fill="#0a0a0b"
      />
      <path
        d="M12.7 15.5h5.7L20 18l1.6-2.5h5.7l-1.1 7.2-4.1 2.2L20 28l-2.1-3.1-4.1-2.2-1.1-7.2Z"
        fill="#f8fafc"
      />
      <circle cx="16.2" cy="19.7" r="1.7" fill="#0a0a0b" />
      <circle cx="23.8" cy="19.7" r="1.7" fill="#0a0a0b" />
      <path d="m20 21.5 2 2.1-2 1.1-2-1.1 2-2.1Z" fill="#f59e0b" />
    </svg>
  )
}
