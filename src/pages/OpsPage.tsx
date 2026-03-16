'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { fetchCheckins, fetchAllCoupons, Checkin, Coupon } from '../lib/supabase'

const ACCENT = '#E63946'
const tabs = ['Scanner', 'Historial', 'Cupones'] as const

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

export default function OpsPage() {
  const [tab, setTab] = useState<typeof tabs[number]>('Scanner')
  const [loading, setLoading] = useState(true)
  const [checkins, setCheckins] = useState<Checkin[]>([])
  const [cupones, setCupones] = useState<Coupon[]>([])
  const [filtroEvento, setFiltroEvento] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    Promise.all([
      fetchCheckins().catch(() => []),
      fetchAllCoupons().catch(() => []),
    ]).then(([ci, co]) => {
      setCheckins(ci.filter((c: Checkin) => c.customer_name && c.customer_name !== 'DUPLICADO'))
      setCupones(co)
      setLoading(false)
    })
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setCameraActive(false)
  }, [])

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setCameraActive(true)
    } catch { alert('No se pudo acceder a la cámara') }
  }, [])

  useEffect(() => { if (tab !== 'Scanner') stopCamera() }, [tab, stopCamera])

  const eventosUnicos = [...new Set(checkins.map(c => c.event_name))]
  const historialFiltrado = checkins.filter(c => {
    if (filtroEvento && c.event_name !== filtroEvento) return false
    if (busqueda && !c.customer_name.toLowerCase().includes(busqueda.toLowerCase())) return false
    return true
  })

  const totalOk = checkins.filter(c => c.status === 'success' || c.status === 'valid').length
  const totalFail = checkins.length - totalOk

  // Stats by event
  const byEvent = checkins.reduce((a, c) => { a[c.event_name] = (a[c.event_name] || 0) + 1; return a }, {} as Record<string, number>)
  const eventStats = Object.entries(byEvent).map(([n, c]) => ({ n: n.length > 12 ? n.slice(0, 12) + '…' : n, p: Math.round((c / checkins.length) * 100) })).sort((a, b) => b.p - a.p).slice(0, 4)

  if (loading) return <div className="p-4"><div className="h-40 bg-gray-100 rounded-lg animate-pulse" /></div>

  return (
    <div className="space-y-3">
      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'text-[#E63946] border-[#E63946]' : 'text-gray-500 border-transparent hover:text-gray-900'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Scanner' && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 rounded-full bg-white shadow-sm font-medium">Check-ins: {checkins.length}</span>
            <span className="px-2 py-1 rounded-full bg-green-50 text-green-700 font-medium">✓ {totalOk}</span>
            <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 font-medium">✗ {totalFail}</span>
          </div>

          {/* Scanner + Recent side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-3">
              <div className="flex items-center gap-2">
                {cameraActive ? (
                  <div className="flex flex-col gap-2 w-full">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-32 rounded-lg bg-black object-cover" />
                    <button onClick={stopCamera} className="px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-xs font-medium">Detener</button>
                  </div>
                ) : (
                  <div className="flex gap-2 w-full">
                    <input type="text" placeholder="Código QR o ticket..." className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm" />
                    <button onClick={startCamera} className="px-3 py-1.5 bg-[#E63946] text-white rounded-lg text-xs font-medium whitespace-nowrap">📷 QR</button>
                  </div>
                )}
              </div>
            </div>
            <div className="lg:col-span-3 bg-white rounded-lg shadow-sm">
              <div className="px-3 py-2 border-b border-gray-100 text-xs font-semibold text-gray-600">Check-ins Recientes</div>
              <div className="divide-y divide-gray-50">
                {checkins.slice(0, 6).map((c, i) => (
                  <div key={i} className="flex items-center justify-between px-3 py-1.5">
                    <div>
                      <p className="font-medium text-gray-900 text-xs">{c.customer_name}</p>
                      <p className="text-[11px] text-gray-500">{c.ticket_number} · {c.event_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-gray-400">{formatTime(c.scanned_at)}</span>
                      <span className={`text-xs ${c.status === 'success' || c.status === 'valid' ? 'text-green-500' : 'text-red-500'}`}>
                        {c.status === 'success' || c.status === 'valid' ? '✓' : '✗'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Historial' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-3 bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="p-2 border-b border-gray-100 flex gap-2">
              <select value={filtroEvento} onChange={e => setFiltroEvento(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs">
                <option value="">Todos</option>
                {eventosUnicos.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input type="text" placeholder="Buscar..." value={busqueda} onChange={e => setBusqueda(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded text-xs flex-1" />
            </div>
            <table className="w-full text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Ticket</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Cliente</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Evento</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600">Hora</th>
                  <th className="text-left py-1.5 px-3 font-semibold text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map((c, i) => (
                  <tr key={i} className="border-t border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 px-3 font-mono">{c.ticket_number}</td>
                    <td className="py-1.5 px-3">{c.customer_name}</td>
                    <td className="py-1.5 px-3 text-gray-600">{c.event_name}</td>
                    <td className="py-1.5 px-3 text-gray-500">{formatTime(c.scanned_at)}</td>
                    <td className="py-1.5 px-3">
                      <span className={c.status === 'success' || c.status === 'valid' ? 'text-green-500' : 'text-red-500'}>
                        {c.status === 'success' || c.status === 'valid' ? '✓' : '✗'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="font-semibold text-xs text-gray-900 mb-2">Check-ins por Evento</h4>
              {eventStats.map(d => (
                <div key={d.n} className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] text-gray-600 w-20 truncate">{d.n}</span>
                  <div className="flex-1 h-3 bg-gray-100 rounded"><div className="h-full rounded" style={{ width: `${d.p}%`, backgroundColor: ACCENT }} /></div>
                  <span className="text-[11px] text-gray-600 w-7 text-right">{d.p}%</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <h4 className="font-semibold text-xs text-gray-900 mb-2">Resumen</h4>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between"><span className="text-gray-600">Total</span><span className="font-bold">{checkins.length}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Exitosos</span><span className="font-bold text-green-600">{totalOk}</span></div>
                <div className="flex justify-between"><span className="text-gray-600">Fallidos</span><span className="font-bold text-red-600">{totalFail}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'Cupones' && (
        <div className="bg-white rounded-lg shadow-sm p-3">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold">Cupones</h3>
            <button className="px-3 py-1.5 text-white rounded-lg text-xs font-medium" style={{ backgroundColor: ACCENT }}>+ Crear</button>
          </div>
          <div className="space-y-2">
            {cupones.map(c => (
              <div key={c.id} className="flex items-center justify-between p-2 border border-gray-100 rounded-lg">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs">{c.code}</span>
                    <span className="px-1.5 py-0.5 text-[11px] rounded bg-gray-100">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[11px] text-gray-500">{c.used_count}/{c.max_uses || '∞'}</span>
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full"><div className="h-full rounded-full" style={{ width: `${c.max_uses ? (c.used_count / c.max_uses) * 100 : 0}%`, backgroundColor: ACCENT }} /></div>
                  </div>
                </div>
                <span className={`w-2 h-2 rounded-full ${c.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
            ))}
            {cupones.length === 0 && <p className="text-gray-400 text-xs text-center py-4">Sin cupones</p>}
          </div>
        </div>
      )}
    </div>
  )
}
