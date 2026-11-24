import { PipecatClient } from '@pipecat-ai/client-js'
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport'

type VoiceCallbacks = {
  onStatus: (status: string) => void
  onMessage: (role: 'user' | 'assistant', text: string) => void
  onAudio: (track: MediaStreamTrack) => void
  onError: (message: string) => void
}

export function createVoiceClient(callbacks: VoiceCallbacks) {
  return new PipecatClient({
    transport: new SmallWebRTCTransport(),
    enableCam: false,
    enableMic: true,

    callbacks: {
      onConnected: () => {
        callbacks.onStatus('Connecting')
      },

      onBotReady: () => {
        callbacks.onStatus('Connected')
      },

      onDisconnected: () => {
        callbacks.onStatus('Call ended')
      },

      onUserTranscript: (data) => {
        if (data.final && data.text.trim()) {
          callbacks.onMessage('user', data.text)
        }
      },

      onBotOutput: (data) => {
        if (data.text_type === 'sentence' && data.text.trim()) {
          callbacks.onMessage('assistant', data.text)
        }
      },

      onTrackStarted: (track, participant) => {
        if (!participant?.local && track.kind === 'audio') {
          callbacks.onAudio(track)
        }
      },

      onError: (message) => {
        console.error(message)
        callbacks.onError('Voice service error. Please check the voice server.')
      }
    }
  })
}

export async function startVoiceCall(client: PipecatClient) {
  await client.connect({
    connection_url: 'http://localhost:7860/api/offer'
  })
}

export async function endVoiceCall(client: PipecatClient) {
  await client.disconnect()
}