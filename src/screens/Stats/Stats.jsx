import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts'
import db from '../../db/database.js'
import { SHOT_TYPES, RESULT_TYPES, pointsToDisplay } from '../../logic/scoring.js'
import BottomNav from '../../components/BottomNav.jsx'
import styles from './Stats.module.css'

// ─── Colores de equipos ──────────────────────────────────────────────────────
const COLOR_T1 = '#3b82f6'
const COLOR_T2 = '#f59e0b'
const COLOR_WIN = '#10b981'
const COLOR_ENF = '#ef4444'
const COLOR_EF  = '#f59e0b'
const COLOR_GOLD = '#fbbf24'

// ─── Helper: efectividad corregida (Winners vs ENF, sin forzados) ────────────
function efectividadCorregida(winners, errNoForz) {
  const denom = winners + errNoForz
  return denom > 0 ? Math.round((winners / denom) * 100) : 0
}

// ─── Calcular Break Points ────────────────────────────────────────────────────
// Reconstruye los games a partir de la secuencia de puntos y el sacador inicial.
// Retorna { t1: { total, converted, failed }, t2: { total, converted, failed } }
function computeBreakPoints(points, equipoSacadorInicial) {
  if (!equipoSacadorInicial || points.length === 0) return null

  // Agrupar puntos por gameNumber
  const gameMap = {}
  for (const pt of points) {
    const gn = pt.gameNumber ?? 0
    if (!gameMap[gn]) gameMap[gn] = []
    gameMap[gn].push(pt)
  }

  const gameNumbers = Object.keys(gameMap).map(Number).sort((a, b) => a - b)
  const resultado = { 1: { total: 0, converted: 0, failed: 0 }, 2: { total: 0, converted: 0, failed: 0 } }

  for (const gn of gameNumbers) {
    const gamePts = gameMap[gn]
    // Equipo sacador en este game: alterna cada game
    const sacador = ((gn % 2 === 0)
      ? equipoSacadorInicial
      : (equipoSacadorInicial === 1 ? 2 : 1))
    const restador = sacador === 1 ? 2 : 1

    // Simular el marcador punto a punto para detectar momentos de BP
    let p1 = 0, p2 = 0
    let bpInGame = 0
    let gameWonByRestador = false
    const POINT_SEQ = [0, 15, 30, 40]

    for (const pt of gamePts) {
      const winner = pt.equipo_ganador

      // Detectar si ANTES de aplicar este punto, el restador tenía BP
      // BP = sacador en desventaja (0-40, 15-40, 30-40, o adv en contra, u ORO/STAR)
      const sacPts  = sacador === 1 ? p1 : p2
      const restPts = sacador === 1 ? p2 : p1
      const isBPMoment = (
        // Situaciones clásicas de BP: sacador en 0,1,2 y restador en 3 (40)
        (sacPts <= 2 && restPts === 3) ||
        // Deuce: el restador tiene ventaja (restPts > sacPts en zona deuce)
        (sacPts >= 3 && restPts >= 3 && restPts > sacPts) ||
        // Punto de Oro o Star Point con sacador en desventaja (igual marcador al llegar al deuce)
        pt.marcador_resultante === 'ORO' && restPts >= sacPts ||
        pt.marcador_resultante === 'STAR' && restPts >= sacPts
      )

      if (isBPMoment) bpInGame++

      // Aplicar punto
      if (winner === 1) p1++; else p2++

      // Chequear si terminó el game (simplificado)
      if (p1 >= 4 && p1 - p2 >= 2) { gameWonByRestador = restador === 1; break }
      if (p2 >= 4 && p2 - p1 >= 2) { gameWonByRestador = restador === 2; break }
      // Punto de oro / star point: 1 punto decide
      if (pt.marcador_resultante === 'ORO' || pt.marcador_resultante === 'STAR') {
        gameWonByRestador = winner === restador; break
      }
    }

    if (bpInGame > 0) {
      resultado[restador].total += bpInGame
      if (gameWonByRestador) {
        resultado[restador].converted += 1
        resultado[restador].failed    += bpInGame - 1
      } else {
        resultado[restador].failed += bpInGame
      }
    }
  }

  return resultado
}

