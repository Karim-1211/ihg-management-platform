import { useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Where the guest was headed before we asked them to sign in.
  const from = location.state?.from || '/'
  const reason = location.state?.reason

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F5F2ED] px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <Link to="/hotels" className="mb-6 inline-flex items-center gap-2.5">
          <img src="/brand/logo-mark.png" alt="" className="h-9 w-9 object-contain" onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <span className="text-xl font-extrabold tracking-tight text-[#1F3A5F]">IHG</span>
        </Link>

        <h1 className="font-serif text-3xl text-[#1F3A5F]">Welcome back</h1>
        <p className="mt-1 text-slate-500">Sign in to your IHG account</p>

        {reason && (
          <div className="mt-5 rounded-xl border border-[#1F3A5F]/15 bg-[#1F3A5F]/[0.04] px-4 py-3 text-sm leading-6 text-[#1F3A5F]">
            {reason}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[#1F3A5F]"
              placeholder="••••••••"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#1F3A5F] py-3 font-semibold text-white transition-colors hover:bg-[#162f4d] disabled:opacity-50"
          >
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" state={{ from, reason }} className="font-medium text-[#FF2147] hover:underline">
            Join
          </Link>
        </p>
        <p className="mt-4 text-center text-xs text-slate-400">
          <Link to="/hotels" className="hover:text-slate-600">← Continue browsing without an account</Link>
        </p>
      </div>
    </div>
  )
}