import { NavLink, Outlet } from 'react-router'
import { IconDumbbell, IconHistory, IconHome, IconPlus, IconSettings } from './Icons'

const tabs = [
  { to: '/', label: 'Evolução', Icon: IconHome },
  { to: '/anotar', label: 'Anotar', Icon: IconPlus },
  { to: '/historico', label: 'Histórico', Icon: IconHistory },
  { to: '/exercicios', label: 'Exercícios', Icon: IconDumbbell },
  { to: '/ajustes', label: 'Ajustes', Icon: IconSettings },
]

/**
 * Layout: no celular, abas embaixo; no PC (lg), barra lateral fixa e
 * conteúdo largo. A tela de Anotar é a primeira coisa no celular.
 */
export function Shell() {
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
      </aside>

      <main className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-6 lg:px-10 lg:py-8">
        <Outlet />
      </main>

      <nav className="grid grid-cols-5 border-t border-line bg-bg px-1 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] lg:hidden">
        {tabs.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `tap flex flex-col items-center gap-1 rounded-lg py-1 text-[11px] font-medium ${
                isActive ? 'text-accent' : 'text-muted'
              }`
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
