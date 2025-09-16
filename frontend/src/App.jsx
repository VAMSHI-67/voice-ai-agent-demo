import React, { useEffect, useMemo, useRef, useState } from 'react'
import axios from 'axios'
import ErrorToast from './components/ErrorToast.jsx'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function useApi() {
  const api = useMemo(() => axios.create({ baseURL: BACKEND_URL, timeout: 30000 }), [])
  return api
}

export default function App() {
  const api = useApi()
  const [voices, setVoices] = useState([])
  const [loadingVoices, setLoadingVoices] = useState(false)
  const [text, setText] = useState('Hello! This is a demo of an AI voice call simulation.')
  const [voiceId, setVoiceId] = useState('')
  const [audioUrl, setAudioUrl] = useState('')
  const [status, setStatus] = useState('idle') // idle | ringing | connected | playing | ended
  const [previewLoading, setPreviewLoading] = useState(false)
  const [useSSE, setUseSSE] = useState(false)
  const [error, setError] = useState('')
  const audioRef = useRef(null)

  useEffect(() => {
    const load = async () => {
      setLoadingVoices(true)
      try {
        const r = await api.get('/voices')
        setVoices(r.data)
        if (r.data?.length) setVoiceId(r.data[0].id)
      } catch (e) {
        console.error(e)
        setError('Failed to fetch available voices.')
      } finally {
        setLoadingVoices(false)
      }
    }
    load()
  }, [api])

  const onGenerate = async () => {
    if (!text || !voiceId) return
    try {
      // generate audio first
      setStatus('ringing')
      let r
      try {
        r = await api.post('/generate-voice', { text, voiceId })
      } catch (e) {
        console.error(e)
        setStatus('idle')
        setError('Voice generation failed. Please retry.')
        return
      }
      const aUrl = r.data.audioUrl
      setAudioUrl(aUrl)
      if (useSSE) {
        // Live updates via SSE
  const url = new URL('/simulate-call-sse', BACKEND_URL)
        url.searchParams.set('audioUrl', aUrl)
        url.searchParams.set('toNumber', 'local-sim')
        let es
        try {
          es = new EventSource(url.toString())
        } catch (e) {
          console.error(e)
          setStatus('idle')
          setError('Unable to connect to server. Please try again later.')
          return
        }
        const audioEl = audioRef.current
  const absoluteAudioUrl = aUrl.startsWith('http') ? aUrl : `${BACKEND_URL}${aUrl}`

        const handlers = {
          initiated: () => setStatus('ringing'),
          ringing: () => setStatus('ringing'),
          connected: () => setStatus('connected'),
          playing: async (e) => {
            const data = JSON.parse(e.data)
            setStatus('playing')
            audioEl.src = absoluteAudioUrl
            audioEl.onended = () => setStatus('ended')
            try { await audioEl.play() } catch {}
            // safety fallback
            setTimeout(() => {
              if (status === 'playing') setStatus('ended')
            }, (data.duration + 1) * 1000)
          },
          ended: () => { setStatus('ended'); es.close() },
          error: () => { setStatus('idle'); es.close() },
        }

        Object.keys(handlers).forEach(evt => {
          es.addEventListener(evt, handlers[evt])
        })

        es.onerror = () => { setStatus('idle'); setError('Connection lost during call simulation.'); es.close() }
      } else {
        // Non-SSE simulated call
        setStatus('connected')
        let sim
        try {
          sim = await api.post('/simulate-call', { audioUrl: aUrl, toNumber: 'local-sim' })
        } catch (e) {
          console.error(e)
          setStatus('idle')
          setError('Unable to connect to server. Please try again later.')
          return
        }
        const duration = sim.data.duration
        setStatus('playing')

  const absoluteAudioUrl = aUrl.startsWith('http') ? aUrl : `${BACKEND_URL}${aUrl}`
        const audioEl = audioRef.current
        audioEl.src = absoluteAudioUrl
        try { await audioEl.play() } catch (e) { console.error(e) }
        audioEl.onended = () => setStatus('ended')
        setTimeout(() => {
          if (status === 'playing') setStatus('ended')
        }, (duration + 1) * 1000)
      }
    } catch (e) {
      console.error(e)
      setStatus('idle')
      setError('An unexpected error occurred.')
    }
  }

  const onPreview = async () => {
    if (!text || !voiceId) return
    try {
      setPreviewLoading(true)
      let aUrl = audioUrl
      if (!aUrl) {
        let r
        try {
          r = await api.post('/generate-voice', { text, voiceId })
        } catch (e) {
          console.error(e)
          setError('Voice generation failed. Please retry.')
          return
        }
        aUrl = r.data.audioUrl
        setAudioUrl(aUrl)
      }
  const absoluteAudioUrl = aUrl.startsWith('http') ? aUrl : `${BACKEND_URL}${aUrl}`
      const audioEl = audioRef.current
      audioEl.src = absoluteAudioUrl
      try { await audioEl.play() } catch (e) { console.error(e) }
    } catch (e) {
      console.error(e)
      setError('An unexpected error occurred.')
    } finally {
      setPreviewLoading(false)
    }
  }

  const onEndCall = () => {
    const audioEl = audioRef.current
    if (audioEl) {
      audioEl.pause()
      audioEl.currentTime = 0
    }
    setStatus('ended')
  }

  const isProdButLocalBackend = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && BACKEND_URL.startsWith('http://localhost')

  return (
    <div className="min-h-screen p-6 max-w-3xl mx-auto">
      <ErrorToast message={error} onClose={() => setError('')} />
      {isProdButLocalBackend && (
        <div className="mb-4 bg-yellow-100 border border-yellow-300 text-yellow-900 px-4 py-2 rounded">
          The app is deployed but BACKEND_URL points to localhost. Set VITE_BACKEND_URL on Vercel to your Render URL and redeploy.
        </div>
      )}
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Voice over AI Agent (Demo)</h1>
        <p className="text-sm text-gray-600">Free-tier simulation using ElevenLabs + web playback</p>
      </header>

      <section className="space-y-4 bg-white rounded-lg p-4 shadow">
        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            className="w-full border rounded p-2"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your message here..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Voice</label>
          <select
            className="w-full border rounded p-2"
            value={voiceId}
            onChange={(e) => setVoiceId(e.target.value)}
            disabled={loadingVoices}
          >
            {voices.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 items-center flex-wrap">
          <button
            onClick={onPreview}
            className="bg-gray-800 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!text || !voiceId || loadingVoices || previewLoading}
          >
            {previewLoading ? 'Preparing Preview…' : 'Preview Audio'}
          </button>
          <button
            onClick={onGenerate}
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={!text || !voiceId || loadingVoices || status === 'ringing' || status === 'playing'}
          >
            Generate & Call
          </button>
          <label className="inline-flex items-center gap-2 text-sm ml-2">
            <input type="checkbox" checked={useSSE} onChange={(e) => setUseSSE(e.target.checked)} />
            Live status (SSE)
          </label>
        </div>
      </section>

      <section className="mt-6 bg-white rounded-lg p-4 shadow">
        <h2 className="font-semibold mb-2">Call Simulation</h2>
        <div className="flex items-center gap-2">
          <span className="text-sm">Status:</span>
          <span className="text-sm font-mono">
            {status}
          </span>
        </div>

        <audio ref={audioRef} className="mt-4 w-full" controls />

        <div className="mt-4">
          <button
            onClick={onEndCall}
            className="bg-gray-200 px-4 py-2 rounded"
            disabled={status !== 'playing'}
          >
            End Call
          </button>
        </div>
      </section>

      <footer className="mt-8 text-xs text-gray-500">
        <p>Backend: {BACKEND_URL}</p>
      </footer>
    </div>
  )
}
