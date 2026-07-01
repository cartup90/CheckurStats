import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import db from '../../db/database.js'
import { SHOT_TYPES, RESULT_TYPES } from '../../logic/scoring.js'
import BottomNav from '../../components/BottomNav.jsx'
import Modal from '../../components/Modal.jsx'
import Button from '../../components/Button.jsx'
import styles from './History.module.css'

export default function History() {
  const { id } = useParams()
  const matchId = Number(id)
  const navigate = useNavigate()

  const [match,  setMatch]  = useState(null)
  const [points, setPoints] = useState([])
  const [editPoint, setEditPoint] = useState(null)
  const [editForm, setEditForm] = useState({})

  useEffect(() => { load() }, [matchId])

  async function load() {
    const m  = await db.matches.get(matchId)
    const pts = await db.points.where('matchId').equals(matchId).sortBy('timestamp')
    setMatch(m)
    setPoints(pts.reverse())
  }

  function getPlayerName(jugadorId) {
    if (!match) return '?'
    const all = [match.equipo1.drive, match.equipo1.reves, match.equipo2.drive, match.equipo2.reves]
    const p = all.find(pl => pl.id === jugadorId)
    return p?.nombre || '?'
  }

  function getTeam(jugadorId) {
    if (!match) return 1
    if (match.equipo1.drive.id === jugadorId || match.equipo1.reves.id === jugadorId) return 1
    return 2
  }

  function getShotLabel(id) { return SHOT_TYPES.find(s => s.id === id)?.label || id }
  function getShotIcon(id)  { return SHOT_TYPES.find(s => s.id === id)?.icon  || '🎾' }
  function getResultLabel(id) { return RESULT_TYPES.find(r => r.id === id)?.label || id }
  function getResultColor(id) { return RESULT_TYPES.find(r => r.id === id)?.color || 'white' }

  function openEdit(pt) {
    setEditPoint(pt)
    setEditForm({
      tipo_golpe: pt.tipo_golpe,
      resultado:  pt.resultado,
      nota:       pt.nota || '',
      revisar:    pt.revisar || false,
    })
  }

  async function saveEdit() {
    await db.points.update(editPoint.id, {
      tipo_golpe: editForm.tipo_golpe,
      resultado:  editForm.resultado,
      nota:       editForm.nota,
      revisar:    editForm.revisar,
    })
    setEditPoint(null)
    load()
  }

  async function toggleRevisar(pt, e) {
    e.stopPropagation()
    await db.points.update(pt.id, { revisar: !pt.revisar })
    load()
  }

  async function deletePoint(pt, e) {
    e.stopPropagation()
    if (!confirm('¿Eliminar este punto?')) return
    await db.points.delete(pt.id)
    load()
  }

  function formatTime(iso) {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate(`/partido/${id}`)}>←</button>
        <h1>Historial</h1>
        <span className={styles.count}>{points.length} puntos</span>
      </header>

      <main className={styles.main}>
        {points.length === 0 ? (
          <div className={styles.empty}>
            <div>📋</div>
            <p>Todavía no hay puntos registrados.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {points.map((pt, i) => {
              const team = getTeam(pt.jugadorId)
              return (
                <div
                  key={pt.id}
                  className={[styles.pointCard, pt.revisar ? styles.flagged : ''].join(' ')}
                  onClick={() => openEdit(pt)}
                >
                  <div className={styles.pointNum}>{points.length - i}</div>
                  <div className={[styles.teamDot, styles[`team${team}`]].join(' ')} />
                  <div className={styles.pointInfo}>
                    <div className={styles.pointTop}>
                      <span className={[styles.playerName, styles[`text${team}`]].join(' ')}>
                        {getPlayerName(pt.jugadorId)}
                      </span>
                      <span className={styles.pointScore}>{pt.marcador_resultante}</span>
                    </div>
                    <div className={styles.pointBottom}>
                      <span className={styles.shotChip}>
                        {getShotIcon(pt.tipo_golpe)} {getShotLabel(pt.tipo_golpe)}
                      </span>
                      <span
                        className={styles.resultChip}
                        style={{ color: getResultColor(pt.resultado) }}
                      >
                        {getResultLabel(pt.resultado)}
                      </span>
                    </div>
                    {pt.nota && <div className={styles.nota}>📝 {pt.nota}</div>}
                  </div>
                  <div className={styles.pointActions}>
                    <button
                      className={[styles.actionBtn, pt.revisar ? styles.revisar : ''].join(' ')}
                      onClick={e => toggleRevisar(pt, e)}
                      title="Marcar para revisar"
                    >🚩</button>
                    <button
                      className={styles.actionBtn}
                      onClick={e => deletePoint(pt, e)}
                    >🗑</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Edit modal */}
      <Modal isOpen={!!editPoint} onClose={() => setEditPoint(null)} title="Editar punto">
        {editPoint && (
          <div className={styles.editForm}>
            <label>
              <span>Golpe</span>
              <select value={editForm.tipo_golpe} onChange={e => setEditForm(f => ({ ...f, tipo_golpe: e.target.value }))}>
                {SHOT_TYPES.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}
              </select>
            </label>
            <label>
              <span>Resultado</span>
              <select value={editForm.resultado} onChange={e => setEditForm(f => ({ ...f, resultado: e.target.value }))}>
                {RESULT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
              </select>
            </label>
            <label>
              <span>Nota</span>
              <input
                value={editForm.nota}
                onChange={e => setEditForm(f => ({ ...f, nota: e.target.value }))}
                placeholder="Nota opcional..."
              />
            </label>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={editForm.revisar}
                onChange={e => setEditForm(f => ({ ...f, revisar: e.target.checked }))}
              />
              <span>Marcar para revisar después</span>
            </label>
            <div className={styles.editActions}>
              <Button variant="secondary" onClick={() => setEditPoint(null)}>Cancelar</Button>
              <Button variant="primary" onClick={saveEdit}>Guardar</Button>
            </div>
          </div>
        )}
      </Modal>

      <BottomNav matchId={id} />
    </div>
  )
}
