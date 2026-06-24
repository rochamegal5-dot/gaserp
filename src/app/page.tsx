'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Flame,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Boxes,
  Truck,
  FileText,
  Bike,
  Wallet,
  MapPin,
  MessageCircle,
  Megaphone,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { DashboardModule } from '@/components/modules/dashboard'
import { VentasModule } from '@/components/modules/ventas'
import { ClientesModule } from '@/components/modules/clientes'
import { ProductosModule } from '@/components/modules/productos'
import { StockModule } from '@/components/modules/stock'
import { ProveedoresModule } from '@/components/modules/proveedores'
import { RemitosModule } from '@/components/modules/remitos'
import { RepartidoresModule } from '@/components/modules/repartidores'
import { FinanzasModule } from '@/components/modules/finanzas'
import { RastreoModule } from '@/components/modules/rastreo'
import { WhatsAppModule } from '@/components/modules/whatsapp'
import { MarketingModule } from '@/components/modules/marketing'

type ModuleKey =
  | 'dashboard'
  | 'ventas'
  | 'clientes'
  | 'productos'
  | 'stock'
  | 'proveedores'
  | 'remitos'
  | 'repartidores'
  | 'finanzas'
  | 'rastreo'
  | 'whatsapp'
  | 'marketing'

interface ModuleDef {
  key: ModuleKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  desc: string
}

const MODULES: ModuleDef[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, desc: 'Resumen general' },
  { key: 'ventas', label: 'Ventas', icon: ShoppingCart, desc: 'Registrar y listar' },
  { key: 'clientes', label: 'Clientes', icon: Users, desc: 'Gestión de clientes' },
  { key: 'productos', label: 'Productos', icon: Package, desc: 'Catálogo y precios' },
  { key: 'stock', label: 'Stock', icon: Boxes, desc: 'Depósito y camionetas' },
  { key: 'proveedores', label: 'Proveedores', icon: Truck, desc: 'Gestión de proveedores' },
  { key: 'remitos', label: 'Remitos', icon: FileText, desc: 'Compras y saldos' },
  { key: 'repartidores', label: 'Repartidores', icon: Bike, desc: 'Equipo y stock' },
  { key: 'finanzas', label: 'Finanzas', icon: Wallet, desc: 'Cuentas y caja' },
  { key: 'rastreo', label: 'Rastreo GPS', icon: MapPin, desc: 'En vivo e historial' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, desc: 'Conexión y chats' },
  { key: 'marketing', label: 'Marketing', icon: Megaphone, desc: 'Campañas y redes' },
]

const MODULE_COMPONENTS: Record<ModuleKey, React.ComponentType> = {
  dashboard: DashboardModule,
  ventas: VentasModule,
  clientes: ClientesModule,
  productos: ProductosModule,
  stock: StockModule,
  proveedores: ProveedoresModule,
  remitos: RemitosModule,
  repartidores: RepartidoresModule,
  finanzas: FinanzasModule,
  rastreo: RastreoModule,
  whatsapp: WhatsAppModule,
  marketing: MarketingModule,
}

function FlameLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-red-500 text-white shadow-lg shadow-orange-500/30',
        className
      )}
    >
      <Flame className="size-2/3 drop-shadow-sm" strokeWidth={2.4} />
    </div>
  )
}

function SidebarContent({
  active,
  onSelect,
}: {
  active: ModuleKey
  onSelect: (k: ModuleKey) => void
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2 overflow-y-auto gt-scroll flex-1">
      {MODULES.map((m) => {
        const Icon = m.icon
        const isActive = active === m.key
        return (
          <button
            key={m.key}
            onClick={() => onSelect(m.key)}
            className={cn(
              'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all',
              isActive
                ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md shadow-emerald-500/25'
                : 'text-foreground/70 hover:bg-emerald-50 hover:text-emerald-700'
            )}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon
              className={cn(
                'size-5 shrink-0 transition-transform',
                isActive ? 'scale-110' : 'group-hover:scale-105'
              )}
            />
            <span className="flex-1 truncate">{m.label}</span>
            {isActive && <ChevronRight className="size-4 opacity-80" />}
          </button>
        )
      })}
    </nav>
  )
}

export default function Home() {
  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [now, setNow] = useState<Date>(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const ActiveComponent = MODULE_COMPONENTS[activeModule]
  const activeDef = useMemo(() => MODULES.find((m) => m.key === activeModule)!, [activeModule])

  const fechaStr = useMemo(() => {
    if (!now) return ''
    return new Intl.DateTimeFormat('es-UY', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now)
  }, [now])

  const horaStr = useMemo(() => {
    if (!now) return ''
    return new Intl.DateTimeFormat('es-UY', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(now)
  }, [now])

  function selectModule(k: ModuleKey) {
    setActiveModule(k)
    setMobileOpen(false)
  }

  return (
    <div className="min-h-screen-flex bg-muted/20">
      {/* Mobile top bar */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b bg-background px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <FlameLogo className="size-9" />
          <div className="leading-tight">
            <p className="text-sm font-bold tracking-tight">GasTrack ERP</p>
            <p className="text-[10px] text-muted-foreground capitalize">{fechaStr}</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu className="size-5" />
        </Button>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <aside className="hidden md:flex md:w-64 lg:w-72 flex-col border-r bg-background">
          <div className="flex items-center gap-3 px-5 py-5 border-b">
            <FlameLogo className="size-11" />
            <div className="leading-tight">
              <h1 className="text-base font-bold tracking-tight">GasTrack ERP</h1>
              <p className="text-[11px] text-muted-foreground">Gas envasado · Uruguay</p>
            </div>
          </div>
          <SidebarContent active={activeModule} onSelect={selectModule} />
          <div className="border-t px-5 py-3 text-[11px] text-muted-foreground">
            <p>GasTrack ERP v2.0</p>
            <p className="mt-0.5">© {new Date().getFullYear()}</p>
          </div>
        </aside>

        {/* Mobile sidebar */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 p-0 flex flex-col">
            <SheetHeader className="px-4 pt-4">
              <div className="flex items-center gap-3">
                <FlameLogo className="size-10" />
                <div>
                  <SheetTitle>GasTrack ERP</SheetTitle>
                  <p className="text-[11px] text-muted-foreground">Gas envasado · Uruguay</p>
                </div>
              </div>
            </SheetHeader>
            <SidebarContent active={activeModule} onSelect={selectModule} />
            <div className="border-t px-4 py-3 text-[11px] text-muted-foreground">
              GasTrack ERP v2.0
            </div>
          </SheetContent>
        </Sheet>

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Desktop header */}
          <header className="hidden md:flex items-center justify-between border-b bg-background/95 backdrop-blur px-6 py-3 sticky top-0 z-20">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">{activeDef.label}</h2>
              <p className="text-xs text-muted-foreground">{activeDef.desc}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium capitalize">{fechaStr}</p>
              <p className="text-xs text-muted-foreground tabular-nums">{horaStr}</p>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto">
            <ActiveComponent />
          </main>

          <footer className="border-t bg-background px-4 md:px-6 py-3 mt-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <FlameLogo className="size-5" />
                <span className="font-medium text-foreground/80">GasTrack ERP v2.0</span>
              </div>
              <p className="text-center sm:text-right">
                Sistema de Gestión para Gas Envasado · Uruguay
              </p>
            </div>
          </footer>
        </div>
      </div>

      {/* Mobile close button when sheet open is handled by Sheet */}
      {mobileOpen && (
        <button
          aria-label="Cerrar"
          onClick={() => setMobileOpen(false)}
          className="sr-only"
        >
          <X />
        </button>
      )}
    </div>
  )
}
