import { NavLink, Outlet } from 'react-router'
import { IconDumbbell, IconHistory, IconHome, IconList, IconPlus, IconSettings } from './Icons'
import { SyncBadge } from './SyncBadge'

const tabs = [
  { to: '/', label: 'Evolução', Icon: IconHome, mobile: true },
  { to: '/anotar', label: 'Anotar', Icon: IconPlus, mobile: true },
  { to: '/historico', label: 'Histórico', Icon: IconHistory, mobile: true },
  { to: '/treinos', label: 'Treinos', Icon: IconList, mobile: true },
  { to: '/exercicios', label: 'Exercícios', Icon: IconDumbbell, mobile: false },
  { to: '/ajustes', label: 'Ajustes', Icon: IconSettings, mobile: true },
]

/**
 * Layout: no celular, abas embaixo; no PC (lg), barra lateral fixa e
 * conteúdo largo. Exercícios só aparece na barra lateral; no celular
 * chega-se por Treinos ou Ajustes.
 */
export function Shell() {
  const mobileTabs = tabs.filter((t) => t.mobile)
  return (
    <div className="flex h-full flex-col lg:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line px-3 py-6 lg:flex">
        <div className="mb-8 px-3 font-display text-xl font-extrabold tracking-tight">Ferro</div>
        <nav className="flex flex-col gap-1">
          {tabs.map(({ to, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                  isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface hover:text-text'
                }`
              }
            >
              <Icon width={20} height={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <SyncBadge className="mt-auto px-3" />
      </aside>

      <main className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>

      <nav className="grid grid-cols-5 border-t border-line bg-bg px-1 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] lg:hidden">
        {mobileTabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `tap flex flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-muted'}`
            }
          >
            <Icon />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
