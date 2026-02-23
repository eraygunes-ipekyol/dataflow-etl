# Production DB'deki kullanicilari listele
$venvPy = 'C:\inetpub\wwwroot\ErosETL\backend\venv\Scripts\python.exe'
$script = @'
import sys, os
sys.path.insert(0, r"C:\inetpub\wwwroot\ErosETL\backend")
os.chdir(r"C:\inetpub\wwwroot\ErosETL\backend")
from app.database import SessionLocal
from app.models.user import User
db = SessionLocal()
users = db.query(User).all()
print(f"Toplam {len(users)} kullanici:")
for u in users:
    print(f"  id={u.id} username={u.username} role={u.role} must_change={getattr(u, 'must_change_password', '?')}")
db.close()
'@
$script | & $venvPy -
