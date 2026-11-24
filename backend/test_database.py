import database as db
import pytest
@pytest.fixture(autouse=True)
def setup(tmp_path,monkeypatch):
    monkeypatch.setattr(db,'DB',str(tmp_path/'test.db')); db.init()
def test_seed(): assert len(db.doctors())==3 and len(db.availability())==63
def test_booking():
    s=db.availability()[0]['id']; assert db.book(s,'9876543210')['status']=='booked'; assert s not in [r['id'] for r in db.availability()]; assert 'error' in db.book(s,'9876543211')
def test_cancel():
    s=db.availability()[0]['id']; a=db.book(s,'9876543210')['appointment_id']; assert 'error' in db.cancel('9876543211',a); assert db.cancel('9876543210',a)['status']=='cancelled'; assert s in [r['id'] for r in db.availability()]
def test_invalid():
    with pytest.raises(ValueError): db.book(1,'123')
def test_multiple():
    s,t=db.availability()[:2]; db.book(s['id'],'9876543210'); db.book(t['id'],'9876543210'); assert 'error' in db.cancel('9876543210'); assert len(db.appointments())==2
