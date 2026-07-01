// ============================================================
//  PadelStats — Motor de puntuación
//  Soporta: punto de oro, star point, tie-break
// ============================================================

export const SHOT_TYPES = [
  { id: 'saque',          label: 'Saque',          icon: '🎾', pos: ['drive','reves'] },
  { id: 'resto',          label: 'Resto',          icon: '↩️', pos: ['drive','reves'] },
  { id: 'drive_fondo',    label: 'Drive fondo',    icon: '🎯', pos: ['drive','reves'] },
  { id: 'reves_fondo',    label: 'Revés fondo',    icon: '🔁', pos: ['drive','reves'] },
  { id: 'volea_derecha',  label: 'Volea D',        icon: '🤜', pos: ['drive','reves'] },
  { id: 'volea_reves',    label: 'Volea R',        icon: '🤛', pos: ['drive','reves'] },
  { id: 'bandeja',        label: 'Bandeja',        icon: '🏓', pos: ['drive','reves'] },
  { id: 'vibora',         label: 'Víbora',         icon: '🐍', pos: ['drive','reves'] },
  { id: 'remate',         label: 'Remate',         icon: '💥', pos: ['drive','reves'] },
  { id: 'remate_x3',      label: 'X3',             icon: '🔱', pos: ['drive','reves'] },
  { id: 'remate_x4',      label: 'X4',             icon: '☄️', pos: ['drive','reves'] },
  { id: 'globo',          label: 'Globo',          icon: '🌕', pos: ['drive','reves'] },
  { id: 'bajada',         label: 'Bajada de pared',icon: '⬇️', pos: ['drive','reves'] },
  { id: 'dejada',         label: 'Dejada',         icon: '🪶', pos: ['drive','reves'] },
  { id: 'chiquita',       label: 'Chiquita',       icon: '🤏', pos: ['drive','reves'] },
  { id: 'contrapared',    label: 'Contrapared',    icon: '🔄', pos: ['drive','reves'] },
  { id: 'salida_pared',   label: 'Salida pared',   icon: '🧱', pos: ['drive','reves'] },
  { id: 'doble_pared',    label: 'Doble pared',    icon: '⬅️', pos: ['drive','reves'] },
  { id: 'rulo',           label: 'Rulo',           icon: '🌀', pos: ['drive','reves'] },
  { id: 'gancho',         label: 'Gancho',         icon: '🪝', pos: ['drive','reves'] },
  { id: 'recuperacion',   label: 'Recuperación',   icon: '🏃', pos: ['drive','reves'] },
]

export const RESULT_TYPES = [
  { id: 'winner',          label: 'Winner',         color: '#10b981' },
  { id: 'error_forzado',   label: 'Error forzado',  color: '#f59e0b' },
  { id: 'error_no_forzado',label: 'Error no forz.', color: '#ef4444' },
]

// Secuencia de puntos de un game normal
const POINT_SEQUENCE = [0, 15, 30, 40]

/**
 * Convierte puntos internos (0,1,2,3+) a display string
 */
export function pointsToDisplay(p1, p2, formato) {
  const isDeuce = p1 >= 3 && p2 >= 3

  if (!isDeuce) {
    return {
      t1: POINT_SEQUENCE[Math.min(p1, 3)].toString(),
      t2: POINT_SEQUENCE[Math.min(p2, 3)].toString(),
    }
  }

  // PUNTO DE ORO: en el primer deuce (40-40) se juega punto de oro directo
  if (formato?.puntoDeOro) {
    return { t1: 'ORO', t2: 'ORO' }
  }

  // STAR POINT: a partir del 3er deuce se juega punto de oro
  const deuces = Math.min(p1, p2) - 3
  if (formato?.starPoint && deuces >= 2) {
    return { t1: 'STAR', t2: 'STAR' }
  }

  // DEUCE clásico
  if (p1 === p2) return { t1: 'Deuce', t2: 'Deuce' }
  return p1 > p2
    ? { t1: 'Adv', t2: '' }
    : { t1: '', t2: 'Adv' }
}

