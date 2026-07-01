import Dexie from 'dexie'

export const db = new Dexie('PadelStatsDB')

db.version(1).stores({
  players: '++id, nombre, apodo, club, createdAt',
  matches: '++id, fecha, estado, equipo1, equipo2, formato, currentSet, currentGame, createdAt',
  sets:    '++id, matchId, numero, games_t1, games_t2, tiebreak',
  games:   '++id, setId, matchId, numero, puntos_t1, puntos_t2, winner_team',
  points:  '++id, gameId, setId, matchId, timestamp, jugadorId, tipo_golpe, resultado, equipo_ganador, marcador_resultante, nota, revisar'
})

// Helper: get all data for a match in one call
export async function getMatchFull(matchId) {
  const id = Number(matchId)
  const match   = await db.matches.get(id)
  const sets    = await db.sets.where('matchId').equals(id).sortBy('numero')
  const games   = await db.games.where('matchId').equals(id).sortBy('numero')
  const points  = await db.points.where('matchId').equals(id).sortBy('timestamp')
  return { match, sets, games, points }
}

export default db
