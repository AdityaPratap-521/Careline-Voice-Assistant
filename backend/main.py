from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import database as db
app=FastAPI(title='Careline demo API')
app.add_middleware(CORSMiddleware,allow_origins=['http://localhost:5173','http://127.0.0.1:5173'],allow_methods=['GET'],allow_headers=['*'])
@app.get('/health')
def health(): return {'status':'ok'}
@app.get('/doctors')
def doctors(): db.init(); return db.doctors()
@app.get('/slots')
def slots(doctor_id:int|None=None,day:str|None=None): db.init(); return db.availability(doctor_id,day)
@app.get('/appointments')
def appointments(): db.init(); return db.appointments()
