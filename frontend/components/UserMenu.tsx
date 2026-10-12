'use client'

export function UserMenu({ initials }: { initials: string }) {
  return (
    <div
      className="w-8 h-8 rounded-full bg-amber flex items-center justify-center text-white text-xs font-semibold"
    >
      {initials}
    </div>
  )
}
