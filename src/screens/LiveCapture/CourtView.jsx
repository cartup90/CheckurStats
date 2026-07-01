import styles from './CourtView.module.css'

// Absolute positions on the court (% of container)
// "top" zone: facing DOWN → player's right = screen LEFT
// "bottom" zone: facing UP → player's right = screen RIGHT
const POS = {
  'top-drive':    { top: '28%', left: '28%' }, // top team Drive: their right when facing down = screen LEFT
  'top-reves':    { top: '28%', left: '72%' }, // top team Revés: their left when facing down = screen RIGHT
  'bottom-drive': { top: '72%', left: '72%' }, // bottom team Drive: their right when facing up = screen RIGHT
  'bottom-reves': { top: '72%', left: '28%' }, // bottom team Revés: their left when facing up = screen LEFT
}

/**
 * topTeam: 1 | 2 — which team number is at the TOP of the court.
 *   Default 2 → E2 top, E1 bottom.
 */
export default function CourtView({ match, selectedPlayer, phase, topTeam = 2, onPlayerTap }) {
  if (!match) return null

  const bottomTeam = topTeam === 1 ? 2 : 1

  const teamPlayers = {
    1: [
      { ...match.equipo1.drive, team: 1, pos: 'drive' },
      { ...match.equipo1.reves, team: 1, pos: 'reves' },
    ],
    2: [
      { ...match.equipo2.drive, team: 2, pos: 'drive' },
      { ...match.equipo2.reves, team: 2, pos: 'reves' },
    ],
  }

  const players = [
    { ...teamPlayers[topTeam][0],    zone: 'top',    posKey: 'top-drive'    },
    { ...teamPlayers[topTeam][1],    zone: 'top',    posKey: 'top-reves'    },
    { ...teamPlayers[bottomTeam][0], zone: 'bottom', posKey: 'bottom-drive' },
    { ...teamPlayers[bottomTeam][1], zone: 'bottom', posKey: 'bottom-reves' },
  ]

  return (
    <div className={styles.court}>
      {/* Court SVG */}
      <svg className={styles.courtSvg} viewBox="0 0 300 220" preserveAspectRatio="xMidYMid meet">
        <rect x="10" y="10" width="280" height="200" rx="4" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5"/>
        <line x1="10" y1="110" x2="290" y2="110" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeDasharray="4 3"/>
        <line x1="90"  y1="10"  x2="90"  y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <line x1="210" y1="10"  x2="210" y2="110" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <line x1="90"  y1="110" x2="90"  y2="210" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <line x1="210" y1="110" x2="210" y2="210" stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>
        <line x1="150" y1="10"  x2="150" y2="210" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
        <text x="150" y="107" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="8" fontFamily="Inter,sans-serif" fontWeight="600">RED</text>
      </svg>

      {/* Team labels — follow topTeam */}
      <div className={[styles.courtTeamLabel, styles.labelTop, styles[`color${topTeam}`]].join(' ')}>
        E{topTeam}
      </div>
      <div className={[styles.courtTeamLabel, styles.labelBottom, styles[`color${bottomTeam}`]].join(' ')}>
        E{bottomTeam}
      </div>

      {/* Players */}
      {players.map(p => (
        <PlayerDot
          key={`${p.team}-${p.pos}`}
          player={p}
          position={POS[p.posKey]}
          isSelected={selectedPlayer?.id === p.id && selectedPlayer?.team === p.team}
          isActive={phase === 'player'}
          onTap={() => phase === 'player' && onPlayerTap(p)}
        />
      ))}
    </div>
  )
}

function PlayerDot({ player, position, isSelected, isActive, onTap }) {
  const initials = player.nombre
    ? player.nombre.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <button
      className={[
        styles.playerDot,
        styles[`team${player.team}`],
        isSelected ? styles.selected : '',
        isActive   ? styles.tappable : '',
      ].join(' ')}
      style={{ top: position.top, left: position.left }}
      onClick={onTap}
      disabled={!isActive}
    >
      <span className={styles.initials}>{initials}</span>
      <span className={styles.playerName}>{player.nombre?.split(' ')[0]}</span>
      <span className={styles.posLabel}>{player.pos === 'drive' ? 'D' : 'R'}</span>
    </button>
  )
}
