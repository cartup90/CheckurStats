import { NavLink } from 'react-router-dom'
import styles from './BottomNav.module.css'

export default function BottomNav({ matchId }) {
  if (!matchId) return null

  return (
    <nav className={styles.nav}>
      <NavLink to={`/partido/${matchId}`} className={({ isActive }) => [styles.tab, isActive ? styles.active : ''].join(' ')} end>
        <span className={styles.icon}>🎾</span>
        <span className={styles.label}>En vivo</span>
      </NavLink>
      <NavLink to={`/partido/${matchId}/historial`} className={({ isActive }) => [styles.tab, isActive ? styles.active : ''].join(' ')}>
        <span className={styles.icon}>📋</span>
        <span className={styles.label}>Historial</span>
      </NavLink>
      <NavLink to={`/partido/${matchId}/stats`} className={({ isActive }) => [styles.tab, isActive ? styles.active : ''].join(' ')}>
        <span className={styles.icon}>📊</span>
        <span className={styles.label}>Stats</span>
      </NavLink>
    </nav>
  )
}
