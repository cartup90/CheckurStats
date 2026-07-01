import { pointsToDisplay } from '../../logic/scoring.js'
import styles from './Scoreboard.module.css'

/**
 * topTeam: 1 | 2 — which team number appears at the TOP row of the scoreboard
 *                   (must match which team is at the top of the court)
 */
export default function Scoreboard({ score, match, topTeam = 2 }) {
  if (!score || !match) return null

  const { pastSets, gamesT1, gamesT2, pointsT1, pointsT2, inTiebreak } = score
  const fmt = match?.formato || {}

  // Determine display points for each team
  const pd = inTiebreak
    ? { t1: String(pointsT1), t2: String(pointsT2) }
    : pointsToDisplay(pointsT1, pointsT2, fmt)

  // Ordered display: top team first, bottom team second
  const bottomTeam = topTeam === 1 ? 2 : 1

  const teamData = {
    1: {
      name:   `${match.equipo1.drive.nombre?.split(' ')[0]} / ${match.equipo1.reves.nombre?.split(' ')[0]}`,
      games:  gamesT1,
      points: pd.t1,
      rawPts: pointsT1,
    },
    2: {
      name:   `${match.equipo2.drive.nombre?.split(' ')[0]} / ${match.equipo2.reves.nombre?.split(' ')[0]}`,
      games:  gamesT2,
      points: pd.t2,
      rawPts: pointsT2,
    },
  }

  const top    = teamData[topTeam]
  const bottom = teamData[bottomTeam]

  // For past sets, reorder so top team's games are shown first
  const pastSetsDisplay = pastSets.map(s => ({
    topG:    topTeam    === 1 ? s.g1 : s.g2,
    bottomG: bottomTeam === 1 ? s.g1 : s.g2,
    topWon:  s.winner   === topTeam,
    botWon:  s.winner   === bottomTeam,
  }))

  const topLeading    = top.rawPts    > bottom.rawPts
  const bottomLeading = bottom.rawPts > top.rawPts

  return (
    <div className={styles.scoreboard}>
      {/* TOP TEAM ROW */}
      <div className={[styles.row, styles[`team${topTeam}`]].join(' ')}>
        <span className={styles.teamName}>{top.name}</span>

        {/* Past set games */}
        {pastSetsDisplay.map((s, i) => (
          <span key={i} className={[styles.setNum, s.topWon ? styles.setWinner : ''].join(' ')}>
            {s.topG}
          </span>
        ))}

        {/* Current set games */}
        <span className={styles.curGame}>{top.games}</span>

        {/* Points */}
        <span className={[styles.point, topLeading ? styles.leading : ''].join(' ')}>
          {top.points}
        </span>
      </div>

      {/* BOTTOM TEAM ROW */}
      <div className={[styles.row, styles[`team${bottomTeam}`]].join(' ')}>
        <span className={styles.teamName}>{bottom.name}</span>

        {pastSetsDisplay.map((s, i) => (
          <span key={i} className={[styles.setNum, s.botWon ? styles.setWinner : ''].join(' ')}>
            {s.bottomG}
          </span>
        ))}

        <span className={styles.curGame}>{bottom.games}</span>

        <span className={[styles.point, bottomLeading ? styles.leading : ''].join(' ')}>
          {bottom.points}
        </span>
      </div>

      {inTiebreak && <div className={styles.tbBadge}>TIE-BREAK</div>}
    </div>
  )
}
