import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import db from '../../db/database.js'
import { createInitialState, serializeState } from '../../logic/scoring.js'
import Button from '../../components/Button.jsx'
import styles from './NewMatch.module.css'

const EMPTY_PLAYER = { id: null, nombre: '' }

export default function NewMatch() {
  const [players, setPlayers] = useState([])
  const [formato, setFormato] = useState({
    cantSets:    3,
    puntoDeOro:  true,
    starPoint:   false,
    tiebreak:    true,
    gamesPerSet: 6,
  })
  const [equipo1, setEquipo1] = useState({ drive: EMPTY_PLAYER, reves: EMPTY_PLAYER })
  const [equipo2, setEquipo2] = useState({ drive: EMPTY_PLAYER, reves: EMPTY_PLAYER })
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    db.players.orderBy('nombre').toArray().then(setPlayers)
  }, [])

  function setPlayer(team, pos, playerId) {
    const player = players.find(p => p.id === Number(playerId)) || EMPTY_PLAYER
    if (team === 1) setEquipo1(e => ({ ...e, [pos]: player }))
    else            setEquipo2(e => ({ ...e, [pos]: player }))
  }

  function setFormato_(key, val) {
    setFormato(f => {
      const next = { ...f, [key]: val }
      // starPoint y puntoDeOro son excluyentes
      if (key === 'starPoint' && val)   next.puntoDeOro = false
      if (key === 'puntoDeOro' && val)  next.starPoint  = false
      return next
    })
  }

  async function createQuickPlayer(name, team, pos) {
    if (!name.trim()) return
    const id = await db.players.add({ nombre: name.trim(), apodo: '', club: '', createdAt: new Date().toISOString() })
    const player = { id, nombre: name.trim() }
    if (team === 1) setEquipo1(e => ({ ...e, [pos]: player }))
    else            setEquipo2(e => ({ ...e, [pos]: player }))
    const all = await db.players.orderBy('nombre').toArray()
    setPlayers(all)
  }

  const canStart =
    equipo1.drive.id && equipo1.reves.id &&
    equipo2.drive.id && equipo2.reves.id &&
    equipo1.drive.id !== equipo1.reves.id &&
    equipo2.drive.id !== equipo2.reves.id &&
    new Set([equipo1.drive.id, equipo1.reves.id, equipo2.drive.id, equipo2.reves.id]).size === 4

  async function startMatch() {
    if (!canStart || creating) return
    setCreating(true)
    const matchConfig = { formato }
    const state = createInitialState(matchConfig)

    const matchId = await db.matches.add({
      fecha:      new Date().toISOString(),
      createdAt:  new Date().toISOString(),
      estado:     'en_curso',
      equipo1,
      equipo2,
      formato,
      matchState: serializeState(state),
    })
    navigate(`/partido/${matchId}`)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/')}>←</button>
        <h1>Nuevo partido</h1>
      </header>

      <main className={styles.main}>
        {/* Teams */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Equipos</h2>

          <div className={styles.teamsGrid}>
            <TeamSetup
              label="Equipo 1"
              teamColor="team1"
              team={equipo1}
              players={players}
              setPlayer={(pos, id) => setPlayer(1, pos, id)}
              onQuickCreate={(name, pos) => createQuickPlayer(name, 1, pos)}
            />
            <div className={styles.vsDivider}>VS</div>
            <TeamSetup
              label="Equipo 2"
              teamColor="team2"
              team={equipo2}
              players={players}
              setPlayer={(pos, id) => setPlayer(2, pos, id)}
              onQuickCreate={(name, pos) => createQuickPlayer(name, 2, pos)}
            />
          </div>
        </section>

        {/* Format */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Formato</h2>
          <div className={styles.formatGrid}>
            <div className={styles.formatItem}>
              <label>Sets</label>
              <div className={styles.segmented}>
                {[1, 3, 5].map(n => (
                  <button
                    key={n}
                    className={[styles.seg, formato.cantSets === n ? styles.segActive : ''].join(' ')}
                    onClick={() => setFormato_(  'cantSets', n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className={styles.formatItem}>
              <label>Juegos por set</label>
              <div className={styles.segmented}>
                {[4, 6].map(n => (
                  <button
                    key={n}
                    className={[styles.seg, formato.gamesPerSet === n ? styles.segActive : ''].join(' ')}
                    onClick={() => setFormato_('gamesPerSet', n)}
                  >{n}</button>
                ))}
              </div>
            </div>

            <div className={styles.toggleItem}>
              <div>
                <div className={styles.toggleLabel}>Tie-break</div>
                <div className={styles.toggleDesc}>En caso de empate a {formato.gamesPerSet}-{formato.gamesPerSet}</div>
              </div>
              <Toggle value={formato.tiebreak} onChange={v => setFormato_('tiebreak', v)} />
            </div>

            <div className={styles.toggleItem}>
              <div>
                <div className={styles.toggleLabel}>Punto de oro</div>
                <div className={styles.toggleDesc}>Al llegar a 40-40, punto decisivo directo</div>
              </div>
              <Toggle value={formato.puntoDeOro} onChange={v => setFormato_('puntoDeOro', v)} />
            </div>

            <div className={styles.toggleItem}>
              <div>
                <div className={styles.toggleLabel}>Star Point</div>
                <div className={styles.toggleDesc}>Punto de oro a partir del 3er deuce</div>
              </div>
              <Toggle value={formato.starPoint} onChange={v => setFormato_('starPoint', v)} />
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={startMatch}
          disabled={!canStart || creating}
        >
          {creating ? 'Iniciando...' : '🎾 Iniciar partido'}
        </Button>
      </footer>
    </div>
  )
}

// Sub-component: team selector
function TeamSetup({ label, teamColor, team, players, setPlayer, onQuickCreate }) {
  const [quickDrive, setQuickDrive] = useState('')
  const [quickReves, setQuickReves] = useState('')

  return (
    <div className={[styles.teamBox, styles[teamColor]].join(' ')}>
      <div className={styles.teamLabel}>{label}</div>

      <PlayerSelector
        pos="drive"
        label="Drive (Derecha)"
        value={team.drive.id}
        players={players}
        onChange={id => setPlayer('drive', id)}
        quickValue={quickDrive}
        onQuickChange={setQuickDrive}
        onQuickCreate={() => { onQuickCreate(quickDrive, 'drive'); setQuickDrive('') }}
      />
      <PlayerSelector
        pos="reves"
        label="Revés (Izquierda)"
        value={team.reves.id}
        players={players}
        onChange={id => setPlayer('reves', id)}
        quickValue={quickReves}
        onQuickChange={setQuickReves}
        onQuickCreate={() => { onQuickCreate(quickReves, 'reves'); setQuickReves('') }}
      />
    </div>
  )
}

function PlayerSelector({ label, value, players, onChange, quickValue, onQuickChange, onQuickCreate }) {
  return (
    <div className={styles.playerSelector}>
      <div className={styles.posLabel}>{label}</div>
      <select value={value || ''} onChange={e => onChange(e.target.value)}>
        <option value="">— Seleccionar —</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>{p.nombre}{p.apodo ? ` (${p.apodo})` : ''}</option>
        ))}
      </select>
      <div className={styles.quickRow}>
        <input
          placeholder="O escribí un nombre nuevo…"
          value={quickValue}
          onChange={e => onQuickChange(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && quickValue.trim() && onQuickCreate()}
        />
        {quickValue.trim() && (
          <button className={styles.quickBtn} onClick={onQuickCreate}>+ Crear</button>
        )}
      </div>
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <button
      className={[styles.toggle, value ? styles.toggleOn : ''].join(' ')}
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
    >
      <span className={styles.toggleThumb} />
    </button>
  )
}
