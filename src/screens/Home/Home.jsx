import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import db from '../../db/database.js'
import Button from '../../components/Button.jsx'
import styles from './Home.module.css'

export default function Home() {
  const [matches, setMatches] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    loadMatches()
  }, [])

  async function loadMatches() {
    const all = await db.matches.orderBy('createdAt').reverse().toArray()
    setMatches(all)
  }

  async function deleteMatch(id, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este partido?')) return
    await db.matches.delete(id)
    await db.sets.where('matchId').equals(id).delete()
    await db.games.where('matchId').equals(id).delete()
    await db.points.where('matchId').equals(id).delete()
    loadMatches()
  }

  function formatDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  function getTeamNames(m) {
    const t1 = m.equipo1 ? `${m.equipo1.drive?.nombre || '?'} / ${m.equipo1.reves?.nombre || '?'}` : 'Equipo 1'
    const t2 = m.equipo2 ? `${m.equipo2.drive?.nombre || '?'} / ${m.equipo2.reves?.nombre || '?'}` : 'Equipo 2'
    return { t1, t2 }
  }

  function getScore(m) {
    if (!m.matchState) return ''
    try {
      const s = JSON.parse(m.matchState)
      const sets = s.sets || []
      const cur = s.currentSet
      const parts = sets.map(st => `${st.g1}-${st.g2}`)
      if (cur && (cur.g1 > 0 || cur.g2 > 0)) parts.push(`${cur.g1}-${cur.g2}`)
      return parts.join('  ')
    } catch { return '' }
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>🎾</span>
          <div>
            <h1 className={styles.title}>PadelStats</h1>
            <p className={styles.subtitle}>Estadísticas en vivo</p>
          </div>
        </div>
        <button className={styles.playersBtn} onClick={() => navigate('/jugadores')} aria-label="Jugadores">
          👤
        </button>
      </header>

      {/* Content */}
      <main className={styles.main}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => navigate('/nuevo-partido')}
          className={styles.newMatchBtn}
        >
          <span>+</span> Nuevo partido
        </Button>

        {matches.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>🏓</div>
            <p>Todavía no hay partidos registrados.</p>
            <p style={{ fontSize: 'var(--text-sm)', marginTop: '0.25rem' }}>
              Tocá "Nuevo partido" para empezar.
            </p>
          </div>
        ) : (
          <div className={styles.matchList}>
            <h2 className={styles.sectionTitle}>Partidos</h2>
            {matches.map(m => {
              const { t1, t2 } = getTeamNames(m)
              const score = getScore(m)
              return (
                <div
                  key={m.id}
                  className={[styles.matchCard, m.estado === 'en_curso' ? styles.live : ''].join(' ')}
                  onClick={() => navigate(`/partido/${m.id}`)}
                >
                  <div className={styles.cardTop}>
                    <div className={styles.matchDate}>{formatDate(m.createdAt)}</div>
                    {m.estado === 'en_curso' && (
                      <span className={styles.liveBadge}>● EN VIVO</span>
                    )}
                    {m.estado === 'finalizado' && (
                      <span className={styles.doneBadge}>Finalizado</span>
                    )}
                  </div>
                  <div className={styles.teams}>
                    <span className={styles.team1}>{t1}</span>
                    <span className={styles.vs}>vs</span>
                    <span className={styles.team2}>{t2}</span>
                  </div>
                  {score && <div className={styles.score}>{score}</div>}
                  <div className={styles.cardActions}>
                    <span className={styles.formatBadge}>
                      {m.formato?.cantSets || 3} sets
                      {m.formato?.puntoDeOro ? ' · Punto de oro' : ''}
                      {m.formato?.starPoint  ? ' · Star Point'  : ''}
                    </span>
                    <button
                      className={styles.deleteBtn}
                      onClick={(e) => deleteMatch(m.id, e)}
                      aria-label="Eliminar partido"
                    >🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
