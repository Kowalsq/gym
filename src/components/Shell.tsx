import { NavLink, Outlet } from 'react-router'
import { IconDumbbell, IconHistory, IconHome, IconSettings } from './Icons'

const tabs = [
  { to: '/', label: 'Início', Icon: IconHome },
  { to: '/historico', label: 'Histórico', Icon: IconHistory },
  { to: '/exercicios', label: 'Exercícios', Icon: IconDumbbell },
  { to: '/ajustes', label: 'Ajustes', Icon: IconSettings },
]

/** Layout das abas: conteúdo rolável em cima, navegação fixa embaixo. */
export function Shell() {
  return (
    <div className="flex h-full flex-col">
      <main className="flex-1 overflow-y-auto px-4 pt-[calc(env(safe-area-inset-top,0px)+16px)] pb-6">
        <Outlet />
      </main>
      <nav className="grid grid-cols-4 border-t border-line bg-bg px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,0px)+10px)]">
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
