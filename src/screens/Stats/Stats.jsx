import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import db from '../../db/database.js'
import { SHOT_TYPES, RESULT_TYPES } from '../../logic/scoring.js'
import BottomNav from '../../components/BottomNav.jsx'
import styles from './Stats.module.css'

// ─── Player Detail Modal ────────────────────────────────────────────────────
function PlayerModal({ player, points, allPlayers, onClose }) {
  if (!player) return null

  const playerPts = points.filter(p => p.jugadorId === player.id)
  const total     = playerPts.length
  const winners   = playerPts.filter(p => p.resultado === 'winner').length
  const errForz   = playerPts.filter(p => p.resultado === 'error_forzado').length
  const errNoForz = playerPts.filter(p => p.resultado === 'error_no_forzado').length
  const efectividad = total > 0 ? Math.round((winners / total) * 100) : 0

  // Points won by team when this player intervened
  const ptosGanados = points.filter(p =>
    p.jugadorId === player.id && p.equipo_ganador === player.team
  ).length
  const ptosPerdidos = total - ptosGanados

  // Shot breakdown
  const shotBreakdown = SHOT_TYPES
    .map(shot => {
      const shotPts  = playerPts.filter(p => p.tipo_golpe === shot.id)
      if (!shotPts.length) return null
      return {
        name:      shot.label,
        icon:      shot.icon,
        total:     shotPts.length,
        winners:   shotPts.filter(p => p.resultado === 'winner').length,
        errForz:   shotPts.filter(p => p.resultado === 'error_forzado').length,
        errNoForz: shotPts.filter(p => p.resultado === 'error_no_forzado').length,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)

  // Radar data (top 6 shots)
  const radarData = shotBreakdown.slice(0, 6).map(s => ({
    subject: s.name,
    A: s.total,
  }))

  const initials = player.nombre?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={[styles.modalAvatar, styles[`avatar${player.team}`]].join(' ')}>
            {initials}
          </div>
          <div className={styles.modalTitleBlock}>
            <h2 className={styles.modalName}>{player.nombre}</h2>
            <div className={styles.modalMeta}>
              <span className={`badge badge-team${player.team}`}>E{player.team}</span>
              <span className={styles.posTag}>{player.pos === 'drive' ? '🤜 Drive' : '🤛 Revés'}</span>
            </div>
          </div>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.modalBody}>
          {total === 0 ? (
            <p className={styles.empty}>Sin intervenciones registradas.</p>
          ) : (
            <>
              {/* KPI row */}
              <div className={styles.kpiRow}>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum}>{total}</div>
                  <div className={styles.kpiLabel}>Intervenciones</div>
                </div>
                <div className={[styles.kpi, styles.kpiAccent].join(' ')}>
                  <div className={styles.kpiNum}>{efectividad}%</div>
                  <div className={styles.kpiLabel}>Efectividad</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: '#10b981' }}>{winners}</div>
                  <div className={styles.kpiLabel}>Winners</div>
                </div>
              </div>

              {/* Error breakdown */}
              <div className={styles.kpiRow}>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: '#f59e0b' }}>{errForz}</div>
                  <div className={styles.kpiLabel}>Err. forzados</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: '#ef4444' }}>{errNoForz}</div>
                  <div className={styles.kpiLabel}>Err. no forz.</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum}>{ptosGanados}</div>
                  <div className={styles.kpiLabel}>Pts. ganados</div>
                </div>
              </div>

              {/* Mini pie: resultados */}
              <div className={styles.modalSection}>
                <h4 className={styles.sectionTitle}>Distribución de resultados</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Winner',        value: winners,   color: '#10b981' },
                        { name: 'Err. forzado',  value: errForz,   color: '#f59e0b' },
                        { name: 'Err. no forz.', value: errNoForz, color: '#ef4444' },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value"
                    >
                      {[
                        { color: '#10b981' }, { color: '#f59e0b' }, { color: '#ef4444' }
                      ].map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} (${total > 0 ? Math.round(val/total*100) : 0}%)`, name]}
                      contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }}
                    />
                    <Legend formatter={val => <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Shot breakdown table */}
              {shotBreakdown.length > 0 && (
                <div className={styles.modalSection}>
                  <h4 className={styles.sectionTitle}>Golpes utilizados</h4>

                  {/* Horizontal bar chart */}
                  <ResponsiveContainer width="100%" height={Math.max(150, shotBreakdown.length * 28)}>
                    <BarChart data={shotBreakdown} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={72} />
                      <Tooltip
                        contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }}
                      />
                      <Bar dataKey="winners"   name="Winner"       fill="#10b981" stackId="a" radius={[0,0,0,0]} />
                      <Bar dataKey="errForz"   name="Err. forzado" fill="#f59e0b" stackId="a" />
                      <Bar dataKey="errNoForz" name="Err. no forz." fill="#ef4444" stackId="a" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Detail rows */}
                  <div className={styles.shotDetailTable}>
                    <div className={styles.shotDetailHeader}>
                      <span>Golpe</span>
                      <span>N</span>
                      <span style={{ color: '#10b981' }}>W</span>
                      <span style={{ color: '#f59e0b' }}>EF</span>
                      <span style={{ color: '#ef4444' }}>ENF</span>
                      <span>%</span>
                    </div>
                    {shotBreakdown.map(s => (
                      <div key={s.name} className={styles.shotDetailRow}>
                        <span>{s.icon} {s.name}</span>
                        <span className={styles.shotTotal}>{s.total}</span>
                        <span style={{ color: '#10b981' }}>{s.winners}</span>
                        <span style={{ color: '#f59e0b' }}>{s.errForz}</span>
                        <span style={{ color: '#ef4444' }}>{s.errNoForz}</span>
                        <span style={{ color: '#00d4a0', fontWeight: 700 }}>
                          {s.total > 0 ? Math.round(s.winners / s.total * 100) : 0}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Stats component ───────────────────────────────────────────────────
export default function Stats() {
  const { id } = useParams()
  const matchId = Number(id)
  const navigate = useNavigate()

  const [match,       setMatch]       = useState(null)
  const [points,      setPoints]      = useState([])
  const [tab,         setTab]         = useState('resumen')
  const [modalPlayer, setModalPlayer] = useState(null)  // selected player for modal

  useEffect(() => { load() }, [matchId])

  async function load() {
    const m   = await db.matches.get(matchId)
    const pts = await db.points.where('matchId').equals(matchId).sortBy('timestamp')
    setMatch(m)
    setPoints(pts)
  }

  if (!match) return <div className={styles.loading}><div className={styles.spinner} /></div>

  const allPlayers = [
    { ...match.equipo1.drive, team: 1, pos: 'drive' },
    { ...match.equipo1.reves, team: 1, pos: 'reves' },
    { ...match.equipo2.drive, team: 2, pos: 'drive' },
    { ...match.equipo2.reves, team: 2, pos: 'reves' },
  ]

  // ── Global stats ──────────────────────────────────────────────────────────
  const total    = points.length
  const t1Points = points.filter(p => p.equipo_ganador === 1).length
  const t2Points = points.filter(p => p.equipo_ganador === 2).length

  const shotStats = SHOT_TYPES.map(shot => {
    const shotPts    = points.filter(p => p.tipo_golpe === shot.id)
    const winners    = shotPts.filter(p => p.resultado === 'winner').length
    const errForzado = shotPts.filter(p => p.resultado === 'error_forzado').length
    const errNoForzado = shotPts.filter(p => p.resultado === 'error_no_forzado').length
    return { name: shot.label, icon: shot.icon, total: shotPts.length, winners, errForzado, errNoForzado,
      efectividad: shotPts.length > 0 ? Math.round(winners / shotPts.length * 100) : 0 }
  }).filter(s => s.total > 0).sort((a, b) => b.total - a.total)

  const playerStats = allPlayers.map(player => {
    const playerPts  = points.filter(p => p.jugadorId === player.id)
    const winners    = playerPts.filter(p => p.resultado === 'winner').length
    const errNoForzado = playerPts.filter(p => p.resultado === 'error_no_forzado').length
    return { ...player, interventions: playerPts.length, winners, errNoForzado,
      efectividad: playerPts.length > 0 ? Math.round(winners / playerPts.length * 100) : 0 }
  })

  const pieData = [
    { name: 'Equipo 1', value: t1Points, color: '#3b82f6' },
    { name: 'Equipo 2', value: t2Points, color: '#f59e0b' },
  ]

  function exportCSV() {
    const rows = [
      ['#', 'Tiempo', 'Jugador', 'Equipo', 'Golpe', 'Resultado', 'Marcador', 'Nota', 'Revisar'],
      ...points.map((p, i) => {
        const player = allPlayers.find(pl => pl.id === p.jugadorId)
        return [i + 1, new Date(p.timestamp).toLocaleTimeString('es-AR'),
          player?.nombre || '?', `Equipo ${player?.team || '?'}`,
          SHOT_TYPES.find(s => s.id === p.tipo_golpe)?.label || p.tipo_golpe,
          RESULT_TYPES.find(r => r.id === p.resultado)?.label || p.resultado,
          p.marcador_resultante, p.nota || '', p.revisar ? 'Sí' : 'No']
      })
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `padelstats-partido-${id}-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const t1Name = `${match.equipo1.drive.nombre?.split(' ')[0]} / ${match.equipo1.reves.nombre?.split(' ')[0]}`
  const t2Name = `${match.equipo2.drive.nombre?.split(' ')[0]} / ${match.equipo2.reves.nombre?.split(' ')[0]}`

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/partido/${id}`)}>←</button>
        <h1>Estadísticas</h1>
        <button className={styles.exportBtn} onClick={exportCSV} title="Exportar CSV">📥</button>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {['resumen', 'golpes', 'jugadores'].map(t => (
          <button key={t}
            className={[styles.tabBtn, tab === t ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <main className={styles.main}>
        {/* === RESUMEN === */}
        {tab === 'resumen' && (
          <div className={styles.content}>
            <div className={styles.summaryCards}>
              <div className={styles.summaryCard}>
                <div className={styles.summaryNum}>{total}</div>
                <div className={styles.summaryLabel}>Puntos totales</div>
              </div>
              <div className={[styles.summaryCard, styles.card1].join(' ')}>
                <div className={styles.summaryNum}>{t1Points}</div>
                <div className={styles.summaryLabel}>{t1Name}</div>
              </div>
              <div className={[styles.summaryCard, styles.card2].join(' ')}>
                <div className={styles.summaryNum}>{t2Points}</div>
                <div className={styles.summaryLabel}>{t2Name}</div>
              </div>
            </div>

            {total > 0 && (
              <div className={styles.chartCard}>
                <h3>Distribución de puntos</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} pts`, '']} contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                    <Legend formatter={val => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {total > 0 && (
              <div className={styles.chartCard}>
                <h3>Tipo de resultado</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={RESULT_TYPES.map(r => ({
                    name: r.label,
                    t1: points.filter(p => p.resultado === r.id && p.equipo_ganador === 1).length,
                    t2: points.filter(p => p.resultado === r.id && p.equipo_ganador === 2).length,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                    <Bar dataKey="t1" name={t1Name} fill="#3b82f6" radius={[4,4,0,0]} />
                    <Bar dataKey="t2" name={t2Name} fill="#f59e0b" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* === GOLPES === */}
        {tab === 'golpes' && (
          <div className={styles.content}>
            {shotStats.length === 0 ? (
              <div className={styles.empty}>No hay golpes registrados aún.</div>
            ) : (
              <>
                <div className={styles.chartCard}>
                  <h3>Efectividad por golpe (%)</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, shotStats.length * 36)}>
                    <BarChart data={shotStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" domain={[0,100]} tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                      <Tooltip formatter={val => [`${val}%`, 'Efectividad']} contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                      <Bar dataKey="efectividad" fill="#00d4a0" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.chartCard}>
                  <h3>Cantidad de puntos por golpe</h3>
                  <ResponsiveContainer width="100%" height={Math.max(200, shotStats.length * 36)}>
                    <BarChart data={shotStats} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 10 }} width={70} />
                      <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                      <Bar dataKey="winners" name="Winner" fill="#10b981" stackId="a" />
                      <Bar dataKey="errForzado" name="Err. forzado" fill="#f59e0b" stackId="a" />
                      <Bar dataKey="errNoForzado" name="Err. no forz." fill="#ef4444" stackId="a" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className={styles.shotTable}>
                  <div className={styles.shotTableHeader}>
                    <span>Golpe</span><span>Total</span>
                    <span style={{color:'#10b981'}}>Winner</span>
                    <span style={{color:'#f59e0b'}}>Forz.</span>
                    <span style={{color:'#ef4444'}}>No f.</span>
                  </div>
                  {shotStats.map(s => (
                    <div key={s.name} className={styles.shotRow}>
                      <span>{s.icon} {s.name}</span>
                      <span className={styles.shotTotal}>{s.total}</span>
                      <span style={{color:'#10b981'}}>{s.winners}</span>
                      <span style={{color:'#f59e0b'}}>{s.errForzado}</span>
                      <span style={{color:'#ef4444'}}>{s.errNoForzado}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* === JUGADORES === */}
        {tab === 'jugadores' && (
          <div className={styles.content}>
            <p className={styles.tapHint}>Toca un jugador para ver su detalle completo</p>
            {playerStats.map(p => (
              <button
                key={`${p.team}-${p.pos}`}
                className={[styles.playerStatCard, styles[`border${p.team}`]].join(' ')}
                onClick={() => setModalPlayer(p)}
              >
                <div className={styles.playerStatHeader}>
                  <div className={[styles.playerAvatar, styles[`avatar${p.team}`]].join(' ')}>
                    {p.nombre?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <div className={styles.playerStatName}>{p.nombre}</div>
                    <div className={styles.playerStatSub}>
                      <span className={`badge badge-team${p.team}`}>E{p.team}</span>
                      <span className={styles.posText}>{p.pos === 'drive' ? 'Drive' : 'Revés'}</span>
                    </div>
                  </div>
                  <div className={styles.playerStatRight}>
                    <div className={styles.efectividadNum}>{p.efectividad}%</div>
                    <div className={styles.efectividadLabel}>efectividad</div>
                  </div>
                  <span className={styles.chevron}>›</span>
                </div>
                <div className={styles.playerStatGrid}>
                  <div className={styles.statItem}>
                    <div className={styles.statNum}>{p.interventions}</div>
                    <div className={styles.statLabel}>Intervenciones</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statNum} style={{color:'#10b981'}}>{p.winners}</div>
                    <div className={styles.statLabel}>Winners</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statNum} style={{color:'#ef4444'}}>{p.errNoForzado}</div>
                    <div className={styles.statLabel}>Err. no forz.</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Player detail modal */}
      {modalPlayer && (
        <PlayerModal
          player={modalPlayer}
          points={points}
          allPlayers={allPlayers}
          onClose={() => setModalPlayer(null)}
        />
      )}

      <BottomNav matchId={id} />
    </div>
  )
}
