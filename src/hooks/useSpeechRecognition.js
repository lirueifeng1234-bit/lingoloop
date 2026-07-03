import { useEffect, useRef, useState } from 'react'

// Thin wrapper over the browser's Web Speech API (Chrome-friendly).
// Falls back gracefully: `supported` is false elsewhere, and the caller
// can still let the user type into the transcript.
export function useSpeechRecognition(lang = 'en-US') {
  const SR =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition)
  const supported = !!SR

  const recRef = useRef(null)
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [interim, setInterim] = useState('')

  useEffect(() => {
    if (!supported) return
    const rec = new SR()
    rec.lang = lang
    rec.continuous = true
    rec.interimResults = true

    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) finalText += res[0].transcript
        else interimText += res[0].transcript
      }
      if (finalText) setTranscript((t) => (t + ' ' + finalText).replace(/\s+/g, ' ').trim())
      setInterim(interimText)
    }
    rec.onend = () => { setListening(false); setInterim('') }
    rec.onerror = () => { setListening(false); setInterim('') }

    recRef.current = rec
    return () => { try { rec.stop() } catch { /* noop */ } }
  }, [supported, lang])

  const start = () => {
    if (!supported) return
    setInterim('')
    try { recRef.current.start(); setListening(true) } catch { /* already started */ }
  }
  const stop = () => { try { recRef.current?.stop() } catch { /* noop */ } setListening(false) }
  const reset = () => { setTranscript(''); setInterim('') }

  return { supported, listening, transcript, interim, setTranscript, start, stop, reset }
}