/**
 * Aplica un punto ganado por equipo (1 o 2) al estado actual del game.
 * Devuelve { newPoints, gameWinner: 1|2|null }
 */
function applyPointToGame(p1, p2, team, formato) {
  let np1 = p1, np2 = p2

  if (team === 1) np1++; else np2++

  const isDeuce = np1 >= 3 && np2 >= 3

  if (!isDeuce) {
    if (np1 >= 4) return { np1, np2, gameWinner: 1 }
    if (np2 >= 4) return { np1, np2, gameWinner: 2 }
    return { np1, np2, gameWinner: null }
  }

  // Punto de oro: primer 40-40 → quien gane el siguiente punto gana el game
  if (formato?.puntoDeOro) {
    if (np1 > np2) return { np1, np2, gameWinner: 1 }
    if (np2 > np1) return { np1, np2, gameWinner: 2 }
    return { np1, np2, gameWinner: null }
  }

  // Star point: a partir del 3er deuce → punto de oro
  if (formato?.starPoint) {
    const deuces = Math.min(np1, np2) - 3
    if (deuces >= 2) {
      if (np1 > np2) return { np1, np2, gameWinner: 1 }
      if (np2 > np1) return { np1, np2, gameWinner: 2 }
      return { np1, np2, gameWinner: null }
    }
  }

  // Deuce clásico: necesita ventaja de 2
  const diff = np1 - np2
  if (diff >= 2) return { np1, np2, gameWinner: 1 }
  if (diff <= -2) return { np1, np2, gameWinner: 2 }
  return { np1, np2, gameWinner: null }
}

/**
 * Aplica un punto ganado por equipo al estado del SET.
 * Devuelve { newGames, tiebreak, setWinner }
 */
function applyGameToSet(g1, g2, team, formato) {
  let ng1 = g1, ng2 = g2
  if (team === 1) ng1++; else ng2++

  const maxGames = formato?.gamesPerSet || 6
  const useTiebreak = formato?.tiebreak !== false

  // Set ganado sin tiebreak
  if (ng1 >= maxGames && ng1 - ng2 >= 2) return { ng1, ng2, tiebreak: false, setWinner: 1 }
  if (ng2 >= maxGames && ng2 - ng1 >= 2) return { ng1, ng2, tiebreak: false, setWinner: 2 }

  // Tiebreak
  if (useTiebreak && ng1 === maxGames && ng2 === maxGames) {
    return { ng1, ng2, tiebreak: true, setWinner: null }
  }

  return { ng1, ng2, tiebreak: false, setWinner: null }
}

/**
 * Aplica un punto de tiebreak ganado por equipo.
 * Devuelve { newTbPoints, tbWinner }
 */
function applyTiebreakPoint(tb1, tb2, team) {
  let nt1 = tb1, nt2 = tb2
  if (team === 1) nt1++; else nt2++

  if (nt1 >= 7 && nt1 - nt2 >= 2) return { nt1, nt2, tbWinner: 1 }
  if (nt2 >= 7 && nt2 - nt1 >= 2) return { nt1, nt2, tbWinner: 2 }
  return { nt1, nt2, tbWinner: null }
}

/**
 * Estado inicial de un partido
 */
export function createInitialState(matchConfig) {
  return {
    sets:        [],          // [{g1, g2, tiebreak, tbPoints:[tb1,tb2], winner}]
    currentSet:  { g1: 0, g2: 0, tiebreak: false, tbPoints: [0, 0] },
    currentGame: { p1: 0, p2: 0 },
    matchWinner: null,
    history:     [],          // array de estados anteriores para undo
    formato:     matchConfig?.formato || {},
    setsToWin:   Math.ceil((matchConfig?.formato?.cantSets || 3) / 2),
  }
}

/**
 * Aplica un punto (team = 1 | 2) al estado completo del partido.
 * Returns new state (inmutable).
 */
