import { Routes, Route } from 'react-router-dom'
import Home          from './screens/Home/Home.jsx'
import Players       from './screens/Players/Players.jsx'
import NewMatch      from './screens/NewMatch/NewMatch.jsx'
import LiveCapture   from './screens/LiveCapture/LiveCapture.jsx'
import History       from './screens/History/History.jsx'
import Stats         from './screens/Stats/Stats.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/"                          element={<Home />} />
      <Route path="/jugadores"                 element={<Players />} />
      <Route path="/nuevo-partido"             element={<NewMatch />} />
      <Route path="/partido/:id"               element={<LiveCapture />} />
      <Route path="/partido/:id/historial"     element={<History />} />
      <Route path="/partido/:id/stats"         element={<Stats />} />
    </Routes>
  )
}