// ─── Calcular Puntos de Oro / Star Points ────────────────────────────────────
function computeGoldPoints(points) {
  const goldPts = points.filter(p =>
    p.marcador_resultante === 'ORO' || p.marcador_resultante === 'STAR'
  )
  return {
    t1: goldPts.filter(p => p.equipo_ganador === 1).length,
    t2: goldPts.filter(p => p.equipo_ganador === 2).length,
    total: goldPts.length,
  }
}

// ─── Player Detail Modal ─────────────────────────────────────────────────────
function PlayerModal({ player, points, onClose }) {
  if (!player) return null

  const playerPts = points.filter(p => p.jugadorId === player.id)
  const total     = playerPts.length
  const winners   = playerPts.filter(p => p.resultado === 'winner').length
  const errForz   = playerPts.filter(p => p.resultado === 'error_forzado').length
  const errNoForz = playerPts.filter(p => p.resultado === 'error_no_forzado').length
  const efectividad = efectividadCorregida(winners, errNoForz)

  const ptosGanados  = points.filter(p => p.jugadorId === player.id && p.equipo_ganador === player.team).length
  const ptosPerdidos = total - ptosGanados

  const shotBreakdown = SHOT_TYPES
    .map(shot => {
      const shotPts  = playerPts.filter(p => p.tipo_golpe === shot.id)
      if (!shotPts.length) return null
      const w   = shotPts.filter(p => p.resultado === 'winner').length
      const enf = shotPts.filter(p => p.resultado === 'error_no_forzado').length
      return {
        name:      shot.label,
        icon:      shot.icon,
        total:     shotPts.length,
        winners:   w,
        errForz:   shotPts.filter(p => p.resultado === 'error_forzado').length,
        errNoForz: enf,
        efectividad: efectividadCorregida(w, enf),
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.total - a.total)

  const initials = player.nombre?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <div className={[styles.modalAvatar, styles[`avatar${player.team}`]].join(' ')}>{initials}</div>
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
              <div className={styles.kpiRow}>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum}>{total}</div>
                  <div className={styles.kpiLabel}>Intervenciones</div>
                </div>
                <div className={[styles.kpi, styles.kpiAccent].join(' ')}>
                  <div className={styles.kpiNum}>{efectividad}%</div>
                  <div className={styles.kpiLabel}>Efectividad*</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: COLOR_WIN }}>{winners}</div>
                  <div className={styles.kpiLabel}>Winners</div>
                </div>
              </div>
              <div className={styles.kpiRow}>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: COLOR_EF }}>{errForz}</div>
                  <div className={styles.kpiLabel}>Err. forzados</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum} style={{ color: COLOR_ENF }}>{errNoForz}</div>
                  <div className={styles.kpiLabel}>Err. no forz.</div>
                </div>
                <div className={styles.kpi}>
                  <div className={styles.kpiNum}>{ptosGanados}</div>
                  <div className={styles.kpiLabel}>Pts. ganados</div>
                </div>
              </div>
              <p className={styles.efectividadNote}>*Efectividad = Winners / (Winners + Err. No Forzados)</p>

              <div className={styles.modalSection}>
                <h4 className={styles.sectionTitle}>Distribución de resultados</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Winner',        value: winners,   color: COLOR_WIN },
                        { name: 'Err. forzado',  value: errForz,   color: COLOR_EF  },
                        { name: 'Err. no forz.', value: errNoForz, color: COLOR_ENF },
                      ].filter(d => d.value > 0)}
                      cx="50%" cy="50%" innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value"
                    >
                      {[COLOR_WIN, COLOR_EF, COLOR_ENF].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip
                      formatter={(val, name) => [`${val} (${total > 0 ? Math.round(val/total*100) : 0}%)`, name]}
                      contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }}
                    />
                    <Legend formatter={val => <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {shotBreakdown.length > 0 && (
                <div className={styles.modalSection}>
                  <h4 className={styles.sectionTitle}>Golpes utilizados</h4>
                  <ResponsiveContainer width="100%" height={Math.max(150, shotBreakdown.length * 28)}>
                    <BarChart data={shotBreakdown} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 9 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={72} />
                      <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                      <Bar dataKey="winners"   name="Winner"       fill={COLOR_WIN} stackId="a" />
                      <Bar dataKey="errForz"   name="Err. forzado" fill={COLOR_EF}  stackId="a" />
                      <Bar dataKey="errNoForz" name="Err. no forz."fill={COLOR_ENF} stackId="a" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>

                  <div className={styles.shotDetailTable}>
                    <div className={styles.shotDetailHeader}>
                      <span>Golpe</span><span>N</span>
                      <span style={{ color: COLOR_WIN }}>W</span>
                      <span style={{ color: COLOR_EF  }}>EF</span>
                      <span style={{ color: COLOR_ENF }}>ENF</span>
                      <span>%</span>
                    </div>
                    {shotBreakdown.map(s => (
                      <div key={s.name} className={styles.shotDetailRow}>
                        <span>{s.icon} {s.name}</span>
                        <span className={styles.shotTotal}>{s.total}</span>
                        <span style={{ color: COLOR_WIN }}>{s.winners}</span>
                        <span style={{ color: COLOR_EF  }}>{s.errForz}</span>
                        <span style={{ color: COLOR_ENF }}>{s.errNoForz}</span>
                        <span style={{ color: '#00d4a0', fontWeight: 700 }}>{s.efectividad}%</span>
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

// ─── Componente: fila de tabla comparativa ────────────────────────────────────
function CompRow({ label, v1, v2, highlight, win1, win2 }) {
  return (
    <div className={[styles.compRow, highlight ? styles.compRowHighlight : ''].join(' ')}>
      <div className={[styles.compVal, win1 ? styles.compWin : ''].join(' ')}>{v1}</div>
      <div className={styles.compLabel}>{label}</div>
      <div className={[styles.compVal, win2 ? styles.compWin : ''].join(' ')}>{v2}</div>
    </div>
  )
}

// ─── Main Stats component ─────────────────────────────────────────────────────
export default function Stats() {
  const { id } = useParams()
  const matchId = Number(id)
  const navigate = useNavigate()

  const [match,       setMatch]       = useState(null)
  const [points,      setPoints]      = useState([])
  const [tab,         setTab]         = useState('resumen')
  const [modalPlayer, setModalPlayer] = useState(null)
  const [posFilter,   setPosFilter]   = useState('todos') // 'todos'|'drive'|'reves'

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

  const t1Name = `${match.equipo1.drive.nombre?.split(' ')[0]} / ${match.equipo1.reves.nombre?.split(' ')[0]}`
  const t2Name = `${match.equipo2.drive.nombre?.split(' ')[0]} / ${match.equipo2.reves.nombre?.split(' ')[0]}`

  // ── Stats globales por equipo ──────────────────────────────────────────────
  const total    = points.length
  const t1Points = points.filter(p => p.equipo_ganador === 1).length
  const t2Points = points.filter(p => p.equipo_ganador === 2).length

  // Puntos donde cada equipo ES el que tiene la intervención (por jugador)
  const t1Ids = [match.equipo1.drive.id, match.equipo1.reves.id]
  const t2Ids = [match.equipo2.drive.id, match.equipo2.reves.id]

  const t1PtsInt = points.filter(p => t1Ids.includes(p.jugadorId))
  const t2PtsInt = points.filter(p => t2Ids.includes(p.jugadorId))

  const t1Winners   = t1PtsInt.filter(p => p.resultado === 'winner').length
  const t1EF        = t1PtsInt.filter(p => p.resultado === 'error_forzado').length
  const t1ENF       = t1PtsInt.filter(p => p.resultado === 'error_no_forzado').length
  const t2Winners   = t2PtsInt.filter(p => p.resultado === 'winner').length
  const t2EF        = t2PtsInt.filter(p => p.resultado === 'error_forzado').length
  const t2ENF       = t2PtsInt.filter(p => p.resultado === 'error_no_forzado').length

  const t1Efect = efectividadCorregida(t1Winners, t1ENF)
  const t2Efect = efectividadCorregida(t2Winners, t2ENF)

  // Break points
  const bpData = computeBreakPoints(points, match.equipoSacadorInicial)
  const bpStr = (bp) => bp ? `${bp.converted}/${bp.total} (${bp.total > 0 ? Math.round(bp.converted/bp.total*100) : 0}%)` : '—'

  // Puntos de Oro
  const goldData = computeGoldPoints(points)

  // ── Stats por golpe (comparativa E1 vs E2) ────────────────────────────────
  const filterPlayers = (team, pos) => {
    if (pos === 'todos') return team === 1 ? t1Ids : t2Ids
    const players = allPlayers.filter(p => p.team === team && (pos === 'todos' || p.pos === pos))
    return players.map(p => p.id)
  }

  const compareShots = SHOT_TYPES.map(shot => {
    const ids1 = filterPlayers(1, posFilter)
    const ids2 = filterPlayers(2, posFilter)
    const pts1 = points.filter(p => p.tipo_golpe === shot.id && ids1.includes(p.jugadorId))
    const pts2 = points.filter(p => p.tipo_golpe === shot.id && ids2.includes(p.jugadorId))
    if (!pts1.length && !pts2.length) return null
    const w1 = pts1.filter(p => p.resultado === 'winner').length
    const w2 = pts2.filter(p => p.resultado === 'winner').length
    const enf1 = pts1.filter(p => p.resultado === 'error_no_forzado').length
    const enf2 = pts2.filter(p => p.resultado === 'error_no_forzado').length
    return {
      name: `${shot.icon} ${shot.label}`,
      id: shot.id,
      t1_winners: w1, t2_winners: w2,
      t1_enf: enf1, t2_enf: enf2,
      t1_ef: pts1.filter(p => p.resultado === 'error_forzado').length,
      t2_ef: pts2.filter(p => p.resultado === 'error_forzado').length,
      t1_total: pts1.length, t2_total: pts2.length,
      t1_efect: efectividadCorregida(w1, enf1),
      t2_efect: efectividadCorregida(w2, enf2),
    }
  }).filter(Boolean)

  // ── PlayerStats ────────────────────────────────────────────────────────────
  const playerStats = allPlayers.map(player => {
    const playerPts = points.filter(p => p.jugadorId === player.id)
    const w   = playerPts.filter(p => p.resultado === 'winner').length
    const enf = playerPts.filter(p => p.resultado === 'error_no_forzado').length
    return { ...player, interventions: playerPts.length, winners: w, errNoForzado: enf,
      efectividad: efectividadCorregida(w, enf) }
  })

  // ── Break Points por game ──────────────────────────────────────────────────
  function getBPTimeline() {
    if (!bpData) return []
    return [
      { name: 'Convertidos', t1: bpData[1].converted, t2: bpData[2].converted },
      { name: 'Fallados',    t1: bpData[1].failed,    t2: bpData[2].failed    },
    ]
  }

  function exportCSV() {
    const rows = [
      ['#', 'Tiempo', 'Jugador', 'Equipo', 'Golpe', 'Resultado', 'Marcador', 'Game#', 'Nota', 'Revisar'],
      ...points.map((p, i) => {
        const player = allPlayers.find(pl => pl.id === p.jugadorId)
        return [i + 1, new Date(p.timestamp).toLocaleTimeString('es-AR'),
          player?.nombre || '?', `Equipo ${player?.team || '?'}`,
          SHOT_TYPES.find(s => s.id === p.tipo_golpe)?.label || p.tipo_golpe,
          RESULT_TYPES.find(r => r.id === p.resultado)?.label || p.resultado,
          p.marcador_resultante, p.gameNumber ?? 0, p.nota || '', p.revisar ? 'Sí' : 'No']
      })
    ]
    const csv  = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `padelstats-${id}-${new Date().toISOString().slice(0,10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const TABS = [
    { id: 'resumen',      label: '📊 Resumen' },
    { id: 'golpes',       label: '🎯 Golpes'  },
    { id: 'breakpoints',  label: '🔑 BPs'     },
    { id: 'jugadores',    label: '👤 Jugadores'},
  ]

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/partido/${id}`)}>←</button>
        <h1>Estadísticas</h1>
        <button className={styles.exportBtn} onClick={exportCSV} title="Exportar CSV">📥</button>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(t => (
          <button key={t.id}
            className={[styles.tabBtn, tab === t.id ? styles.tabActive : ''].join(' ')}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className={styles.main}>

        {/* ═══════════════ RESUMEN ═══════════════ */}
        {tab === 'resumen' && (
          <div className={styles.content}>

            {/* Header VS */}
            <div className={styles.vsHeader}>
              <div className={styles.vsTeam} style={{ color: COLOR_T1 }}>
                <div className={styles.vsScore}>{t1Points}</div>
                <div className={styles.vsName}>{t1Name}</div>
              </div>
              <div className={styles.vsCenter}>
                <div className={styles.vsBadge}>VS</div>
                <div className={styles.vsTotal}>{total} puntos</div>
              </div>
              <div className={styles.vsTeam} style={{ color: COLOR_T2 }}>
                <div className={styles.vsScore}>{t2Points}</div>
                <div className={styles.vsName}>{t2Name}</div>
              </div>
            </div>

            {/* Tabla comparativa */}
            {total > 0 && (
              <div className={styles.compCard}>
                <div className={styles.compHeader}>
                  <div className={styles.compHeaderTeam} style={{ color: COLOR_T1 }}>
                    {match.equipo1.drive.nombre?.split(' ')[0]} / {match.equipo1.reves.nombre?.split(' ')[0]}
                  </div>
                  <div className={styles.compHeaderCenter}>Métrica</div>
                  <div className={styles.compHeaderTeam} style={{ color: COLOR_T2 }}>
                    {match.equipo2.drive.nombre?.split(' ')[0]} / {match.equipo2.reves.nombre?.split(' ')[0]}
                  </div>
                </div>

                <CompRow label="Puntos Ganados"
                  v1={t1Points} v2={t2Points}
                  win1={t1Points > t2Points} win2={t2Points > t1Points} highlight />

                <CompRow label="Winners"
                  v1={t1Winners} v2={t2Winners}
                  win1={t1Winners > t2Winners} win2={t2Winners > t1Winners} />

                <CompRow label="Errores No Forzados"
                  v1={t1ENF} v2={t2ENF}
                  win1={t1ENF < t2ENF} win2={t2ENF < t1ENF} />

                <CompRow label="Errores Forzados"
                  v1={t1EF} v2={t2EF}
                  win1={false} win2={false} />

                <CompRow label="Efectividad (W vs ENF)"
                  v1={`${t1Efect}%`} v2={`${t2Efect}%`}
                  win1={t1Efect > t2Efect} win2={t2Efect > t1Efect} highlight />

                <CompRow label="Break Points"
                  v1={bpData ? bpStr(bpData[1]) : '—'}
                  v2={bpData ? bpStr(bpData[2]) : '—'}
                  win1={bpData && bpData[1].converted > bpData[2].converted}
                  win2={bpData && bpData[2].converted > bpData[1].converted} />

                <CompRow label={`Puntos de Oro ${goldData.total > 0 ? `(${goldData.total})` : ''}`}
                  v1={goldData.t1} v2={goldData.t2}
                  win1={goldData.t1 > goldData.t2} win2={goldData.t2 > goldData.t1} highlight />
              </div>
            )}

            {!match.equipoSacadorInicial && (
              <div className={styles.bpWarning}>
                ⚠️ No se configuró el equipo sacador inicial — los Break Points no están disponibles.
              </div>
            )}

            {/* Pie de distribución */}
            {total > 0 && (
              <div className={styles.chartCard}>
                <h3>Distribución de puntos</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={[
                      { name: t1Name, value: t1Points, color: COLOR_T1 },
                      { name: t2Name, value: t2Points, color: COLOR_T2 },
                    ]} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {[COLOR_T1, COLOR_T2].map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={(val) => [`${val} pts`, '']} contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                    <Legend formatter={val => <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{val}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════ GOLPES ═══════════════ */}
        {tab === 'golpes' && (
          <div className={styles.content}>

            {/* Filtro de posición */}
            <div className={styles.posFilterRow}>
              {['todos', 'drive', 'reves'].map(p => (
                <button key={p}
                  className={[styles.posFilterBtn, posFilter === p ? styles.posFilterActive : ''].join(' ')}
                  onClick={() => setPosFilter(p)}
                >
                  {p === 'todos' ? '🎾 Todos' : p === 'drive' ? '🤜 Drive' : '🤛 Revés'}
                </button>
              ))}
            </div>

            {compareShots.length === 0 ? (
              <div className={styles.empty}>No hay golpes registrados para este filtro.</div>
            ) : (
              <>
                {/* Gráfica comparativa Winners */}
                <div className={styles.chartCard}>
                  <h3>Winners — {t1Name} vs {t2Name}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(220, compareShots.length * 36)}>
                    <BarChart data={compareShots} layout="vertical" margin={{ left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={90} />
                      <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                      <Bar dataKey="t1_winners" name={t1Name} fill={COLOR_T1} radius={[0,4,4,0]} />
                      <Bar dataKey="t2_winners" name={t2Name} fill={COLOR_T2} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Gráfica comparativa ENF */}
                <div className={styles.chartCard}>
                  <h3>Errores No Forzados — {t1Name} vs {t2Name}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(220, compareShots.length * 36)}>
                    <BarChart data={compareShots} layout="vertical" margin={{ left: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis type="number" tick={{ fill: '#64748b', fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#94a3b8', fontSize: 9 }} width={90} />
                      <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                      <Bar dataKey="t1_enf" name={t1Name} fill={COLOR_T1} radius={[0,4,4,0]} />
                      <Bar dataKey="t2_enf" name={t2Name} fill={COLOR_T2} radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tabla de comparación detallada por golpe */}
                <div className={styles.chartCard}>
                  <h3>Detalle por golpe</h3>
                  <div className={styles.shotCompTable}>
                    <div className={styles.shotCompHeader}>
                      <span style={{ color: COLOR_T1 }}>E1</span>
                      <span>Golpe</span>
                      <span style={{ color: COLOR_T2 }}>E2</span>
                    </div>
                    {compareShots.map(s => (
                      <div key={s.id} className={styles.shotCompBlock}>
                        <div className={styles.shotCompName}>{s.name}</div>
                        <div className={styles.shotCompRow}>
                          <div className={styles.shotCompSide}>
                            <span className={styles.shotCompTotal}>{s.t1_total}</span>
                            <span style={{ color: COLOR_WIN }}>W:{s.t1_winners}</span>
                            <span style={{ color: COLOR_ENF }}>ENF:{s.t1_enf}</span>
                            <span className={styles.shotCompPct}>{s.t1_efect}%</span>
                          </div>
                          <div className={styles.shotCompDivider} />
                          <div className={styles.shotCompSide}>
                            <span className={styles.shotCompTotal}>{s.t2_total}</span>
                            <span style={{ color: COLOR_WIN }}>W:{s.t2_winners}</span>
                            <span style={{ color: COLOR_ENF }}>ENF:{s.t2_enf}</span>
                            <span className={styles.shotCompPct}>{s.t2_efect}%</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ BREAK POINTS ═══════════════ */}
        {tab === 'breakpoints' && (
          <div className={styles.content}>
            {!match.equipoSacadorInicial ? (
              <div className={styles.bpWarningLarge}>
                <div className={styles.bpWarningIcon}>⚠️</div>
                <div className={styles.bpWarningTitle}>Sacador no configurado</div>
                <div className={styles.bpWarningText}>
                  Para calcular Break Points necesitás indicar quién sacó primero.
                  Eso se configura al iniciar el partido en la pantalla de captura.
                </div>
              </div>
            ) : !bpData ? (
              <div className={styles.empty}>Sin datos de break points.</div>
            ) : (
              <>
                {/* Tarjetas de BP */}
                <div className={styles.bpCards}>
                  {[1, 2].map(team => {
                    const bp = bpData[team]
                    const pct = bp.total > 0 ? Math.round(bp.converted / bp.total * 100) : 0
                    return (
                      <div key={team} className={[styles.bpCard, styles[`bpCard${team}`]].join(' ')}>
                        <div className={styles.bpCardTeam}>Equipo {team}</div>
                        <div className={styles.bpCardName}>{team === 1 ? t1Name : t2Name}</div>
                        <div className={styles.bpCardMain}>
                          <span className={styles.bpCardConverted}>{bp.converted}</span>
                          <span className={styles.bpCardSlash}>/</span>
                          <span className={styles.bpCardTotal}>{bp.total}</span>
                        </div>
                        <div className={styles.bpCardPct}>{pct}% convertidos</div>
                        <div className={styles.bpCardFailed}>{bp.failed} fallados</div>
                      </div>
                    )
                  })}
                </div>

                {/* Gráfica comparativa */}
                {(bpData[1].total > 0 || bpData[2].total > 0) && (
                  <div className={styles.chartCard}>
                    <h3>Break Points: Convertidos vs Fallados</h3>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={getBPTimeline()}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                        <Tooltip contentStyle={{ background: '#1a2335', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#f1f5f9' }} />
                        <Bar dataKey="t1" name={t1Name} fill={COLOR_T1} radius={[4,4,0,0]} />
                        <Bar dataKey="t2" name={t2Name} fill={COLOR_T2} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Puntos de Oro */}
                <div className={styles.chartCard}>
                  <h3>⭐ Puntos de Oro / Star Points</h3>
                  {goldData.total === 0 ? (
                    <p className={styles.empty}>No hubo puntos de oro en este partido.</p>
                  ) : (
                    <>
                      <div className={styles.goldCards}>
                        {[1, 2].map(team => (
                          <div key={team} className={styles.goldCard}>
                            <div className={styles.goldIcon}>⭐</div>
                            <div className={styles.goldNum}>{team === 1 ? goldData.t1 : goldData.t2}</div>
                            <div className={styles.goldLabel}>{team === 1 ? t1Name : t2Name}</div>
                          </div>
                        ))}
                      </div>
                      <div className={styles.goldNote}>Total de puntos de oro jugados: {goldData.total}</div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══════════════ JUGADORES ═══════════════ */}
        {tab === 'jugadores' && (
          <div className={styles.content}>
            <p className={styles.tapHint}>Tocá un jugador para ver su detalle completo</p>
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
                      <span className={styles.posText}>{p.pos === 'drive' ? '🤜 Drive' : '🤛 Revés'}</span>
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
                    <div className={styles.statNum} style={{ color: COLOR_WIN }}>{p.winners}</div>
                    <div className={styles.statLabel}>Winners</div>
                  </div>
                  <div className={styles.statItem}>
                    <div className={styles.statNum} style={{ color: COLOR_ENF }}>{p.errNoForzado}</div>
                    <div className={styles.statLabel}>Err. no forz.</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {modalPlayer && (
        <PlayerModal
          player={modalPlayer}
          points={points}
          onClose={() => setModalPlayer(null)}
        />
      )}

      <BottomNav matchId={id} />
    </div>
  )
}
