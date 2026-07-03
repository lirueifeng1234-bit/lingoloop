import { useCallback, useRef, useState } from 'react'

/*
 * Records microphone audio with MediaRecorder — which iOS Safari DOES support
 * (unlike the Web Speech API). Needs a secure context (https or localhost).
 * stop() resolves with the recorded Blob so the caller can convert + upload it.
 */
export function useAudioRecorder() {
  const supported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window !== 'undefined' &&
    'MediaRecorder' in window

  const [recording, setRecording] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const [error, setError] = useState('')

  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const streamRef = useRef(null)
  const timerRef = useRef(null)
  const resolveRef = useRef(null)

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        })
        cleanup()
        if (resolveRef.current) {
          resolveRef.current(blob)
          resolveRef.current = null
        }
      }

      recorderRef.current = recorder
      recorder.start()
      setRecording(true)
      setSeconds(0)
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000)
    } catch (e) {
      const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
      setError(
        denied
          ? 'Microphone access was blocked. Allow it in your browser and try again.'
          : 'Couldn’t reach the microphone. Check it’s connected and try again.',
      )
    }
  }, [cleanup])

  const stop = useCallback(
    () =>
      new Promise((resolve) => {
        const recorder = recorderRef.current
        setRecording(false)
        clearInterval(timerRef.current)
        if (!recorder || recorder.state === 'inactive') {
          resolve(null)
          return
        }
        resolveRef.current = resolve
        recorder.stop()
      }),
    [],
  )

  const reset = useCallback(() => {
    setRecording(false)
    setSeconds(0)
    setError('')
    cleanup()
  }, [cleanup])

  return { supported, recording, seconds, error, start, stop, reset }
}
