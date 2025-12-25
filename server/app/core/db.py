from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import sqlite3
import hashlib
import secrets
from typing import Iterator, Optional
from uuid import uuid4

BASE_DIR = Path(__file__).resolve().parents[3]
DATA_DIR = BASE_DIR / "data"
DB_PATH = DATA_DIR / "odin.db"
IMAGES_DIR = DATA_DIR / "images"


def init_db() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  IMAGES_DIR.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(DB_PATH)
  try:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_prompt TEXT,
        last_slide_context TEXT,
        UNIQUE(owner_id, name)
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS generations (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        image_path TEXT NOT NULL,
        description TEXT NOT NULL,
        aspect_ratio TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_sub TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TEXT NOT NULL
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      """
    )
    _maybe_migrate(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at)")
    conn.commit()
  finally:
    conn.close()


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  conn.execute("PRAGMA foreign_keys=ON;")
  try:
    yield conn
    conn.commit()
  finally:
    conn.close()


def _rebuild_users_table(conn: sqlite3.Connection, user_columns: set[str]) -> None:
  conn.execute("PRAGMA foreign_keys=OFF;")
  conn.execute("ALTER TABLE users RENAME TO users_old")
  conn.execute(
    """
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      google_sub TEXT UNIQUE,
      email TEXT UNIQUE,
      name TEXT,
      username TEXT UNIQUE,
      password_hash TEXT,
      created_at TEXT NOT NULL
    )
    """
  )
  google_sub_expr = "google_sub" if "google_sub" in user_columns else "NULL AS google_sub"
  email_expr = "email" if "email" in user_columns else "NULL AS email"
  name_expr = "name" if "name" in user_columns else "NULL AS name"
  username_expr = "username" if "username" in user_columns else "NULL AS username"
  password_expr = "password_hash" if "password_hash" in user_columns else "NULL AS password_hash"
  created_expr = "created_at" if "created_at" in user_columns else "'' AS created_at"
  conn.execute(
    f"""
    INSERT INTO users (id, google_sub, email, name, username, password_hash, created_at)
    SELECT id, {google_sub_expr}, {email_expr}, {name_expr}, {username_expr}, {password_expr}, {created_expr}
    FROM users_old
    """
  )
  conn.execute("DROP TABLE users_old")

  session_columns = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
  if session_columns:
    conn.execute("ALTER TABLE sessions RENAME TO sessions_old")
    conn.execute(
      """
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      """
    )
    conn.execute(
      """
      INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
      SELECT id, user_id, token_hash, created_at, expires_at
      FROM sessions_old
      """
    )
    conn.execute("DROP TABLE sessions_old")

  conn.execute("PRAGMA foreign_keys=ON;")


def _rebuild_sessions_table(conn: sqlite3.Connection) -> None:
  session_columns = {row[1] for row in conn.execute("PRAGMA table_info(sessions)")}
  if not session_columns:
    return
  conn.execute("PRAGMA foreign_keys=OFF;")
  conn.execute("ALTER TABLE sessions RENAME TO sessions_old")
  conn.execute(
    """
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """
  )
  conn.execute(
    """
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    SELECT id, user_id, token_hash, created_at, expires_at
    FROM sessions_old
    """
  )
  conn.execute("DROP TABLE sessions_old")
  conn.execute("PRAGMA foreign_keys=ON;")


def _maybe_migrate(conn: sqlite3.Connection) -> None:
  columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)")}
  if "owner_id" not in columns:
    conn.execute("ALTER TABLE projects ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'local'")
    conn.execute("UPDATE projects SET owner_id = 'local' WHERE owner_id IS NULL")

  user_info = list(conn.execute("PRAGMA table_info(users)"))
  user_columns = {row[1] for row in user_info}
  if user_columns:
    requires_rebuild = False
    for row in user_info:
      if row[1] in {"google_sub", "email"} and row[3] == 1:
        requires_rebuild = True
        break
    if requires_rebuild:
      _rebuild_users_table(conn, user_columns)
      user_columns = {"id", "google_sub", "email", "name", "username", "password_hash", "created_at"}
    fk_targets = {row[2] for row in conn.execute("PRAGMA foreign_key_list(sessions)")}
    if "users_old" in fk_targets:
      _rebuild_sessions_table(conn)
    if "username" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
    if "password_hash" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")


def get_or_create_project(
  conn: sqlite3.Connection,
  *,
  name: str,
  owner_id: str,
  updated_at: str,
  prompt: str,
  slide_context: str,
) -> str:
  existing = conn.execute(
    "SELECT id FROM projects WHERE owner_id = ? AND name = ?",
    (owner_id, name),
  ).fetchone()
  if existing:
    conn.execute(
      """
      UPDATE projects
      SET updated_at = ?, last_prompt = ?, last_slide_context = ?
      WHERE id = ?
      """,
      (updated_at, prompt, slide_context, existing["id"]),
    )
    return str(existing["id"])

  project_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO projects (id, owner_id, name, created_at, updated_at, last_prompt, last_slide_context)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """,
    (project_id, owner_id, name, updated_at, updated_at, prompt, slide_context),
  )
  return project_id


