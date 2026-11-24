
import { useEffect, useRef, useState } from 'react'
import {
  Activity, CalendarDays, Phone, PhoneOff,
  Stethoscope, Clock, HeartPulse, Mic,
  MessageSquare, RefreshCw
} from 'lucide-react'

import {
  createVoiceClient,
  startVoiceCall,
  endVoiceCall
} from './voice'

import './App.css'

const API = 'http://localhost:8000'

type Doctor = {
  id: number
  name: string
  speciality: string
}

type Slot = {
  id: number
  doctor_id: number
  day: string
  time: string
  name: string
  speciality: string
}

type Appointment = {
  id: number
  name: string
  phone: string
  day: string
  time: string
  status: string
}

type Message = {
  role: 'user' | 'assistant'
  text: string
}

function App() {
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [slots, setSlots] = useState<Slot[]>([])
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [online, setOnline] = useState(false)
  const [selectedDoctor, setSelectedDoctor] = useState('all')

  const [callStatus, setCallStatus] = useState('Ready to connect')
  const [messages, setMessages] = useState<Message[]>([])
  const [callError, setCallError] = useState('')

  const clientRef = useRef<ReturnType<typeof createVoiceClient> | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const transcriptRef = useRef<HTMLDivElement>(null)

  const callActive =
    callStatus === 'Connecting' ||
    callStatus === 'Connected' ||
    callStatus === 'Ending call'

  async function startCall() {
    if (clientRef.current) return

    setMessages([])
    setCallError('')
    setCallStatus('Connecting')

    const client = createVoiceClient({
      onStatus: (status) => {
        setCallStatus(status)

        if (status === 'Call ended') {
          clientRef.current = null

          if (audioRef.current) {
            audioRef.current.srcObject = null
          }
        }
      },

      onMessage: (role, text) => {
        setMessages(previous => [...previous, { role, text }])
      },

      onAudio: (track) => {
        if (audioRef.current) {
          audioRef.current.srcObject = new MediaStream([track])

          void audioRef.current.play().catch(() => {
            setCallError('Browser blocked audio playback.')
          })
        }
      },

      onError: (message) => {
        setCallError(message)
      }
    })

    clientRef.current = client

    try {
      await startVoiceCall(client)
    } catch (error) {
      console.error(error)

      try {
        await endVoiceCall(client)
      } catch {
        // Connection may already be closed.
      }

      clientRef.current = null
      setCallStatus('Connection failed')
      setCallError('Unable to connect. Check the Pipecat server.')
    }
  }

  async function endCall() {
    const client = clientRef.current

    if (!client) return

    setCallStatus('Ending call')

    try {
      await endVoiceCall(client)
      setCallStatus('Call ended')
    } catch (error) {
      console.error(error)
      setCallStatus('Connected')
      setCallError('Unable to end the call. Please try again.')
      return
    }

    clientRef.current = null

    if (audioRef.current) {
      audioRef.current.srcObject = null
    }

    void refresh()
  }

  async function refresh() {
    try {
      const responses = await Promise.all([
        fetch(`${API}/doctors`),
        fetch(`${API}/slots`),
        fetch(`${API}/appointments`)
      ])

      if (responses.some(response => !response.ok)) {
        throw new Error('Backend unavailable')
      }

      const [d, s, a] = await Promise.all(
        responses.map(response => response.json())
      )

      setDoctors(d)
      setSlots(s)
      setAppointments(a)
      setOnline(true)
    } catch {
      setOnline(false)
    }
  }

  useEffect(() => {
    void refresh()
    const timer = setInterval(refresh, 3000)

    return () => {
      clearInterval(timer)

      if (clientRef.current) {
        void endVoiceCall(clientRef.current).catch(console.error)
        clientRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop =
        transcriptRef.current.scrollHeight
    }
  }, [messages])

  const booked = appointments.filter(a => a.status === 'booked')
  const cancelled = appointments.filter(a => a.status === 'cancelled')

  const visibleSlots = slots.filter(
    s => selectedDoctor === 'all' ||
      s.doctor_id === Number(selectedDoctor)
  )

  return (
    <div className="app">
      <audio ref={audioRef} autoPlay />

      <header className="header">
        <div className="brand">
          <div className="brand-icon"><HeartPulse /></div>
          <div>
            <h1>Careline<span>.</span></h1>
            <p>Voice Appointment Assistant</p>
          </div>
        </div>

        <div className={`connection ${online ? 'online' : 'offline'}`}>
          <span className="status-dot" />
          {online ? 'System operational' : 'Backend disconnected'}
        </div>
      </header>

      <main className="dashboard">
        <section className="welcome">
          <div>
            <div className="eyebrow">APPOINTMENT MANAGEMENT</div>
            <h2>Care starts with a conversation.</h2>
            <p>Manage doctor appointments through natural voice interactions.</p>
          </div>

          <button className="secondary-button" onClick={refresh}>
            <RefreshCw size={16} /> Refresh
          </button>
        </section>

        <section className="stats">
          <div className="stat-card">
            <Stethoscope />
            <p>Doctors</p>
            <h3>{doctors.length}</h3>
          </div>

          <div className="stat-card">
            <Clock />
            <p>Available slots</p>
            <h3>{slots.length}</h3>
          </div>

          <div className="stat-card">
            <CalendarDays />
            <p>Booked appointments</p>
            <h3>{booked.length}</h3>
          </div>

          <div className="stat-card">
            <Activity />
            <p>Cancelled appointments</p>
            <h3>{cancelled.length}</h3>
          </div>
        </section>

        <section className="voice-grid">
          <div className="panel call-panel">
            <div className="eyebrow">AI RECEPTIONIST</div>

            <div className="assistant-avatar">
              <HeartPulse size={42} />
            </div>

            <h2>Careline Assistant</h2>
            <p>Your voice-powered appointment receptionist.</p>

            <div className="call-status">{callStatus}</div>

            <div className="call-controls">
              <button
                className="start-call"
                onClick={startCall}
                disabled={callActive || !online}
              >
                <Phone size={18} /> Start call
              </button>

              <button
                className="end-call"
                onClick={endCall}
                disabled={callStatus !== 'Connected'}
                aria-label="End call"
                title="End call"
              >
                <PhoneOff size={18} />
              </button>
            </div>

            <small>
              {callStatus === 'Connected'
                ? 'Microphone active'
                : 'Start a call to speak with Careline'}
            </small>

            {callError && (
              <p className="call-error">{callError}</p>
            )}
          </div>

          <div className="panel transcript-panel">
            <div className="panel-heading">
              <MessageSquare size={20} />
              <h3>Live conversation</h3>
            </div>

            {messages.length === 0 ? (
              <div className="empty-state">
                <Mic size={32} />
                <h4>
                  {callActive
                    ? 'Waiting for conversation'
                    : 'No active conversation'}
                </h4>
                <p>Your conversation transcript will appear here.</p>
              </div>
            ) : (
              <div className="transcript-messages" ref={transcriptRef}>
                {messages.map((message, index) => (
                  <div
                    className={`transcript-message ${message.role}`}
                    key={index}
                  >
                    <strong>
                      {message.role === 'user' ? 'You' : 'Careline'}
                    </strong>
                    <p>{message.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <Stethoscope size={20} />
            <h3>Our doctors</h3>
          </div>

          <div className="doctor-grid">
            {doctors.map(doctor => (
              <div className="doctor-card" key={doctor.id}>
                <div className="doctor-avatar">
                  <Stethoscope />
                </div>

                <div>
                  <h4>{doctor.name}</h4>
                  <p>{doctor.speciality}</p>

                  <small>
                    {slots.filter(s => s.doctor_id === doctor.id).length}
                    {' available slots'}
                  </small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <Clock size={20} />
            <h3>Available time slots</h3>

            <select
              value={selectedDoctor}
              onChange={e => setSelectedDoctor(e.target.value)}
            >
              <option value="all">All doctors</option>

              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Speciality</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {visibleSlots.map(slot => (
                  <tr key={slot.id}>
                    <td>{slot.name}</td>
                    <td>{slot.speciality}</td>
                    <td>{slot.day}</td>
                    <td>{slot.time}</td>
                    <td>
                      <span className="badge available">Available</span>
                    </td>
                  </tr>
                ))}

                {!visibleSlots.length && (
                  <tr>
                    <td colSpan={5}>No available slots to display.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-heading">
            <CalendarDays size={20} />
            <h3>Appointment records</h3>
          </div>

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Doctor</th>
                  <th>Phone</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {appointments.map(a => (
                  <tr key={a.id}>
                    <td>#{a.id}</td>
                    <td>{a.name}</td>
                    <td>{a.phone}</td>
                    <td>{a.day}</td>
                    <td>{a.time}</td>
                    <td>
                      <span className={`badge ${a.status}`}>
                        {a.status}
                      </span>
                    </td>
                  </tr>
                ))}

                {!appointments.length && (
                  <tr>
                    <td colSpan={6} className="empty-row">
                      No appointments yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer>Careline · Voice-powered appointment management</footer>
      </main>
    </div>
  )
}

export default App
