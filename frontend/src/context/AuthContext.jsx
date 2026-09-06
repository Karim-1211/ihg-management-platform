import { createContext, useContext, useState, useEffect } from 'react'
import api from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('ihg_token')

    if (!token) {
      setLoading(false)
      return
    }

    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        localStorage.removeItem('ihg_token')
        setUser(null)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  async function login(email, password) {
    const res = await api.post('/auth/login', {
      email,
      password,
    })

    localStorage.setItem(
      'ihg_token',
      res.data.access_token
    )

    setUser(res.data.user)

    return res.data.user
  }

  async function register(data) {
    await api.post('/auth/register', data)

    return login(
      data.email,
      data.password
    )
  }

  function logout() {
    localStorage.removeItem('ihg_token')
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}