def save_generated_image(image_bytes: bytes, image_id: Optional[str] = None) -> str:
  if not image_id:
    image_id = str(uuid4())
  relative_path = Path("images") / f"{image_id}.png"
  full_path = DATA_DIR / relative_path
  full_path.write_bytes(image_bytes)
  return str(relative_path)


def insert_generation(
  conn: sqlite3.Connection,
  *,
  generation_id: str,
  project_id: str,
  image_path: str,
  description: str,
  aspect_ratio: str,
  created_at: str,
) -> None:
  conn.execute(
    """
    INSERT INTO generations (id, project_id, image_path, description, aspect_ratio, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
    """,
    (generation_id, project_id, image_path, description, aspect_ratio, created_at),
  )


def get_or_create_user(
  conn: sqlite3.Connection,
  *,
  google_sub: str,
  email: str,
  name: str,
  created_at: str,
) -> str:
  existing = conn.execute("SELECT id FROM users WHERE google_sub = ?", (google_sub,)).fetchone()
  if existing:
    conn.execute("UPDATE users SET email = ?, name = ? WHERE id = ?", (email, name, existing["id"]))
    return str(existing["id"])

  user_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO users (id, google_sub, email, name, created_at)
    VALUES (?, ?, ?, ?, ?)
    """,
    (user_id, google_sub, email, name, created_at),
  )
  return user_id


def get_user_by_username(conn: sqlite3.Connection, username: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT id, username, password_hash FROM users
    WHERE username = ?
    """,
    (username,),
  ).fetchone()
  return dict(row) if row else None


def create_user_with_password(
  conn: sqlite3.Connection,
  *,
  username: str,
  password_hash: str,
  created_at: str,
) -> str:
  user_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO users (id, username, password_hash, created_at)
    VALUES (?, ?, ?, ?)
    """,
    (user_id, username, password_hash, created_at),
  )
  return user_id


def create_session(conn: sqlite3.Connection, *, user_id: str, created_at: str, expires_at: str) -> str:
  raw = secrets.token_urlsafe(32)
  token_hash = hashlib.sha256(raw.encode("utf-8")).hexdigest()
  session_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO sessions (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    """,
    (session_id, user_id, token_hash, created_at, expires_at),
  )
  return raw


def get_user_id_for_token(conn: sqlite3.Connection, token: str, now: str) -> Optional[str]:
  token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
  row = conn.execute(
    """
    SELECT user_id FROM sessions
    WHERE token_hash = ? AND expires_at > ?
    """,
    (token_hash, now),
  ).fetchone()
  return str(row["user_id"]) if row else None


def update_project_name(
  conn: sqlite3.Connection,
  *,
  owner_id: str,
  project_id: str,
  name: str,
  updated_at: str,
  prompt: str,
  slide_context: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE projects
    SET name = ?, updated_at = ?, last_prompt = ?, last_slide_context = ?
    WHERE owner_id = ? AND id = ?
    """,
    (name, updated_at, prompt, slide_context, owner_id, project_id),
  )
  return cursor.rowcount > 0


def list_projects(conn: sqlite3.Connection, owner_id: str) -> list[dict]:
  rows = conn.execute(
    """
    SELECT
      projects.id,
      projects.name,
      projects.created_at,
      projects.updated_at,
      projects.last_prompt,
      projects.last_slide_context,
      COUNT(generations.id) AS generation_count
    FROM projects
    LEFT JOIN generations ON generations.project_id = projects.id
    WHERE projects.owner_id = ?
    GROUP BY projects.id
    ORDER BY projects.updated_at DESC
    """,
    (owner_id,),
  ).fetchall()
  return [dict(row) for row in rows]


def get_project(conn: sqlite3.Connection, owner_id: str, project_id: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT id, name, created_at, updated_at, last_prompt, last_slide_context
    FROM projects
    WHERE owner_id = ? AND id = ?
    """,
    (owner_id, project_id),
  ).fetchone()
  return dict(row) if row else None


def list_generations(conn: sqlite3.Connection, project_id: str) -> list[dict]:
  rows = conn.execute(
    """
    SELECT id, image_path, description, aspect_ratio, created_at
    FROM generations
    WHERE project_id = ?
    ORDER BY created_at DESC
    """,
    (project_id,),
  ).fetchall()
  return [dict(row) for row in rows]


def get_generation_image_path(conn: sqlite3.Connection, generation_id: str) -> Optional[str]:
  row = conn.execute(
    "SELECT image_path FROM generations WHERE id = ?",
    (generation_id,),
  ).fetchone()
  return str(row["image_path"]) if row else None
