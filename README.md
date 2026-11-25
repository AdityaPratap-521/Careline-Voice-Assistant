# Careline - AI Voice Appointment Assistant

Careline is a voice-enabled doctor appointment scheduling
assistant built for the NexovAI SDE Intern assignment.

It allows callers to check doctor availability, book
appointments and cancel appointments through natural
voice conversations.

## Features

- Browser-based voice calls
- Real-time speech-to-text and text-to-speech
- Spoken phone number identification and confirmation
- Doctor availability checking
- Appointment booking and cancellation
- Live conversation transcript
- Doctor and appointment management dashboard
- Automatic dashboard data refresh
- Responsive user interface

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS, Lucide React |
| Backend | Python, FastAPI |
| Voice Framework | Pipecat |
| Speech-to-Text | ElevenLabs Scribe |
| LLM | Google Gemini 3.6 Flash |
| Text-to-Speech | ElevenLabs |
| Voice Transport | SmallWebRTC |
| Voice Activity Detection | Silero VAD |
| Database | SQLite |
| Testing | Pytest |

## Voice Pipeline

```text
Caller Microphone
       |
       v
SmallWebRTC Transport
       |
       v
ElevenLabs Speech-to-Text
       |
       v
Gemini LLM
       |
       +--> Appointment Functions --> SQLite
       |
       v
ElevenLabs Text-to-Speech
       |
       v
Caller Speaker
```

Pipecat orchestrates the voice pipeline. ElevenLabs
converts caller speech into text, Gemini understands
the request and invokes the appropriate appointment
function, and ElevenLabs converts the response back
into speech.

The React dashboard retrieves updated appointment
records from the FastAPI backend every three seconds.

## Function Calling

The following functions are registered with the LLM
through Pipecat:

- `confirm_phone`: Stores the verbally confirmed phone
  number for the current conversation.
- `check_doctor_availability`: Retrieves available
  appointment slots.
- `book_appointment`: Books the selected appointment.
- `cancel_appointment`: Cancels an existing appointment
  associated with the confirmed phone number.

The assistant reads back the caller's phone number and
requests verbal confirmation before booking or
cancelling an appointment.

## Prerequisites

- Python 3.11 or later (tested with Python 3.13.9)
- Node.js and npm
- ElevenLabs API key
- ElevenLabs voice ID
- Google Gemini API key
- Browser with microphone access

## Installation

### 1. Backend Setup

From the project root:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item ..\.env.example .env
```

Update the backend `.env` file:

```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
GOOGLE_API_KEY=your_google_api_key
GEMINI_MODEL=gemini-3.6-flash
```

Never commit the `.env` file or API keys.

### 2. Frontend Setup

From the project root:

```powershell
cd frontend
npm install
```

## Running the Application

Open three separate terminals.

### Terminal 1 - Backend REST API

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --port 8000
```

### Terminal 2 - Pipecat Voice Server

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
python bot.py --transport webrtc
```

### Terminal 3 - Frontend

```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 in your browser.

## How to Use

1. Click Start Call and allow microphone access.
2. Speak to the Careline assistant.
3. Provide and confirm your phone number.
4. Request doctor availability.
5. Select and confirm an appointment slot.
6. View the updated appointment records on the dashboard.
7. Request cancellation if needed.
8. Click End Call to finish the conversation.

## Backend API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | /health | Backend health status |
| GET | /doctors | List doctors |
| GET | /slots | Retrieve available slots |
| GET | /appointments | Retrieve appointment records |

## Testing

Run backend tests from the backend directory:

```powershell
python -m pytest -q
```

Verify the frontend production build from the frontend
directory:

```powershell
npm run build
```

## Current Verification Status

- Backend unit tests: 5/5 passed
- Frontend production build: Passed
- ElevenLabs speech-to-text: Verified
- ElevenLabs text-to-speech integration: Verified
- Google Gemini integration: Verified
- Browser-based voice call connection: Verified
- Live conversation transcript: Verified
- Invalid phone number handling: Verified
- Spoken phone number confirmation: Verified
- Doctor availability checking: Verified
- Appointment booking: Verified
- Appointment cancellation: Verified
- Automatic dashboard updates: Verified
- Availability, booking and cancellation in a single voice conversation: Verified
- End Call functionality: Verified

## Limitations

- Uses mock doctors and appointment slots.
- Requires internet connectivity and valid API keys.
- Voice response times depend on external API services.
- Free-tier API quotas may limit voice conversations.
- Spoken phone confirmation is not secure authentication.
- Phone confirmation relies on LLM instructions and a
  session-level gate.
- Intended for local demonstration, not production use.
- Do not use real patient information.

## Author

Aditya Pratap

Developed for the NexovAI SDE Intern assignment.
