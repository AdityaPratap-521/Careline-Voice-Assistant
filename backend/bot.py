import os
from dotenv import load_dotenv
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import LLMRunFrame
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.task import PipelineTask, PipelineParams
from pipecat.pipeline.runner import PipelineRunner
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair, LLMUserAggregatorParams
from pipecat.services.elevenlabs.stt import ElevenLabsRealtimeSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.adapters.schemas.function_schema import FunctionSchema
from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport
from pipecat.runner.types import SmallWebRTCRunnerArguments
import database as db

load_dotenv()

PROMPT = """You are Careline, a polite appointment receptionist.
Only handle scheduling, not medical advice.
Ask for the caller's ten-digit phone number, read every digit back,
and wait for explicit verbal confirmation before calling confirm_phone.
Never invent confirmation, IDs, or slots.
Check availability using the tool, offer a few options and ask the caller to choose.
Confirm the selected appointment before booking or cancellation.
If multiple appointments exist, ask which one.
Never claim success unless the tool reports success.
Use short natural spoken sentences.
Greet the caller first."""


def schema(name, description, properties, required):
    return FunctionSchema(
        name=name,
        description=description,
        properties=properties,
        required=required
    )


S = {'type': 'string'}
I = {'type': 'integer'}


async def bot(runner_args: SmallWebRTCRunnerArguments):
    db.init()

    transport = SmallWebRTCTransport(
        webrtc_connection=runner_args.webrtc_connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True
        )
    )

    stt = ElevenLabsRealtimeSTTService(
        api_key=os.environ['ELEVENLABS_API_KEY']
    )

    tts = ElevenLabsTTSService(
        api_key=os.environ['ELEVENLABS_API_KEY'],
        voice_id=os.environ['ELEVENLABS_VOICE_ID']
    )

    llm = GoogleLLMService(
        api_key=os.environ['GOOGLE_API_KEY'],
        model=os.getenv('GEMINI_MODEL', 'gemini-3.6-flash')
    )

    phone = None

    async def confirm(p: FunctionCallParams):
        nonlocal phone

        try:
            phone = db.normalize(p.arguments['phone'])
            result = {'confirmed': True}
        except ValueError as e:
            phone = None
            result = {'error': str(e)}

        await p.result_callback(result)

    async def check(p: FunctionCallParams):
        await p.result_callback({
            'doctors': db.doctors(),
            'slots': db.availability(**p.arguments)[:20]
        })

    async def book(p: FunctionCallParams):
        await p.result_callback(
            db.book(p.arguments['slot_id'], phone)
            if phone
            else {'error': 'Confirm spoken phone first'}
        )

    async def cancel(p: FunctionCallParams):
        await p.result_callback(
            db.cancel(phone, p.arguments.get('appointment_id'))
            if phone
            else {'error': 'Confirm spoken phone first'}
        )

    tools = [
        schema(
            'confirm_phone',
            'Store phone only after caller explicitly confirms spoken readback',
            {'phone': S},
            ['phone']
        ),
        schema(
            'check_doctor_availability',
            'Find slots and doctor IDs',
            {'doctor_id': I, 'day': S},
            []
        ),
        schema(
            'book_appointment',
            'Book chosen slot after verbal agreement',
            {'slot_id': I},
            ['slot_id']
        ),
        schema(
            'cancel_appointment',
            'Cancel agreed appointment for confirmed phone',
            {'appointment_id': I},
            []
        )
    ]

    for spec, handler in zip(tools, [confirm, check, book, cancel]):
        llm.register_function(spec.name, handler)

    context = LLMContext(
        [{'role': 'system', 'content': PROMPT}],
        tools=ToolsSchema(standard_tools=tools)
    )

    agg = LLMContextAggregatorPair(
        context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=SileroVADAnalyzer()
        )
    )

    pipeline = Pipeline([
        transport.input(),
        stt,
        agg.user(),
        llm,
        tts,
        transport.output(),
        agg.assistant()
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(enable_metrics=True)
    )

    @transport.event_handler('on_client_connected')
    async def connected(transport, client):
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler('on_client_disconnected')
    async def disconnected(transport, client):
        await task.cancel()

    await PipelineRunner(handle_sigint=False).run(task)


if __name__ == '__main__':
    from pipecat.runner.run import main
    main()