import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api'
import Brand from '../components/Brand'
import { useAuth } from '../AuthContext'

// Utils
const toDMY = (s) => {
  if (!s) return ''
  const [y,m,d] = String(s).split('-'); return [d,m,y].join('-')
}
const clamp = (n, a, b) => Math.max(a, Math.min(b, n))

/* ---------- Common pills ---------- */
function PillBtn({ variant='green', disabled, children, ...props }) {
  const base = {
    green: { bg:'#3F634D', fg:'#fff', off:'#b9c5bd' },
    red:   { bg:'#E0433B', fg:'#fff', off:'#efc0be' },
  }[variant]
  const style = {
    background: disabled ? base.off : base.bg,
    color: base.fg,
    border: 0,
    padding: '10px 16px',
    borderRadius: 18,
    fontWeight: 800,
    cursor: disabled ? 'not-allowed' : 'pointer'
  }
  return <button {...props} disabled={disabled} style={style}>{children}</button>
}

function HeaderWithUser({ right, title }) {
  const { user, signOut, logout } = useAuth();
  const doLogout = signOut || logout;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (ev) => {
      if (!ref.current) return;
      if (!ref.current.contains(ev.target)) setOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  const safeRemove = (store, key) => {
    try { store?.removeItem?.(key); } catch { /* ignore */ }
  };

  const handleSignOut = async () => {
    if (typeof doLogout === 'function') {
      try { await doLogout(); } catch { /* ignore */ }
    } else if (api && typeof api.logout === 'function') {
      try { await api.logout(); } catch { /* ignore */ }
    }
    if (typeof window !== 'undefined') {
      safeRemove(window.localStorage, 'token');
      safeRemove(window.sessionStorage, 'token');
      setOpen(false);
      window.location.assign('/'); // or '/login'
    }
  };

  const name = user?.name || '';
  const initial = name?.trim()?.[0]?.toUpperCase?.() || 'U';

  return (
    <>
      <div className="emp-header">
        <Brand />
        <div style={{display:'grid', gap:10, textAlign:'right', position:'relative'}} ref={ref}>
          <button
            onClick={()=>setOpen(v=>!v)}
            style={{display:'inline-flex', alignItems:'center', gap:10, padding:'6px 12px',
                    background:'#eef6f1', border:'1px solid #d9e7df', borderRadius:999, cursor:'pointer'}}
            aria-haspopup="menu" aria-expanded={open} title="Account"
          >
            <span style={{width:28, height:28, borderRadius:'50%', display:'grid', placeItems:'center',
                          fontWeight:800, background:'linear-gradient(135deg,#2f6b4f,#56a37d)', color:'#fff'}}>
              {initial}
            </span>
            <span className="emp-user" style={{ fontWeight:700, color:'#2f2f2f', letterSpacing:.2 }}>{name}</span>
          </button>

          {open && (
            <div role="menu" style={{
              position:'absolute', top:'calc(100% + 10px)', right:0, minWidth:200, padding:10,
              borderRadius:14, background:'rgba(255,255,255,.9)', border:'1px solid #e6e6e6',
              boxShadow:'0 14px 34px rgba(0,0,0,.12)', zIndex:50
            }}>
              <div aria-hidden style={{position:'absolute', top:-6, right:22, width:12, height:12,
                background:'inherit', borderLeft:'1px solid #e6e6e6', borderTop:'1px solid #e6e6e6',
                transform:'rotate(45deg)'}}/>
              <div style={{ padding:6 }}>
                <div style={{ fontSize:12, color:'#6b6b6b', marginBottom:8 }}>
                  Signed in as <b style={{ color:'#2f6b4f' }}>{name}</b>
                </div>
                <button
                  onClick={handleSignOut}
                  style={{width:'100%', background:'#E0433B', color:'#fff', border:0, borderRadius:8,
                          padding:'10px 12px', fontWeight:800, cursor:'pointer'}}
                >
                  ⏻  Sign out
                </button>
              </div>
            </div>
          )}
          {right}
        </div>
      </div>
      <h1 className="auth-title" style={{marginTop:0}}>{title}</h1>
    </>
  );
}



/* ================= Requests ================= */
function RequestsPanel() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [fStatus, setFStatus] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 5

  const load = async () => setItems(await api.allRequests())
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(r => {
      if (fStatus !== 'all' && r.status !== fStatus) return false
      if (!term) return true
      const hay = [
        r.user_name, r.email, r.reason,
        r.date_from, r.date_to,
        new Date(r.submitted_at).toLocaleDateString()
      ].join(' ').toLowerCase()
      return hay.includes(term)
    })
  }, [items, q, fStatus])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page-1)*pageSize, page*pageSize)
  useEffect(()=>{ if (page > totalPages) setPage(totalPages) }, [totalPages, page])

  const act = async (id, type) => {
    if (type==='approve') await api.approve(id); else await api.reject(id)
    await load()
  }

  return (
    <div className="auth-card" style={{width:'min(980px,96vw)'}}>
      <HeaderWithUser title="Requests" />
      <div className="emp-toolbar">
        <input className="emp-input" placeholder="Search" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} />
        <select className="emp-select" value={fStatus} onChange={e=>{setFStatus(e.target.value); setPage(1)}}>
          <option value="all">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <table className="emp-table">
        <thead>
          <tr>
            <th>Submit</th>
            <th>Dates</th>
            <th>Reason</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map(r => {
            const isPending = r.status === 'pending'
            const isApproved = r.status === 'approved'
            const isRejected = r.status === 'rejected'
            return (
              <tr key={r.id}>
                <td style={{width:150}}>{new Date(r.submitted_at).toLocaleDateString()}</td>
                <td style={{width:220}}>
                  <div>{toDMY(r.date_from)}</div>
                  <div>{toDMY(r.date_to)}</div>
                </td>
                <td>{r.reason}</td>
                <td style={{width:220, display:'flex', gap:10}}>
                  <PillBtn
                    onClick={()=>act(r.id,'approve')}
                    disabled={!isPending}
                    variant="green"
                  >{isApproved ? 'Approved' : 'Approve'}</PillBtn>
                  <PillBtn
                    onClick={()=>act(r.id,'reject')}
                    disabled={!isPending}
                    variant="red"
                  >{isRejected ? 'Rejected' : 'Reject'}</PillBtn>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="emp-sep" />
      <div className="emp-pages">
        <button className="emp-page" onClick={()=>setPage(p=>clamp(p-1,1,totalPages))}>&lsaquo;</button>
        {Array.from({length: totalPages}, (_,i)=>i+1).map(n=>(
          <button key={n} className="emp-page" aria-current={n===page} onClick={()=>setPage(n)}>{n}</button>
        ))}
        <button className="emp-page" onClick={()=>setPage(p=>clamp(p+1,1,totalPages))}>&rsaquo;</button>
      </div>
    </div>
  )
}

/* ================= Users ================= */
function UsersPanel() {
  const [items, setItems] = useState([])
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 6

  const load = async () => setItems(await api.listUsers())
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase()
    return items.filter(u =>
      [u.name, u.email, u.employee_code, u.role].join(' ').toLowerCase().includes(term)
    )
  }, [items, q])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const pageItems = filtered.slice((page-1)*pageSize, page*pageSize)
  useEffect(()=>{ if (page > totalPages) setPage(totalPages) }, [totalPages, page])

  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState(null)

  return (
    <div className="auth-card" style={{width:'min(980px,96vw)'}}>
      <HeaderWithUser
        title="Users"
        right={<button className="emp-new" onClick={()=>setShowCreate(true)}>+ New User</button>}
      />

      <div className="emp-toolbar">
        <input className="emp-input" placeholder="Search" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}} />
      </div>

      <table className="emp-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Employee Code</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {pageItems.map(u => (
            <tr key={u.id}>
              <td style={{width:220}}>{u.name}</td>
              <td style={{width:260, overflow:'hidden', textOverflow:'ellipsis'}}>{u.email}</td>
              <td style={{width:160}}>{u.employee_code || '-'}</td>
              <td style={{width:160}}>
                <PillBtn onClick={()=>setEditUser(u)}>Edit</PillBtn>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="emp-sep" />
      <div className="emp-pages">
        <button className="emp-page" onClick={()=>setPage(p=>clamp(p-1,1,totalPages))}>&lsaquo;</button>
        {Array.from({length: totalPages}, (_,i)=>i+1).map(n=>(
          <button key={n} className="emp-page" aria-current={n===page} onClick={()=>setPage(n)}>{n}</button>
        ))}
        <button className="emp-page" onClick={()=>setPage(p=>clamp(p+1,1,totalPages))}>&rsaquo;</button>
      </div>

      {showCreate && <CreateUserModal onClose={()=>setShowCreate(false)} onCreated={async()=>{ setShowCreate(false); await load() }} />}
      {editUser && <EditUserModal user={editUser} onClose={()=>setEditUser(null)} onSaved={async()=>{ setEditUser(null); await load() }} />}
    </div>
  )
}

