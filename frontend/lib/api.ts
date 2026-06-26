import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001',
})

api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('nexus_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      const token = localStorage.getItem('nexus_token')
      if (token) {
        localStorage.removeItem('nexus_token')
        localStorage.removeItem('nexus_user')
        window.location.href = '/'
      }
    }
    return Promise.reject(err)
  }
)

export default api

export function fmtMoeda(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function fmtData(d: string | null | undefined): string {
  if (!d) return '—'
  const [y, m, dd] = d.split('-')
  return `${dd}/${m}/${y}`
}

export function fmtNum(v: number | null | undefined, dec = 2): string {
  if (v == null) return '—'
  return v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}