export function applyPoint(state, team) {
  // Clonar estado
  const s = JSON.parse(JSON.stringify(state))
  s.history.push(JSON.parse(JSON.stringify({ ...s, history: [] })))

  const { formato, setsToWin } = s

  if (s.matchWinner) return s // partido terminado

  const inTiebreak = s.currentSet.tiebreak

  if (inTiebreak) {
    // Tiebreak
    const [tb1, tb2] = s.currentSet.tbPoints
    const { nt1, nt2, tbWinner } = applyTiebreakPoint(tb1, tb2, team)
    s.currentSet.tbPoints = [nt1, nt2]

    if (tbWinner) {
      // El tiebreak termina → el set también
      const winner = tbWinner
      s.sets.push({ ...s.currentSet, winner, tbPoints: [nt1, nt2] })
      s.currentSet = { g1: 0, g2: 0, tiebreak: false, tbPoints: [0, 0] }
      s.currentGame = { p1: 0, p2: 0 }

      // Chequear match winner
      const setsW1 = s.sets.filter(st => st.winner === 1).length
      const setsW2 = s.sets.filter(st => st.winner === 2).length
      if (setsW1 >= setsToWin) s.matchWinner = 1
      if (setsW2 >= setsToWin) s.matchWinner = 2
    }
  } else {
    // Game normal
    const { p1, p2 } = s.currentGame
    const { np1, np2, gameWinner } = applyPointToGame(p1, p2, team, formato)
    s.currentGame = { p1: np1, p2: np2 }

    if (gameWinner) {
      // Game terminado → actualizar set
      const { g1, g2 } = s.currentSet
      const { ng1, ng2, tiebreak, setWinner } = applyGameToSet(g1, g2, gameWinner, formato)
      s.currentSet = { g1: ng1, g2: ng2, tiebreak, tbPoints: [0, 0] }
      s.currentGame = { p1: 0, p2: 0 }

      if (setWinner) {
        s.sets.push({ g1: ng1, g2: ng2, tiebreak: false, tbPoints: [0, 0], winner: setWinner })
        s.currentSet = { g1: 0, g2: 0, tiebreak: false, tbPoints: [0, 0] }

        const setsW1 = s.sets.filter(st => st.winner === 1).length
        const setsW2 = s.sets.filter(st => st.winner === 2).length
        if (setsW1 >= setsToWin) s.matchWinner = 1
        if (setsW2 >= setsToWin) s.matchWinner = 2
      }
    }
  }

  return s
}

/**
 * Deshace el último punto.
 */
export function undoLastPoint(state) {
  if (!state.history || state.history.length === 0) return state
  const prev = state.history[state.history.length - 1]
  return { ...prev, history: state.history.slice(0, -1) }
}

/**
 * Serializa el estado para guardarlo en IndexedDB
 */
export function serializeState(state) {
  return JSON.stringify({ ...state, history: [] })
}

export function deserializeState(str, history = []) {
  return { ...JSON.parse(str), history }
}

/**
 * Obtiene el marcador actual como string legible
 */
export function getScoreDisplay(state) {
  const { currentGame, currentSet, sets, formato } = state
  const setStr = sets.map(s => `${s.g1}-${s.g2}`).join('  ')

  let gamePoints
  if (currentSet.tiebreak) {
    const [tb1, tb2] = currentSet.tbPoints
    gamePoints = `${tb1} - ${tb2} (TB)`
  } else {
    const d = pointsToDisplay(currentGame.p1, currentGame.p2, formato)
    gamePoints = d.t1 === d.t2 ? d.t1 : `${d.t1} - ${d.t2}`
  }

  return {
    sets: setStr,
    currentSetGames: `${currentSet.g1} - ${currentSet.g2}`,
    gamePoints,
    pointsT1: currentSet.tiebreak ? currentSet.tbPoints[0] : currentGame.p1,
    pointsT2: currentSet.tiebreak ? currentSet.tbPoints[1] : currentGame.p2,
    gamesT1:  currentSet.g1,
    gamesT2:  currentSet.g2,
    pastSets: sets,
    inTiebreak: currentSet.tiebreak,
  }
}
