import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import db from '../../db/database.js'
import Button from '../../components/Button.jsx'
import Modal  from '../../components/Modal.jsx'
import styles from './Players.module.css'

export default function Players() {
  const [players, setPlayers] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ nombre: '', apodo: '', club: '' })
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  async function load() {
    const all = await db.players.orderBy('nombre').toArray()
    setPlayers(all)
  }

  function openNew() {
    setEditing(null)
    setForm({ nombre: '', apodo: '', club: '' })
    setModalOpen(true)
  }

  function openEdit(p) {
    setEditing(p)
    setForm({ nombre: p.nombre, apodo: p.apodo || '', club: p.club || '' })
    setModalOpen(true)
  }

  async function save() {
    if (!form.nombre.trim()) return
    const data = { nombre: form.nombre.trim(), apodo: form.apodo.trim(), club: form.club.trim(), createdAt: new Date().toISOString() }
    if (editing) {
      await db.players.update(editing.id, data)
    } else {
      await db.players.add(data)
    }
    setModalOpen(false)
    load()
  }

  async function remove(id) {
    if (!confirm('¿Eliminar jugador?')) return
    await db.players.delete(id)
    load()
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.back} onClick={() => navigate('/')}>← </button>
        <h1>Jugadores</h1>
        <Button size="sm" variant="primary" onClick={openNew}>+ Nuevo</Button>
      </header>

      <main className={styles.main}>
        {players.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>👤</div>
            <p>No hay jugadores cargados.</p>
          </div>
        ) : (
          <div className={styles.list}>
            {players.map(p => (
              <div key={p.id} className={styles.playerCard} onClick={() => openEdit(p)}>
                <div className={styles.avatar}>{initials(p.nombre)}</div>
                <div className={styles.info}>
                  <div className={styles.name}>{p.nombre}</div>
                  {(p.apodo || p.club) && (
                    <div className={styles.sub}>
                      {p.apodo && <span>"{p.apodo}"</span>}
                      {p.club  && <span> · {p.club}</span>}
                    </div>
                  )}
                </div>
                <button className={styles.deleteBtn} onClick={e => { e.stopPropagation(); remove(p.id) }}>🗑</button>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar jugador' : 'Nuevo jugador'}>
        <div className={styles.form}>
          <label>
            <span>Nombre *</span>
            <input
              value={form.nombre}
              onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre completo"
              autoFocus
            />
          </label>
          <label>
            <span>Apodo</span>
            <input
              value={form.apodo}
              onChange={e => setForm(f => ({ ...f, apodo: e.target.value }))}
              placeholder="Apodo opcional"
            />
          </label>
          <label>
            <span>Club</span>
            <input
              value={form.club}
              onChange={e => setForm(f => ({ ...f, club: e.target.value }))}
              placeholder="Club opcional"
            />
          </label>
          <div className={styles.formActions}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={save} disabled={!form.nombre.trim()}>
              {editing ? 'Guardar' : 'Crear jugador'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
