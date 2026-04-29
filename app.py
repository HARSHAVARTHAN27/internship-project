from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os, hashlib, json, sqlite3
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH  = os.path.join(BASE_DIR, 'placeiq.db')

app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
CORS(app)

# ── DB CONNECTION ──────────────────────────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def check_schema():
    """Drop all tables and rebuild if schema is outdated."""
    required = {
        'users':    ['id','name','email','password_hash','role','created_at'],
        'students': ['id','user_id','roll_number','branch','year','gender',
                     'cgpa','attendance','resume_score','placement_chance','placed'],
    }
    try:
        with get_db() as db:
            for table, cols in required.items():
                row = db.execute(f"PRAGMA table_info({table})").fetchall()
                existing = [r['name'] for r in row]
                if not existing or any(c not in existing for c in cols):
                    print(f"⚠ Schema mismatch in '{table}' — rebuilding database...")
                    db.executescript("""
                        DROP TABLE IF EXISTS predictions;
                        DROP TABLE IF EXISTS placement_outcomes;
                        DROP TABLE IF EXISTS projects;
                        DROP TABLE IF EXISTS certifications;
                        DROP TABLE IF EXISTS student_timelines;
                        DROP TABLE IF EXISTS students;
                        DROP TABLE IF EXISTS users;
                    """)
                    return  # will be recreated by init_db
    except Exception:
        pass

