import React, { useEffect, useRef, useState } from 'react'

// Props: examId (string), token (string), frameIntervalMs (number, optional)
export default function WebcamExam({ examId, token, frameIntervalMs = 1000 }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [status, setStatus] = useState('idle')
  const frameIntervalRef = useRef(null)

  useEffect(() => {
    let mounted = true
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        if (!mounted) return
        videoRef.current.srcObject = stream
        videoRef.current.play()
        setStatus('camera_ready')
      } catch (err) {
        console.error('Camera error', err)
        setStatus('camera_error')
      }
    }
    startCamera()

    return () => {
      mounted = false
      // stop camera
      try {
        const stream = videoRef.current && videoRef.current.srcObject
        if (stream) {
          stream.getTracks().forEach(t => t.stop())
        }
      } catch (e) {}
    }
  }, [])

  useEffect(() => {
    if (!examId || !token) return

    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const wsUrl = `${protocol}://${window.location.hostname}:8000/api/exams/ws/webcam/${examId}?token=${encodeURIComponent(token)}`
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log('Webcam WS connected')
      setConnected(true)
      setStatus('connected')
    }

    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.type === 'question' && data.audio) {
          // Play base64 audio
          const audioB64 = data.audio
          const audio = new Audio(`data:audio/mp3;base64,${audioB64}`)
          audio.play().catch(e => console.warn('Audio play failed', e))
        } else if (data.type === 'frame_ack') {
          // optional: update UI
        } else if (data.type === 'transcription') {
          console.log('Transcription from server:', data.text || data.transcribed_text)
        }
      } catch (e) {
        console.warn('WS message parse error', e)
      }
    }

    ws.onclose = () => {
      console.log('Webcam WS closed')
      setConnected(false)
      setStatus('closed')
    }

    ws.onerror = (e) => {
      console.error('Webcam WS error', e)
      setStatus('error')
    }

    return () => {
      try { ws.close() } catch (e) {}
    }
  }, [examId, token])

  useEffect(() => {
    // Start sending frames when connected and camera ready
    if (!connected) return
    if (!videoRef.current) return

    const sendFrame = () => {
      try {
        const video = videoRef.current
        const canvas = canvasRef.current
        if (!canvas || !video) return
        const w = video.videoWidth || 320
        const h = video.videoHeight || 240
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0, w, h)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7)
        const b64 = dataUrl.split(',')[1]
        const msg = JSON.stringify({ type: 'video_frame', image: b64, format: 'jpg' })
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(msg)
        }
      } catch (e) {
        console.warn('sendFrame error', e)
      }
    }

    frameIntervalRef.current = setInterval(sendFrame, frameIntervalMs)

    return () => {
      clearInterval(frameIntervalRef.current)
    }
  }, [connected, frameIntervalMs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div>
        <video ref={videoRef} style={{ width: 320, height: 240, background: '#000' }} muted />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      <div>
        <strong>Status:</strong> {status} {connected ? '(WS connected)' : ''}
      </div>
    </div>
  )
}
