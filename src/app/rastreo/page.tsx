'use client'

import dynamic from 'next/dynamic'

const RastreoModule = dynamic(
  () => import('@/components/modules/rastreo').then(m => ({ default: m.RastreoModule })),
  { ssr: false }
)

export default function RastreoPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-background px-4 md:px-6 py-3 sticky top-0 z-20">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Rastreo GPS</h2>
          <p className="text-xs text-muted-foreground">Seguimiento en vivo e historial</p>
        </div>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition"
        >
          ← Volver al ERP
        </button>
      </header>
      <main className="p-4 md:p-6">
        <RastreoModule />
      </main>
    </div>
  )
}
