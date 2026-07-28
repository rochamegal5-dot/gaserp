'use client'

import { useEffect, useState } from 'react'

export default function RastreoPage() {
  const [Module, setModule] = useState<React.ComponentType | null>(null)

  useEffect(() => {
    import('@/components/modules/rastreo')
      .then(mod => setModule(() => mod.RastreoModule))
      .catch(err => console.error('Error cargando rastreo:', err))
  }, [])

  if (!Module) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Cargando Rastreo GPS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b bg-background px-4 md:px-6 py-3 sticky top-0 z-20">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Rastreo GPS</h2>
          <p className="text-xs text-muted-foreground">Seguimiento en vivo e historial</p>
        </div>
        <button
          onClick={() => window.close()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition cursor-pointer"
        >
          Volver al ERP
        </button>
      </header>
      <main className="p-4 md:p-6">
        <Module />
      </main>
    </div>
  )
}
