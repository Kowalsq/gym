import { Route, Routes } from 'react-router'
import { Shell } from './components/Shell'
import { ExerciseDetail } from './pages/ExerciseDetail'
import { Exercises } from './pages/Exercises'
import { History } from './pages/History'
import { Home } from './pages/Home'
import { QuickNote } from './pages/QuickNote'
import { SessionDetail } from './pages/SessionDetail'
import { Settings } from './pages/Settings'
import { Workout } from './pages/Workout'

export default function App() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="anotar" element={<QuickNote />} />
        <Route path="historico" element={<History />} />
        <Route path="historico/:id" element={<SessionDetail />} />
        <Route path="exercicios" element={<Exercises />} />
        <Route path="exercicios/:id" element={<ExerciseDetail />} />
        <Route path="ajustes" element={<Settings />} />
      </Route>
      {/* Treino em andamento cobre a navegação inferior. */}
      <Route path="treino" element={<Workout />} />
    </Routes>
  )
}
