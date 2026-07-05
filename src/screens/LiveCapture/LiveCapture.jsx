import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import db from '../../db/database.js'
import { applyPoint, deserializeState, serializeState, getScoreDisplay, SHOT_TYPES, RESULT_TYPES } from '../../logic/scoring.js'
import BottomNav from '../../components/BottomNav.jsx'
import Scoreboard from './Scoreboard.jsx'
import CourtView  from './CourtView.jsx'
import RadialMenu from './RadialMenu.jsx'
import styles from './LiveCapture.module.css'

/**
 * Calcula qué equipo (1 o 2) está sacando actualmente.
 * En pádel el saque alterna cada game, sumando todos los games del partido.
 * @param {number|null} sacadorInicial - equipo que sacó el primer game (1 o 2)
 * @param {number} totalGamesJugados  - total de games completados desde el inicio
 */
function getCurrentServer(sacadorInicial, totalGamesJugados) {
  if (!sacadorInicial) return null
  // Si totalGamesJugados es par  → saca el equipo inicial
  // Si totalGamesJugados es impar → saca el otro equipo
  return totalGamesJugados % 2 === 0 ? sacadorInicial : (sacadorInicial === 1 ? 2 : 1)
}

export default function LiveCapture() {
  const { id } = useParams()
  const navigate = useNavigate()
  const matchId = Number(id)

  const [match,       setMatch]       = useState(null)
  const [gameState,   setGameState]   = useState(null)
  const [historyArr,  setHistoryArr]  = useState([])

  // UI state
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [selectedShot,   setSelectedShot]   = useState(null)
  const [phase,    setPhase]    = useState('player') // 'player' | 'shot' | 'result'
  const [lastPoint, setLastPoint] = useState(null)
  const [finished,  setFinished]  = useState(false)

  // topTeam: which team number (1 or 2) is shown at the TOP of the court & scoreboard.
  const [topTeam, setTopTeam] = useState(2)

  // Sacador tracking
  const [showSacadorModal, setShowSacadorModal] = useState(false)
  const [sacadorModalEditing, setSacadorModalEditing] = useState(false) // true = edición manual
  const [equipoSacadorInicial, setEquipoSacadorInicial] = useState(null)
  // gameNumber: número de game completados hasta ahora en el partido (para tracking de BP)
  const [gameNumber, setGameNumber] = useState(0)

  useEffect(() => { load() }, [matchId])

  async function load() {
    const m = await db.matches.get(matchId)
    if (!m) { navigate('/'); return }
    setMatch(m)
    const state = m.matchState ? deserializeState(m.matchState, []) : null
    setGameState(state)
    setHistoryArr(state?.history || [])
    if (m.estado === 'finalizado') setFinished(true)

    // Calcular gameNumber actual contando los games completados desde los puntos guardados
    const pts = await db.points.where('matchId').equals(matchId).sortBy('timestamp')
    if (pts.length > 0) {
      const maxGame = pts.reduce((max, p) => Math.max(max, p.gameNumber ?? 0), 0)
      // Si el último punto tiene gameNumber, usarlo; si no, reconstruir
      const lastPt = pts[pts.length - 1]
      setGameNumber(lastPt.gameNumber ?? maxGame)
    }

    // Sacador
    if (m.equipoSacadorInicial) {
      setEquipoSacadorInicial(m.equipoSacadorInicial)
    } else if (m.estado === 'en_curso' || !m.matchState) {
      // Solo pedir sacador si el partido no tiene puntos aún
      if (!pts.length) setShowSacadorModal(true)
    }
  }

  async function handleSelectSacador(team) {
    setEquipoSacadorInicial(team)
    setShowSacadorModal(false)
    setSacadorModalEditing(false)
    await db.matches.update(matchId, { equipoSacadorInicial: team })
  }

  function handleOpenSacadorEdit() {
    setSacadorModalEditing(true)
    setShowSacadorModal(true)
  }

  function handlePlayerTap(player) {
    setSelectedPlayer(player)
    setSelectedShot(null)
    setPhase('shot')
  }

  function handleShotSelect(shot) {
    setSelectedShot(shot)
    setPhase('result')
  }

  function handleBack() {
    if (phase === 'result') { setPhase('shot'); setSelectedShot(null) }
    else if (phase === 'shot') { setPhase('player'); setSelectedPlayer(null) }
  }

  // Toggle court sides (cambio de cancha)
  function handleSideSwap() {
    setTopTeam(t => t === 1 ? 2 : 1)
  }

  async function handleResultSelect(result) {
    if (!selectedPlayer || !selectedShot || !gameState) return

    const playerTeam = selectedPlayer.team
    const scoringTeam = result.id === 'winner' ? playerTeam : (playerTeam === 1 ? 2 : 1)

    const newState = applyPoint(gameState, scoringTeam)
    const history  = [...historyArr, JSON.parse(JSON.stringify({ ...gameState, history: [] }))]
    const score    = getScoreDisplay(newState)

    // Detectar si se completó un game comparando games del set actual
    const prevGames = gameState.currentSet.g1 + gameState.currentSet.g2
    const newGames  = newState.currentSet.g1  + newState.currentSet.g2
    // También puede haberse cerrado un set → comparar total de sets
    const prevSets  = gameState.sets.length
    const newSets   = newState.sets.length
    const gameCompleted = newGames > prevGames || newSets > prevSets

    const currentGameNumber = gameNumber
    const nextGameNumber    = gameCompleted ? gameNumber + 1 : gameNumber

    await db.points.add({
      matchId,
      gameId:              0,
      setId:               0,
      timestamp:           new Date().toISOString(),
      jugadorId:           selectedPlayer.id,
      tipo_golpe:          selectedShot.id,
      resultado:           result.id,
      equipo_ganador:      scoringTeam,
      marcador_resultante: score.gamePoints,
      gameNumber:          currentGameNumber,
      nota:                '',
      revisar:             false,
    })

    const isFinished = !!newState.matchWinner

    await db.matches.update(matchId, {
      matchState: serializeState(newState),
      estado:     isFinished ? 'finalizado' : 'en_curso',
    })

    setGameState({ ...newState, history: [] })
    setHistoryArr(history)
    setLastPoint({ player: selectedPlayer, shot: selectedShot, result, team: scoringTeam })
    setSelectedPlayer(null)
    setSelectedShot(null)
    setPhase('player')
    if (gameCompleted) setGameNumber(nextGameNumber)
    if (isFinished) setFinished(true)
  }

  async function handleUndo() {
    if (!historyArr.length) return
    const prev       = historyArr[historyArr.length - 1]
    const newHistory = historyArr.slice(0, -1)

    const lastPt = await db.points.where('matchId').equals(matchId).last()
    if (lastPt) {
      // Si deshacemos y el punto tenía un gameNumber menor, volver atrás
      if (lastPt.gameNumber !== undefined && lastPt.gameNumber < gameNumber) {
        setGameNumber(lastPt.gameNumber)
      }
      await db.points.delete(lastPt.id)
    }

    await db.matches.update(matchId, {
      matchState: serializeState(prev),
      estado:     'en_curso',
    })

    setGameState({ ...prev, history: [] })
    setHistoryArr(newHistory)
    setLastPoint(null)
    setFinished(false)
    setPhase('player')
    setSelectedPlayer(null)
    setSelectedShot(null)
  }

  async function finishMatch() {
    await db.matches.update(matchId, { estado: 'finalizado' })
    navigate('/')
  }

  if (!match || !gameState) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
      </div>
    )
  }

  const score = getScoreDisplay(gameState)
  const shots = selectedPlayer
    ? SHOT_TYPES.filter(s => s.pos.includes(selectedPlayer.pos))
    : []

  // Equipo que saca el game actual
  const currentServer = getCurrentServer(equipoSacadorInicial, gameNumber)

  return (
    <div className={styles.page}>
      {/* Modal: selección de equipo sacador */}
      {showSacadorModal && (
        <div className={styles.sacadorOverlay}>
          <div className={styles.sacadorModal}>
            <div className={styles.sacadorIcon}>🎾</div>
            <h2 className={styles.sacadorTitle}>
              {sacadorModalEditing ? '¿Quién saca este game?' : '¿Quién saca primero?'}
            </h2>
            <p className={styles.sacadorSub}>
              {sacadorModalEditing
                ? 'Seleccioná el equipo sacador actual. El sistema recalculará desde aquí.'
                : 'Esto permite calcular los Break Points correctamente'}
            </p>
            <div className={styles.sacadorBtns}>
              <button
                className={[styles.sacadorBtn, styles.sacadorBtn1].join(' ')}
                onClick={() => {
                  if (sacadorModalEditing) {
                    // Recalcular sacador inicial para que el equipo 1 saque ahora
                    const newInicial = gameNumber % 2 === 0 ? 1 : 2
                    handleSelectSacador(newInicial)
                  } else {
                    handleSelectSacador(1)
                  }
                }}
              >
                <span className={styles.sacadorBtnLabel}>Equipo 1</span>
                <span className={styles.sacadorBtnNames}>
                  {match.equipo1.drive.nombre?.split(' ')[0]} / {match.equipo1.reves.nombre?.split(' ')[0]}
                </span>
              </button>
              <button
                className={[styles.sacadorBtn, styles.sacadorBtn2].join(' ')}
                onClick={() => {
                  if (sacadorModalEditing) {
                    // Recalcular sacador inicial para que el equipo 2 saque ahora
                    const newInicial = gameNumber % 2 === 0 ? 2 : 1
                    handleSelectSacador(newInicial)
                  } else {
                    handleSelectSacador(2)
                  }
                }}
              >
                <span className={styles.sacadorBtnLabel}>Equipo 2</span>
                <span className={styles.sacadorBtnNames}>
                  {match.equipo2.drive.nombre?.split(' ')[0]} / {match.equipo2.reves.nombre?.split(' ')[0]}
                </span>
              </button>
            </div>
            {sacadorModalEditing && (
              <button
                className={styles.sacadorCancelBtn}
                onClick={() => { setShowSacadorModal(false); setSacadorModalEditing(false) }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scoreboard — order matches court (top team on top row) */}
      <Scoreboard
        score={score}
        match={match}
        topTeam={topTeam}
        servingTeam={currentServer}
        onEditSacador={!finished ? handleOpenSacadorEdit : undefined}
      />

      {/* Court */}
      <div className={styles.courtArea}>
        <CourtView
          match={match}
          selectedPlayer={selectedPlayer}
          phase={phase}
          topTeam={topTeam}
          onPlayerTap={handlePlayerTap}
        />

        {/* Cambio de cancha button — inside courtArea, top-right corner */}
        {!finished && (
          <button
            className={styles.swapBtn}
            onClick={handleSideSwap}
            title="Cambio de cancha"
            aria-label="Cambio de cancha"
          >
            ⇅
          </button>
        )}
      </div>

      {/* Interaction panel */}
      <div className={styles.panel}>
        {phase === 'player' && (
          <div className={styles.phasePlayer}>
            {finished ? (
              <div className={styles.finishedBanner}>
                <div className={styles.finishedTitle}>🏆 Partido terminado</div>
                <div className={styles.finishedSub}>
                  Ganó el equipo {gameState.matchWinner === 1
                    ? `${match.equipo1.drive.nombre} / ${match.equipo1.reves.nombre}`
                    : `${match.equipo2.drive.nombre} / ${match.equipo2.reves.nombre}`}
                </div>
                <button className={styles.finishBtn} onClick={finishMatch}>
                  Ver estadísticas →
                </button>
              </div>
            ) : (
              <>
                <p className={styles.hint}>Tocá al jugador que definió el punto</p>
                {lastPoint && (
                  <div className={styles.lastPoint}>
                    <span>Último: {lastPoint.player.nombre} · {lastPoint.shot.label} · {lastPoint.result.label}</span>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {phase === 'shot' && selectedPlayer && (
          <div className={styles.phaseShot}>
            <div className={styles.phaseHeader}>
              <button className={styles.backBtn} onClick={handleBack}>←</button>
              <span className={styles.phaseTitle}>
                {selectedPlayer.nombre} — ¿Qué golpe?
              </span>
            </div>
            <div className={styles.shotsGrid}>
              {shots.map(shot => (
                <button
                  key={shot.id}
                  className={[styles.shotBtn, 'ripple-btn'].join(' ')}
                  onClick={() => handleShotSelect(shot)}
                >
                  <span className={styles.shotIcon}>{shot.icon}</span>
                  <span className={styles.shotLabel}>{shot.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'result' && selectedShot && (
          <div className={styles.phaseResult}>
            <div className={styles.phaseHeader}>
              <button className={styles.backBtn} onClick={handleBack}>←</button>
              <span className={styles.phaseTitle}>
                {selectedShot.icon} {selectedShot.label} — ¿Resultado?
              </span>
            </div>
            <div className={styles.resultsRow}>
              {RESULT_TYPES.map(r => (
                <button
                  key={r.id}
                  className={[styles.resultBtn, 'ripple-btn'].join(' ')}
                  style={{ '--result-color': r.color }}
                  onClick={() => handleResultSelect(r)}
                >
                  {r.id === 'winner'           && <span className={styles.resultIcon}>⚡</span>}
                  {r.id === 'error_forzado'    && <span className={styles.resultIcon}>💢</span>}
                  {r.id === 'error_no_forzado' && <span className={styles.resultIcon}>❌</span>}
                  <span className={styles.resultLabel}>{r.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Undo button */}
      {historyArr.length > 0 && !finished && (
        <button className={styles.undoBtn} onClick={handleUndo} aria-label="Deshacer último punto">
          ↩ Deshacer
        </button>
      )}

      <BottomNav matchId={id} />
    </div>
  )
}
