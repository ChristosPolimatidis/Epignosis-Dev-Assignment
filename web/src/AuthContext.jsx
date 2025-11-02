import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

const Ctx = createContext(null)

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.me().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false))
  }, [])

  const login = async (email, password) => {
    await api.login(email, password);
    const me = await api.me();
    setUser(me);
    return me;
  }

  const logout = async () => { await api.logout(); setUser(null) }

  return (
    <Ctx.Provider value={{ user, loading, login, logout }}>
      {children}
    </Ctx.Provider>
  )
}

export function RequireRole({ role, children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user || (role && user.role !== role)) return children?.props?.fallback ?? <div />
  return children
}
