/*
 * Turn a MediaRecorder Blob into a base64 16 kHz mono 16-bit PCM WAV.
 *
 * Why re-encode? MediaRecorder gives us audio/webm (Chrome) or audio/mp4
 * (iOS Safari) — neither is a format Gemini reliably accepts. Every browser
 * that can *record* audio can also *decode* it via the Web Audio API, so we
 * decode → resample → emit WAV, which Gemini takes everywhere. 16 kHz mono is
 * plenty for speech and keeps the upload small.
 */

function decodeAudio(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    // Older Safari only supports the callback form; modern browsers return a
    // promise. Passing both callbacks and reading the return value covers both.
    const maybePromise = ctx.decodeAudioData(arrayBuffer, resolve, reject)
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(resolve, reject)
    }
  })
}

export async function blobToWavBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer()

  const AudioCtx = window.AudioContext || window.webkitAudioContext
  const decodeCtx = new AudioCtx()
  const decoded = await decodeAudio(decodeCtx, arrayBuffer)
  if (decodeCtx.close) decodeCtx.close()

  const targetRate = 16000
  const frames = Math.max(1, Math.ceil(decoded.duration * targetRate))
  const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext
  const offline = new OfflineCtx(1, frames, targetRate)
  const source = offline.createBufferSource()
  source.buffer = decoded
  source.connect(offline.destination)
  source.start()
  const rendered = await offline.startRendering()

  return encodeWavBase64(rendered.getChannelData(0), targetRate)
}

function encodeWavBase64(samples, sampleRate) {
  const n = samples.length
  const buffer = new ArrayBuffer(44 + n * 2)
  const view = new DataView(buffer)
  const writeStr = (offset, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
  }

  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + n * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, 1, true) // mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, n * 2, true)

  let offset = 44
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  return arrayBufferToBase64(buffer)
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000 // avoid blowing the call stack on big buffers
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}