/* ---------- Create User Modal ---------- */
function CreateUserModal({ onClose, onCreated }) {
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault(); setErr('')
    if (!form.name || !form.email || !form.password) return setErr('Please fill all fields')
    if (form.password !== form.confirm) return setErr('Passwords do not match')
    setBusy(true)
    try {
      await api.createUser({ name: form.name, email: form.email, password: form.password, role:'employee', employee_code:'' })
      await onCreated?.()
    } catch (err) {
      setErr(err.message || 'Failed to create user')
    } finally { setBusy(false) }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e=>e.stopPropagation()}>
        <Brand />
        <h2 className="auth-title" style={{marginTop:0}}>Create User</h2>
        <form onSubmit={submit}>
          <div className="modal-grid">
            <div className="full">
              <div className="label">Name</div>
              <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="John Doe" />
            </div>
            <div className="full">
              <div className="label">Email</div>
              <input className="input" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="john@example.com" />
            </div>
            <div>
              <div className="label">Password</div>
              <input className="input" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="••••••••" />
            </div>
            <div>
              <div className="label">Confirm Password</div>
              <input className="input" type="password" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} placeholder="••••••••" />
            </div>
          </div>
          {err && <div style={{color:'crimson', fontWeight:700, marginTop:6}}>{err}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Create User
            </button>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              <span className="icon-x">×</span>
              <span>Cancel</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------- Edit User Modal ---------- */
function EditUserModal({ user, onClose, onSaved }) {
  const { user: me } = useAuth();
  const [form, setForm] = useState({
    name: user.name || '',
    email: user.email || '',
    password: '',
    confirm: ''
  });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!form.name || !form.email) return setErr('Please fill all fields');
    if (form.password && form.password !== form.confirm) return setErr('Passwords do not match');
    setBusy(true);
    try {
      await api.updateUser(user.id, {
        name: form.name,
        email: form.email,
        ...(form.password ? { password: form.password } : {})
      });
      await onSaved?.();
    } catch (e) {
      setErr(e?.message || 'Failed to update');
    } finally { setBusy(false); }
  };

  const handleDelete = async () => {
    setErr('');
    if (me?.id === user.id) return setErr("You can't delete your own account.");
    if (!window.confirm(`Delete user "${user.name}"? This cannot be undone.`)) return;

    setBusy(true);
    try {
      if (typeof api?.deleteUser === 'function') {
        await api.deleteUser(user.id);
      } else if (typeof api?.removeUser === 'function') {
        await api.removeUser(user.id);
      } else {
        throw new Error('Delete endpoint not found');
      }
      await onSaved?.();
    } catch (e) {
      setErr(e?.message || 'Failed to delete user');
    } finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={e=>e.stopPropagation()}>
        <Brand />
        <h2 className="auth-title" style={{marginTop:0}}>Update User</h2>
        <form onSubmit={submit}>
          <div className="modal-grid">
            <div className="full">
              <div className="label">Name</div>
              <input className="input" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} />
            </div>
            <div className="full">
              <div className="label">Email</div>
              <input className="input" type="email" value={form.email} onChange={e=>setForm({...form, email:e.target.value})} />
            </div>
            <div>
              <div className="label">Password</div>
              <input className="input" type="password" value={form.password} onChange={e=>setForm({...form, password:e.target.value})} placeholder="(leave empty to keep)" />
            </div>
            <div>
              <div className="label">Confirm Password</div>
              <input className="input" type="password" value={form.confirm} onChange={e=>setForm({...form, confirm:e.target.value})} placeholder="(repeat)" />
            </div>
          </div>
          {err && <div className="form-error">{err}</div>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={busy || me?.id === user.id}
              title={me?.id === user.id ? "You can't delete yourself" : 'Delete user'}
            >
              🗑 Delete User
            </button>

            {/* RIGHT: Update / Cancel */}
            <div style={{display:'flex', gap:12}}>
              <button className="btn btn-primary" type="submit" disabled={busy}>
                Update User
              </button>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                <span className="icon-x">×</span> Cancel
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ---------- Page wrapper exporting both panels with tabs or stacked ---------- */
/**
 * ManagerHome
 * Centered like the other auth pages.
 */
export default function ManagerHome() {
  const [tab, setTab] = useState('requests'); // 'requests' | 'users'

  return (
    <div className="auth-page">
      {/* width wrapper so tabs align with the card below */}
      <div style={{ width: 'min(980px,96vw)' }}>
        <div className="tabs" style={{ marginBottom: 12 }}>
          <button
            className="tab"
            aria-selected={tab === 'requests'}
            onClick={() => setTab('requests')}
          >
            Requests
          </button>
          <button
            className="tab"
            aria-selected={tab === 'users'}
            onClick={() => setTab('users')}
          >
            Users
          </button>
        </div>

        {/* Panels already render their own .auth-card; leaving them as-is */}
        {tab === 'requests' ? <RequestsPanel /> : <UsersPanel />}
      </div>
    </div>
  );
}
