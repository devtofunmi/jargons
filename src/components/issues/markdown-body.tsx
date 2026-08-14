import Markdown from 'react-markdown'
import type { Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'

// Theme-matched markdown renderer. Uses a controlled component map (rather than
// the typography plugin) so the output matches the dark app surface exactly.
const components: Components = {
  h1: ({ node: _n, ...props }) => (
    <h1 className="mb-3 mt-6 text-xl font-semibold text-zinc-100" {...props} />
  ),
  h2: ({ node: _n, ...props }) => (
    <h2 className="mb-2 mt-6 text-lg font-semibold text-zinc-100" {...props} />
  ),
  h3: ({ node: _n, ...props }) => (
    <h3
      className="mb-2 mt-5 text-base font-semibold text-zinc-100"
      {...props}
    />
  ),
  p: ({ node: _n, ...props }) => (
    <p className="my-3 text-sm leading-7 text-zinc-400" {...props} />
  ),
  a: ({ node: _n, ...props }) => (
    <a
      className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
  ul: ({ node: _n, ...props }) => (
    <ul
      className="my-3 list-disc space-y-1 pl-5 text-sm text-zinc-400"
      {...props}
    />
  ),
  ol: ({ node: _n, ...props }) => (
    <ol
      className="my-3 list-decimal space-y-1 pl-5 text-sm text-zinc-400"
      {...props}
    />
  ),
  li: ({ node: _n, ...props }) => <li className="leading-6" {...props} />,
  strong: ({ node: _n, ...props }) => (
    <strong className="font-semibold text-zinc-200" {...props} />
  ),
  blockquote: ({ node: _n, ...props }) => (
    <blockquote
      className="my-4 border-l-2 border-white/15 pl-4 text-sm text-zinc-500"
      {...props}
    />
  ),
  hr: ({ node: _n, ...props }) => (
    <hr className="my-6 border-white/10" {...props} />
  ),
  pre: ({ node: _n, ...props }) => (
    <pre
      className="my-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#0a0a0b] p-4 text-[12px] leading-6 text-zinc-300"
      {...props}
    />
  ),
  code: ({ node: _n, className, children, ...props }) => {
    // Fenced blocks carry a `language-*` class and are wrapped by <pre> above;
    // leave them unstyled here. Inline code gets its own pill.
    if (/language-/.test(className ?? '')) {
      return (
        <code className={`font-mono ${className ?? ''}`} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code
        className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.85em] text-zinc-200"
        {...props}
      >
        {children}
      </code>
    )
  },
}

export function MarkdownBody({ children }: { children: string }) {
  return (
    <Markdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </Markdown>
  )
}
