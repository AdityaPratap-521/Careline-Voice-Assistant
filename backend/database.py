import sqlite3, re, os
from datetime import date, timedelta
from contextlib import contextmanager
from pathlib import Path
DB = os.getenv('CARELINE_DB', str(Path(__file__).with_name('careline.db')))
@contextmanager
def connection():
    c=sqlite3.connect(DB, timeout=10); c.row_factory=sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    try:
        with c: yield c
    finally: c.close()
def init():
    with connection() as c:
        c.executescript('''CREATE TABLE IF NOT EXISTS doctors(id INTEGER PRIMARY KEY,name TEXT,speciality TEXT);
        CREATE TABLE IF NOT EXISTS slots(id INTEGER PRIMARY KEY,doctor_id INTEGER REFERENCES doctors(id),day TEXT,time TEXT, UNIQUE(doctor_id,day,time));
        CREATE TABLE IF NOT EXISTS appointments(id INTEGER PRIMARY KEY,slot_id INTEGER REFERENCES slots(id),phone TEXT,status TEXT DEFAULT 'booked');
        CREATE UNIQUE INDEX IF NOT EXISTS active_slot ON appointments(slot_id) WHERE status='booked';''')
        c.executemany('INSERT OR IGNORE INTO doctors VALUES(?,?,?)',[(1,'Dr. Meera Sharma','Cardiology'),(2,'Dr. Arjun Rao','General medicine'),(3,'Dr. Priya Patel','Dermatology')])
        for d in range(1,8):
            for doctor in range(1,4):
                for time in ['10:00','11:30','14:00']:
                    c.execute('INSERT OR IGNORE INTO slots(doctor_id,day,time) VALUES(?,?,?)',(doctor,str(date.today()+timedelta(days=d)),time))
def doctors():
    with connection() as c: return [dict(r) for r in c.execute('SELECT * FROM doctors')]
def availability(doctor_id=None, day=None):
    with connection() as c:
        return [dict(r) for r in c.execute('''SELECT s.*,d.name,d.speciality FROM slots s JOIN doctors d ON d.id=s.doctor_id WHERE s.day>=? AND (? IS NULL OR s.doctor_id=?) AND (? IS NULL OR s.day=?) AND NOT EXISTS(SELECT 1 FROM appointments a WHERE a.slot_id=s.id AND a.status='booked') ORDER BY s.day,s.time,s.id''',(str(date.today()),doctor_id,doctor_id,day,day))]
def normalize(phone):
    p=re.sub(r'[\s()+-]','',phone)
    if len(p)==12 and p.startswith('91'): p=p[2:]
    if not re.fullmatch(r'[0-9]{10}',p): raise ValueError('Provide a ten-digit phone number')
    return p
def book(slot_id,phone):
    phone=normalize(phone)
    with connection() as c:
        c.execute('BEGIN IMMEDIATE')
        slot=c.execute('SELECT * FROM slots WHERE id=? AND day>=?',(slot_id,str(date.today()))).fetchone()
        if not slot: return {'error':'Slot not found or expired'}
        try: a=c.execute('INSERT INTO appointments(slot_id,phone) VALUES(?,?)',(slot_id,phone))
        except sqlite3.IntegrityError: return {'error':'Slot already booked'}
        return {'status':'booked','appointment_id':a.lastrowid,'slot_id':slot_id}
def appointments(phone=None):
    with connection() as c:
        rows=[dict(r) for r in c.execute('''SELECT a.*,s.day,s.time,d.name FROM appointments a JOIN slots s ON s.id=a.slot_id JOIN doctors d ON d.id=s.doctor_id WHERE (? IS NULL OR phone=?) ORDER BY a.id DESC''',(phone,phone))]
    for r in rows: r['phone']='******'+r['phone'][-4:]
    return rows
def cancel(phone,appointment_id=None):
    phone=normalize(phone)
    with connection() as c:
        c.execute('BEGIN IMMEDIATE')
        rows=c.execute("SELECT id FROM appointments WHERE phone=? AND status='booked' AND (? IS NULL OR id=?)",(phone,appointment_id,appointment_id)).fetchall()
        if not rows: return {'error':'No matching active appointment'}
        if len(rows)>1: return {'error':'Choose an appointment','appointments':appointments(phone)}
        c.execute("UPDATE appointments SET status='cancelled' WHERE id=?",(rows[0]['id'],))
        return {'status':'cancelled','appointment_id':rows[0]['id']}