# ── SCHEMA ─────────────────────────────────────────────────────────────────────
def init_db():
    with get_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                name          TEXT NOT NULL,
                email         TEXT UNIQUE NOT NULL,
                password_hash TEXT,
                role          TEXT DEFAULT 'Student',
                created_at    TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS students (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
                roll_number TEXT,
                branch      TEXT,
                year        INTEGER DEFAULT 3,
                gender      TEXT DEFAULT 'Unspecified',
                cgpa        REAL DEFAULT 0,
                attendance  REAL DEFAULT 0,
                resume_score REAL DEFAULT 0,
                placement_chance REAL DEFAULT 0,
                placed      TEXT DEFAULT 'Not Placed'
            );

            CREATE TABLE IF NOT EXISTS student_timelines (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id            INTEGER REFERENCES students(id) ON DELETE CASCADE,
                semester              INTEGER,
                cgpa                  REAL,
                attendance_rate       REAL,
                avg_test_score        REAL,
                feature_snapshot_json TEXT,
                recorded_at           TEXT DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS certifications (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                provider   TEXT,
                date       TEXT,
                verified   INTEGER DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS projects (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id  INTEGER REFERENCES students(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                description TEXT,
                tech_stack  TEXT,
                github_url  TEXT
            );

            CREATE TABLE IF NOT EXISTS placement_outcomes (
                id         INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
                placed     INTEGER DEFAULT 0,
                company    TEXT,
                package    REAL,
                role       TEXT,
                year       INTEGER
            );

            CREATE TABLE IF NOT EXISTS predictions (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id        INTEGER REFERENCES students(id) ON DELETE CASCADE,
                prediction_date   TEXT DEFAULT (datetime('now')),
                placement_prob    REAL,
                package_tier      TEXT,
                top_gaps_json     TEXT,
                shap_values_json  TEXT
            );
        """)
    print("✓ SQLite schema ready →", DB_PATH)
    migrate_legacy()

def migrate_legacy():
    import csv
    CSV_PATH  = os.path.join(BASE_DIR, 'users.csv')
    JSON_PATH = os.path.join(BASE_DIR, 'assets', 'students.json')
    with get_db() as db:
        if os.path.exists(CSV_PATH):
            try:
                with open(CSV_PATH, newline='') as f:
                    for row in csv.DictReader(f):
                        email = row.get('email','').strip().lower()
                        if not email: continue
                        existing = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                        if not existing:
                            db.execute("INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                                (row.get('name',''), email, row.get('password_hash',''), row.get('role','Student')))
                            uid = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                            if uid and row.get('role','Student') == 'Student':
                                db.execute("""INSERT OR IGNORE INTO students
                                    (user_id,roll_number,branch,cgpa,attendance,resume_score)
                                    VALUES (?,?,?,?,?,?)""",
                                    (uid['id'], row.get('roll',''), row.get('dept',''),
                                     float(row.get('cgpa',0) or 0), float(row.get('attendance',0) or 0),
                                     float(row.get('resumeScore',0) or 0)))
                os.rename(CSV_PATH, CSV_PATH+'.bak')
                print("✓ Migrated users.csv")
            except Exception as e:
                print("⚠ CSV migration:", e)

        if os.path.exists(JSON_PATH):
            try:
                with open(JSON_PATH) as f:
                    students = json.load(f)
                for s in students:
                    email = s.get('email','').strip().lower()
                    if not email: continue
                    uid = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                    if not uid:
                        db.execute("INSERT OR IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                            (s.get('name',''), email, '', 'Student'))
                        uid = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                    if uid:
                        existing_s = db.execute("SELECT id FROM students WHERE user_id=?", (uid['id'],)).fetchone()
                        if not existing_s:
                            chance, placed = predict_rule_based(
                                float(s.get('cgpa',0) or 0),
                                float(s.get('attendance',0) or 0),
                                float(s.get('resumeScore',0) or 0))
                            db.execute("""INSERT OR IGNORE INTO students
                                (user_id,roll_number,branch,cgpa,attendance,resume_score,placement_chance,placed)
                                VALUES (?,?,?,?,?,?,?,?)""",
                                (uid['id'], s.get('roll',''), s.get('dept',''),
                                 float(s.get('cgpa',0) or 0), float(s.get('attendance',0) or 0),
                                 float(s.get('resumeScore',0) or 0), chance, placed))
                os.rename(JSON_PATH, JSON_PATH+'.bak')
                print("✓ Migrated students.json")
            except Exception as e:
                print("⚠ JSON migration:", e)

# ── HELPERS ────────────────────────────────────────────────────────────────────
def hash_password(pw): return hashlib.sha256(pw.encode()).hexdigest()

def predict_rule_based(cgpa, attendance, resume_score, dept='CSE'):
    chance = round((resume_score/100)*50 + (cgpa/10)*35 + (attendance/100)*15)
    placed = "Placed" if (resume_score>=75 and cgpa>=7.5) or \
             (resume_score>=75 and cgpa>=7.0 and attendance>=70) else "Not Placed"
    return chance, placed

def get_student_by_email(db, email):
    return db.execute("""
        SELECT s.*, u.name, u.email, u.role
        FROM students s JOIN users u ON s.user_id=u.id
        WHERE u.email=?
    """, (email,)).fetchone()

def student_dict(s, u=None):
    return {
        'id': s['id'], 'name': s['name'] if 'name' in s.keys() else (u['name'] if u else ''),
        'email': s['email'] if 'email' in s.keys() else (u['email'] if u else ''),
        'roll': s['roll_number'], 'dept': s['branch'], 'year': s['year'],
        'gender': s['gender'], 'cgpa': s['cgpa'],
        'attendance': s['attendance'], 'resumeScore': s['resume_score'],
        'placementChance': s['placement_chance'], 'placed': s['placed']
    }

# ── AUTH ROUTES ────────────────────────────────────────────────────────────────
@app.route('/api/register', methods=['POST'])
def register():
    try:
        d = request.get_json()
        name = d.get('name','').strip()
        email = d.get('email','').strip().lower()
        password = d.get('password','')
        role = d.get('role','Student')
        roll = d.get('roll','').strip()
        dept = d.get('dept','').strip()
        cgpa = float(d.get('cgpa',0) or 0)
        attendance = float(d.get('attendance',0) or 0)
        resume_score = float(d.get('resumeScore',0) or 0)
        gender = d.get('gender','Unspecified')
        year = int(d.get('year',3) or 3)

        if not all([name, email, password]):
            return jsonify({'error':'Name, email and password are required'}), 400

        with get_db() as db:
            if db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone():
                return jsonify({'error':'Email already registered'}), 400
            db.execute("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                       (name, email, hash_password(password), role))
            uid = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()['id']
            chance, placed = 0, 'Not Placed'
            if role == 'Student':
                chance, placed = predict_rule_based(cgpa, attendance, resume_score, dept)
                db.execute("""INSERT INTO students
                    (user_id,roll_number,branch,year,gender,cgpa,attendance,resume_score,placement_chance,placed)
                    VALUES (?,?,?,?,?,?,?,?,?,?)""",
                    (uid, roll, dept, year, gender, cgpa, attendance, resume_score, chance, placed))
        return jsonify({'message':f'Account created for {name}',
                        'placementChance':chance,'placed':placed}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        d = request.get_json()
        email = d.get('email','').strip().lower()
        password = d.get('password','')
        if not email or not password:
            return jsonify({'error':'Email and password required'}), 400
        with get_db() as db:
            u = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not u:
            return jsonify({'error':'No account found with this email'}), 401
        if u['password_hash'] != hash_password(password):
            return jsonify({'error':'Incorrect password'}), 401
        with get_db() as db:
            s = db.execute("SELECT * FROM students WHERE user_id=?", (u['id'],)).fetchone()
        return jsonify({'message':'Login successful','user':{
            'name':u['name'],'email':u['email'],'role':u['role'],
            'dept': s['branch'] if s else 'N/A',
            'roll': s['roll_number'] if s else 'N/A',
            'cgpa': s['cgpa'] if s else 0,
            'attendance': s['attendance'] if s else 0,
            'resumeScore': s['resume_score'] if s else 0,
        }}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/google-login', methods=['POST'])
def google_login():
    try:
        d = request.get_json()
        email = d.get('email','').strip().lower()
        name = d.get('name','').strip()
        if not email:
            return jsonify({'error':'Email required'}), 400
        with get_db() as db:
            u = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            if not u:
                db.execute("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                           (name, email, '', 'Student'))
                u = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
                db.execute("INSERT INTO students (user_id,roll_number,branch) VALUES (?,?,?)",
                           (u['id'],'N/A','N/A'))
            s = db.execute("SELECT * FROM students WHERE user_id=?", (u['id'],)).fetchone()
        profile_complete = bool(s and s['roll_number'] not in ('','N/A',None) and s['cgpa'] and float(s['cgpa']) > 0)
        return jsonify({'message':'Login successful','profile_complete': profile_complete,'user':{
            'name':u['name'],'email':u['email'],'role':u['role'],
            'dept': s['branch'] if s else 'N/A',
            'roll': s['roll_number'] if s else 'N/A',
            'cgpa': s['cgpa'] if s else 0,
            'attendance': s['attendance'] if s else 0,
            'resumeScore': s['resume_score'] if s else 0,
        }}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/change-password', methods=['POST'])
def change_password():
    try:
        d = request.get_json()
        email = d.get('email','').strip().lower()
        cur = d.get('currentPassword','')
        new = d.get('newPassword','')
        if not all([email, cur, new]):
            return jsonify({'error':'All fields required'}), 400
        with get_db() as db:
            u = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
            if not u: return jsonify({'error':'User not found'}), 404
            if u['password_hash'] != hash_password(cur):
                return jsonify({'error':'Incorrect current password'}), 401
            db.execute("UPDATE users SET password_hash=? WHERE email=?", (hash_password(new), email))
        return jsonify({'message':'Password updated successfully'}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/update-profile', methods=['POST'])
def update_profile():
    try:
        d = request.get_json()
        email = d.get('email','').strip().lower()
        roll  = d.get('roll','').strip()
        dept  = d.get('dept','').strip()
        cgpa  = float(d.get('cgpa', 0) or 0)
        attendance   = float(d.get('attendance', 0) or 0)
        resume_score = float(d.get('resumeScore', 0) or 0)
        if not email:
            return jsonify({'error': 'Email required'}), 400
        with get_db() as db:
            u = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            if not u:
                return jsonify({'error': 'User not found'}), 404
            chance, placed = predict_rule_based(cgpa, attendance, resume_score, dept)
            db.execute("""UPDATE students
                SET roll_number=?, branch=?, cgpa=?, attendance=?,
                    resume_score=?, placement_chance=?, placed=?
                WHERE user_id=?""",
                (roll, dept, cgpa, attendance, resume_score, chance, placed, u['id']))
        return jsonify({'message': 'Profile updated', 'placementChance': chance, 'placed': placed}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        with get_db() as db:
            rows = db.execute("""
                SELECT s.*, u.name, u.email, u.role
                FROM students s JOIN users u ON s.user_id=u.id
            """).fetchall()
        return jsonify([student_dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/add_student', methods=['POST'])
def add_student():
    try:
        d = request.get_json()
        name = d.get('name','').strip()
        email = d.get('email','').strip().lower()
        dept = d.get('dept','').strip()
        cgpa = float(d.get('cgpa',0) or 0)
        attendance = float(d.get('attendance',0) or 0)
        resume_score = float(d.get('resumeScore',0) or 0)
        chance, placed = predict_rule_based(cgpa, attendance, resume_score, dept)
        with get_db() as db:
            u = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            if not u:
                db.execute("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
                           (name, email, '', 'Student'))
                u = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
            uid = u['id']
            s = db.execute("SELECT id FROM students WHERE user_id=?", (uid,)).fetchone()
            if s:
                db.execute("""UPDATE students SET branch=?,cgpa=?,attendance=?,resume_score=?,
                    placement_chance=?,placed=? WHERE id=?""",
                    (dept, cgpa, attendance, resume_score, chance, placed, s['id']))
            else:
                db.execute("""INSERT INTO students (user_id,branch,cgpa,attendance,resume_score,placement_chance,placed)
                    VALUES (?,?,?,?,?,?,?)""", (uid, dept, cgpa, attendance, resume_score, chance, placed))
        return jsonify({'message':f'{name} saved','placementChance':chance,'placed':placed}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/users', methods=['GET'])
def get_users():
    try:
        with get_db() as db:
            rows = db.execute("SELECT id,name,email,role FROM users").fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── TIMELINES ──────────────────────────────────────────────────────────────────
@app.route('/api/students/<int:sid>/timeline', methods=['GET'])
def get_timeline(sid):
    try:
        with get_db() as db:
            rows = db.execute("SELECT * FROM student_timelines WHERE student_id=? ORDER BY semester",
                              (sid,)).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/students/<int:sid>/timeline', methods=['POST'])
def add_timeline(sid):
    try:
        d = request.get_json()
        with get_db() as db:
            db.execute("""INSERT INTO student_timelines
                (student_id,semester,cgpa,attendance_rate,avg_test_score,feature_snapshot_json)
                VALUES (?,?,?,?,?,?)""",
                (sid, d.get('semester'), d.get('cgpa'), d.get('attendance_rate'),
                 d.get('avg_test_score'), json.dumps(d.get('feature_snapshot',{}))))
        return jsonify({'message':'Timeline entry added'}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── CERTIFICATIONS ─────────────────────────────────────────────────────────────
@app.route('/api/students/<int:sid>/certifications', methods=['GET'])
def get_certs(sid):
    try:
        with get_db() as db:
            rows = db.execute("SELECT * FROM certifications WHERE student_id=?", (sid,)).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/students/<int:sid>/certifications', methods=['POST'])
def add_cert(sid):
    try:
        d = request.get_json()
        with get_db() as db:
            db.execute("INSERT INTO certifications (student_id,name,provider,date,verified) VALUES (?,?,?,?,?)",
                       (sid, d.get('name'), d.get('provider'), d.get('date'), int(d.get('verified',0))))
        return jsonify({'message':'Certification added'}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/certifications/<int:cid>', methods=['DELETE'])
def delete_cert(cid):
    try:
        with get_db() as db:
            db.execute("DELETE FROM certifications WHERE id=?", (cid,))
        return jsonify({'message':'Deleted'}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── PROJECTS ───────────────────────────────────────────────────────────────────
@app.route('/api/students/<int:sid>/projects', methods=['GET'])
def get_projects(sid):
    try:
        with get_db() as db:
            rows = db.execute("SELECT * FROM projects WHERE student_id=?", (sid,)).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/students/<int:sid>/projects', methods=['POST'])
def add_project(sid):
    try:
        d = request.get_json()
        with get_db() as db:
            db.execute("INSERT INTO projects (student_id,title,description,tech_stack,github_url) VALUES (?,?,?,?,?)",
                       (sid, d.get('title'), d.get('description'), d.get('tech_stack'), d.get('github_url')))
        return jsonify({'message':'Project added'}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/projects/<int:pid>', methods=['DELETE'])
def delete_project(pid):
    try:
        with get_db() as db:
            db.execute("DELETE FROM projects WHERE id=?", (pid,))
        return jsonify({'message':'Deleted'}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── PLACEMENT OUTCOMES ─────────────────────────────────────────────────────────
@app.route('/api/students/<int:sid>/outcomes', methods=['GET'])
def get_outcomes(sid):
    try:
        with get_db() as db:
            rows = db.execute("SELECT * FROM placement_outcomes WHERE student_id=?", (sid,)).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/students/<int:sid>/outcomes', methods=['POST'])
def add_outcome(sid):
    try:
        d = request.get_json()
        with get_db() as db:
            db.execute("""INSERT INTO placement_outcomes (student_id,placed,company,package,role,year)
                VALUES (?,?,?,?,?,?)""",
                (sid, int(d.get('placed',0)), d.get('company'), float(d.get('package',0) or 0),
                 d.get('role'), d.get('year', datetime.now().year)))
            # Also update main placed status
            if d.get('placed'):
                db.execute("UPDATE students SET placed='Placed' WHERE id=?", (sid,))
        return jsonify({'message':'Outcome recorded'}), 201
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── PREDICTIONS ────────────────────────────────────────────────────────────────
@app.route('/api/students/<int:sid>/predictions', methods=['GET'])
def get_predictions(sid):
    try:
        with get_db() as db:
            rows = db.execute("SELECT * FROM predictions WHERE student_id=? ORDER BY prediction_date DESC",
                              (sid,)).fetchall()
        return jsonify([dict(r) for r in rows]), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        d = request.get_json()
        cgpa = float(d.get('cgpa',0))
        attendance = float(d.get('attendance',0))
        resume_score = float(d.get('resumeScore',0))
        dept = str(d.get('dept','CSE'))
        if not (0<=cgpa<=10): return jsonify({'error':'CGPA must be 0–10'}), 400
        if not (0<=attendance<=100): return jsonify({'error':'Attendance 0–100'}), 400
        if not (0<=resume_score<=100): return jsonify({'error':'Resume score 0–100'}), 400
        chance, placed = predict_rule_based(cgpa, attendance, resume_score, dept)

        # Determine package tier
        if chance >= 80: tier = 'High (10–25 LPA)'
        elif chance >= 60: tier = 'Mid (5–10 LPA)'
        elif chance >= 40: tier = 'Low (3–5 LPA)'
        else: tier = 'Below Average'

        # Compute skill gaps
        gaps = []
        if cgpa < 7: gaps.append('Improve CGPA above 7.0')
        if attendance < 80: gaps.append('Attendance below 80%')
        if resume_score < 75: gaps.append('Strengthen resume score')
        if cgpa < 8 and chance >= 50: gaps.append('Target CGPA 8+ for top companies')

        sid = d.get('student_id')
        if sid:
            with get_db() as db:
                db.execute("""INSERT INTO predictions
                    (student_id,placement_prob,package_tier,top_gaps_json,shap_values_json)
                    VALUES (?,?,?,?,?)""",
                    (sid, chance, tier, json.dumps(gaps), json.dumps({'cgpa':35,'resume':50,'attendance':15})))

        return jsonify({'placementChance':chance,'placed':placed,'dept':dept,
                        'cgpa':cgpa,'attendance':attendance,'resumeScore':resume_score,
                        'packageTier':tier,'topGaps':gaps}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── STATS ──────────────────────────────────────────────────────────────────────
@app.route('/api/stats', methods=['GET'])
def stats():
    try:
        with get_db() as db:
            total   = db.execute("SELECT COUNT(*) FROM students").fetchone()[0]
            placed  = db.execute("SELECT COUNT(*) FROM students WHERE placed='Placed'").fetchone()[0]
            avg_cgpa= db.execute("SELECT AVG(cgpa) FROM students").fetchone()[0] or 0
            certs   = db.execute("SELECT COUNT(*) FROM certifications").fetchone()[0]
            projs   = db.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
        return jsonify({'totalStudents':total,'placedStudents':placed,
                        'avgCgpa':round(avg_cgpa,2),
                        'placementRate':round(placed/total*100 if total else 0,1),
                        'totalCertifications':certs,'totalProjects':projs}), 200
    except Exception as e:
        return jsonify({'error':str(e)}), 500

# ── PAGE ROUTES ────────────────────────────────────────────────────────────────
@app.route('/') 
@app.route('/login')
def serve_login(): return send_from_directory(BASE_DIR, 'login.html')

@app.route('/student')
def serve_student(): return send_from_directory(BASE_DIR, 'student.html')

@app.route('/admin')
def serve_admin(): return send_from_directory(BASE_DIR, 'admin.html')

@app.route('/tpo')
def serve_tpo(): return send_from_directory(BASE_DIR, 'tpo.html')

@app.route('/profile')
def serve_profile(): return send_from_directory(BASE_DIR, 'profile.html')

# ── HEALTH ─────────────────────────────────────────────────────────────────────
@app.route('/api/health', methods=['GET'])
def health():
    with get_db() as db:
        tables = {t['name']: db.execute(f"SELECT COUNT(*) FROM {t['name']}").fetchone()[0]
                  for t in db.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()}
    return jsonify({'status':'ok','database':'SQLite','tables':tables})

if __name__ == '__main__':
    check_schema()
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)