'use client'

import { RastreoModule } from '@/components/modules/rastreo'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

export default function RastreoPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-background">
      {/* Header standalone */}
      <header className="flex items-center justify-between border-b bg-background px-4 md:px-6 py-3 sticky top-0 z-20">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Rastreo GPS
          </h2>
          <p className="text-xs text-muted-foreground">
            Seguimiento en vivo e historial
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => window.close()}
        >
          <ArrowLeft className="size-4 mr-2" />
          Volver al ERP
        </Button>
      </header>

      {/* Módulo a pantalla completa */}
      <main className="p-4 md:p-6">
        <RastreoModule />
      </main>
    </div>
  )
}
