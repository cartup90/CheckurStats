import { useState, useEffect, useRef, useCallback } from 'react'
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
  const [deleteConfirm, setDeleteConfirm] = useState(null) // player id to confirm deletion
  const navigate = useNavigate()

  const reloadPlayers = useCallback(async () => {
    const all = await db.players.orderBy('nombre').toArray()
    setPlayers(all)
    return all
  }, [])

  useEffect(() => { reloadPlayers() }, [reloadPlayers])

  function setPlayerOnTeam(team, pos, player) {
    if (team === 1) setEquipo1(e => ({ ...e, [pos]: player }))
    else            setEquipo2(e => ({ ...e, [pos]: player }))
  }

  function setFormato_(key, val) {
    setFormato(f => {
      const next = { ...f, [key]: val }
      if (key === 'starPoint'  && val) next.puntoDeOro = false
      if (key === 'puntoDeOro' && val) next.starPoint  = false
      return next
    })
  }

  async function handleSelectOrCreate(team, pos, name) {
    const trimmed = name.trim()
    if (!trimmed) { setPlayerOnTeam(team, pos, EMPTY_PLAYER); return }

    // Buscar coincidencia exacta (case-insensitive)
    const all = await reloadPlayers()
    const existing = all.find(p => p.nombre.toLowerCase() === trimmed.toLowerCase())

    if (existing) {
      setPlayerOnTeam(team, pos, { id: existing.id, nombre: existing.nombre })
    } else {
      // Crear nuevo jugador
      const id = await db.players.add({
        nombre: trimmed,
        apodo: '',
        club: '',
        createdAt: new Date().toISOString(),
      })
      const newPlayer = { id, nombre: trimmed }
      setPlayerOnTeam(team, pos, newPlayer)
      await reloadPlayers()
    }
  }

  async function handleDeletePlayer(playerId) {
    // Clear from teams if selected
    const clear = p => p.id === playerId ? EMPTY_PLAYER : p
    setEquipo1(e => ({ drive: clear(e.drive), reves: clear(e.reves) }))
    setEquipo2(e => ({ drive: clear(e.drive), reves: clear(e.reves) }))
    await db.players.delete(playerId)
    setDeleteConfirm(null)
    await reloadPlayers()
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
      {/* Delete confirmation modal */}
      {deleteConfirm && (() => {
        const p = players.find(x => x.id === deleteConfirm)
        return (
          <div className={styles.deleteOverlay}>
            <div className={styles.deleteModal}>
              <div className={styles.deleteIcon}>🗑️</div>
              <h3 className={styles.deleteTitle}>Eliminar jugador</h3>
              <p className={styles.deleteSub}>
                ¿Eliminar a <strong>{p?.nombre}</strong>? Esta acción no se puede deshacer.
              </p>
              <div className={styles.deleteBtns}>
                <button className={styles.deleteCancelBtn} onClick={() => setDeleteConfirm(null)}>
                  Cancelar
                </button>
                <button className={styles.deleteConfirmBtn} onClick={() => handleDeletePlayer(deleteConfirm)}>
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )
      })()}

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
              onSelectOrCreate={(pos, name) => handleSelectOrCreate(1, pos, name)}
              onDeleteRequest={id => setDeleteConfirm(id)}
            />
            <div className={styles.vsDivider}>VS</div>
            <TeamSetup
              label="Equipo 2"
              teamColor="team2"
              team={equipo2}
              players={players}
              onSelectOrCreate={(pos, name) => handleSelectOrCreate(2, pos, name)}
              onDeleteRequest={id => setDeleteConfirm(id)}
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
                    onClick={() => setFormato_('cantSets', n)}
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

// ─── TeamSetup ───────────────────────────────────────────────────────────────

function TeamSetup({ label, teamColor, team, players, onSelectOrCreate, onDeleteRequest }) {
  return (
    <div className={[styles.teamBox, styles[teamColor]].join(' ')}>
      <div className={styles.teamLabel}>{label}</div>
      <PlayerSelector
        label="Drive (Derecha)"
        selected={team.drive}
        players={players}
        onCommit={name => onSelectOrCreate('drive', name)}
        onDeleteRequest={onDeleteRequest}
      />
      <PlayerSelector
        label="Revés (Izquierda)"
        selected={team.reves}
        players={players}
        onCommit={name => onSelectOrCreate('reves', name)}
        onDeleteRequest={onDeleteRequest}
      />
    </div>
  )
}

// ─── PlayerSelector (combobox con filtro + crear + eliminar) ─────────────────

function PlayerSelector({ label, selected, players, onCommit, onDeleteRequest }) {
  const [query, setQuery]       = useState('')
  const [open, setOpen]         = useState(false)
  const [focused, setFocused]   = useState(false)
  const inputRef  = useRef(null)
  const wrapRef   = useRef(null)

  // Sync display when parent clears selection
  useEffect(() => {
    if (!selected.id) setQuery('')
  }, [selected.id])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setFocused(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const trimmed = query.trim()

  // Filter players: show matches for the current query
  const filtered = trimmed
    ? players.filter(p => p.nombre.toLowerCase().includes(trimmed.toLowerCase()))
    : players

  // Exact match (case-insensitive)
  const exactMatch = players.find(p => p.nombre.toLowerCase() === trimmed.toLowerCase())

  // Show "create" option only when there's text and no exact match
  const showCreate = trimmed.length > 0 && !exactMatch

  const isSelected = !!selected.id

  function handleInputChange(e) {
    setQuery(e.target.value)
    setOpen(true)
    // If they clear the input, clear the selection too
    if (!e.target.value.trim()) onCommit('')
  }

  function handleSelectPlayer(player) {
    setQuery(player.nombre)
    setOpen(false)
    onCommit(player.nombre)
  }

  function handleCreate() {
    if (!trimmed) return
    setOpen(false)
    onCommit(trimmed)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (exactMatch) { handleSelectPlayer(exactMatch) }
      else if (showCreate) { handleCreate() }
    }
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  function handleFocus() {
    setFocused(true)
    setOpen(true)
  }

  return (
    <div className={styles.playerSelector} ref={wrapRef}>
      <div className={styles.posLabel}>{label}</div>

      <div className={[styles.comboWrap, isSelected ? styles.comboSelected : '', focused ? styles.comboFocused : ''].join(' ')}>
        {isSelected && (
          <span className={styles.comboCheck}>✓</span>
        )}
        <input
          ref={inputRef}
          className={styles.comboInput}
          type="text"
          placeholder="Escribí para buscar o crear…"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          spellCheck={false}
        />
        {query && (
          <button
            className={styles.comboClear}
            onMouseDown={e => e.preventDefault()}
            onClick={() => { setQuery(''); onCommit(''); inputRef.current?.focus() }}
            tabIndex={-1}
            aria-label="Limpiar"
          >✕</button>
        )}
      </div>

      {/* Dropdown */}
      {open && (filtered.length > 0 || showCreate) && (
        <div className={styles.dropdown}>
          {filtered.length > 0 && (
            <div className={styles.dropdownSection}>
              {filtered.map(p => (
                <div
                  key={p.id}
                  className={[styles.dropdownItem, selected.id === p.id ? styles.dropdownItemActive : ''].join(' ')}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => handleSelectPlayer(p)}
                >
                  <span className={styles.dropdownName}>{p.nombre}</span>
                  <button
                    className={styles.dropdownDelete}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      setOpen(false)
                      onDeleteRequest(p.id)
                    }}
                    tabIndex={-1}
                    aria-label={`Eliminar ${p.nombre}`}
                  >🗑</button>
                </div>
              ))}
            </div>
          )}

          {showCreate && (
            <div
              className={styles.dropdownCreate}
              onMouseDown={e => e.preventDefault()}
              onClick={handleCreate}
            >
              <span className={styles.dropdownCreateIcon}>＋</span>
              <span>Crear <strong>"{trimmed}"</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Toggle ──────────────────────────────────────────────────────────────────

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
