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
SLIDES_DIR = DATA_DIR / "slides"


def _hash_token(token: str) -> str:
  return hashlib.sha256(token.encode("utf-8")).hexdigest()


def init_db() -> None:
  DATA_DIR.mkdir(parents=True, exist_ok=True)
  IMAGES_DIR.mkdir(parents=True, exist_ok=True)
  SLIDES_DIR.mkdir(parents=True, exist_ok=True)
  conn = sqlite3.connect(DB_PATH)
  try:
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=5000;")
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
        slide_image_path TEXT,
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
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS payment_orders (
        order_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        idempotency_key TEXT,
        plan_id TEXT NOT NULL,
        gross_amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        customer_email TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        status TEXT NOT NULL,
        snap_token TEXT,
        transaction_status TEXT,
        fraud_status TEXT,
        status_code TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        paid_at TEXT,
        last_notification_json TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS payment_events (
        id TEXT PRIMARY KEY,
        order_id TEXT,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        received_at TEXT NOT NULL
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS subscriptions (
        user_id TEXT PRIMARY KEY,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL,
        order_id TEXT,
        started_at TEXT,
        current_period_end TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      """
    )
    conn.execute(
      """
      CREATE TABLE IF NOT EXISTS subscription_periods (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        order_id TEXT NOT NULL,
        plan_id TEXT NOT NULL,
        status TEXT NOT NULL,
        period_start TEXT NOT NULL,
        period_end TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
      """
    )
    _maybe_migrate(conn)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON projects(owner_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_generations_project_id ON generations(project_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_generations_created_at ON generations(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens_user_id ON password_reset_tokens(user_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires_at ON password_reset_tokens(expires_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON payment_orders(status)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON payment_orders(created_at)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_orders_user_id ON payment_orders(user_id)")
    conn.execute(
      """
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_idempotency
      ON payment_orders(user_id, idempotency_key)
      WHERE idempotency_key IS NOT NULL
      """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_payment_events_order_id ON payment_events(order_id)")
    conn.execute(
      "CREATE INDEX IF NOT EXISTS idx_payment_events_order_received ON payment_events(order_id, received_at)"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_subscription_periods_user_id ON subscription_periods(user_id)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_periods_order_id ON subscription_periods(order_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status)")
    conn.commit()
  finally:
    conn.close()


@contextmanager
def db_connection() -> Iterator[sqlite3.Connection]:
  conn = sqlite3.connect(DB_PATH)
  conn.row_factory = sqlite3.Row
  conn.execute("PRAGMA busy_timeout=5000;")
  conn.execute("PRAGMA foreign_keys=ON;")
  try:
    yield conn
    conn.commit()
  finally:
    conn.close()


def _rebuild_users_table(conn: sqlite3.Connection, user_columns: set[str]) -> None:
  conn.execute("PRAGMA foreign_keys=OFF;")
  conn.execute("ALTER TABLE users RENAME TO users_old")
  should_copy_users = "email" in user_columns
  if should_copy_users:
    null_email_count = conn.execute(
      "SELECT COUNT(*) FROM users_old WHERE email IS NULL OR email = ''"
    ).fetchone()[0]
    if null_email_count:
      should_copy_users = False
  conn.execute(
    """
    CREATE TABLE users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT,
      email_verified INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
    """
  )
  email_expr = "email" if "email" in user_columns else "NULL AS email"
  username_expr = "username" if "username" in user_columns else "NULL AS username"
  password_expr = "password_hash" if "password_hash" in user_columns else "NULL AS password_hash"
  name_expr = "name" if "name" in user_columns else "NULL AS name"
  verified_expr = "email_verified" if "email_verified" in user_columns else "0 AS email_verified"
  created_expr = "created_at" if "created_at" in user_columns else "'' AS created_at"
  if should_copy_users:
    conn.execute(
      f"""
      INSERT INTO users (id, email, username, password_hash, name, email_verified, created_at)
      SELECT id, {email_expr}, {username_expr}, {password_expr}, {name_expr}, {verified_expr}, {created_expr}
      FROM users_old
      """
    )
  conn.execute("DROP TABLE users_old")

  existing = conn.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'password_reset_tokens'",
  ).fetchone()
  if existing:
    conn.execute("DROP TABLE password_reset_tokens")
  conn.execute(
    """
    CREATE TABLE password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """
  )

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
    if should_copy_users:
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


def _rebuild_payment_orders_table(
  conn: sqlite3.Connection,
  payment_columns: set[str],
  *,
  enforce_user_not_null: bool,
) -> None:
  conn.execute("PRAGMA foreign_keys=OFF;")
  conn.execute("ALTER TABLE payment_orders RENAME TO payment_orders_old")
  user_id_column = "TEXT NOT NULL" if enforce_user_not_null else "TEXT"
  conn.execute(
    f"""
    CREATE TABLE payment_orders (
      order_id TEXT PRIMARY KEY,
      user_id {user_id_column},
      idempotency_key TEXT,
      plan_id TEXT NOT NULL,
      gross_amount INTEGER NOT NULL,
      currency TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      status TEXT NOT NULL,
      snap_token TEXT,
      transaction_status TEXT,
      fraud_status TEXT,
      status_code TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      paid_at TEXT,
      last_notification_json TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """
  )
  columns = [
    "order_id",
    "user_id",
    "idempotency_key",
    "plan_id",
    "gross_amount",
    "currency",
    "customer_name",
    "customer_email",
    "customer_phone",
    "status",
    "snap_token",
    "transaction_status",
    "fraud_status",
    "status_code",
    "created_at",
    "updated_at",
    "paid_at",
    "last_notification_json",
  ]
  select_exprs = [
    column if column in payment_columns else f"NULL AS {column}"
    for column in columns
  ]
  conn.execute(
    f"""
    INSERT INTO payment_orders ({", ".join(columns)})
    SELECT {", ".join(select_exprs)}
    FROM payment_orders_old
    """
  )
  conn.execute("DROP TABLE payment_orders_old")
  conn.execute("PRAGMA foreign_keys=ON;")


def _maybe_migrate(conn: sqlite3.Connection) -> None:
  columns = {row[1] for row in conn.execute("PRAGMA table_info(projects)")}
  if "owner_id" not in columns:
    conn.execute("ALTER TABLE projects ADD COLUMN owner_id TEXT NOT NULL DEFAULT 'local'")
    conn.execute("UPDATE projects SET owner_id = 'local' WHERE owner_id IS NULL")
  if "slide_image_path" not in columns:
    conn.execute("ALTER TABLE projects ADD COLUMN slide_image_path TEXT")

  user_info = list(conn.execute("PRAGMA table_info(users)"))
  user_columns = {row[1] for row in user_info}
  if user_columns:
    required_columns = {"id", "email", "username", "password_hash", "name", "email_verified", "created_at"}
    deprecated_columns = {"google_sub"}
    requires_rebuild = (
      not required_columns.issubset(user_columns)
      or bool(deprecated_columns.intersection(user_columns))
    )
    if requires_rebuild:
      _rebuild_users_table(conn, user_columns)
      user_columns = required_columns
    fk_targets = {row[2] for row in conn.execute("PRAGMA foreign_key_list(sessions)")}
    if "users_old" in fk_targets:
      _rebuild_sessions_table(conn)
    if "name" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN name TEXT")
    if "email" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN email TEXT")
    if "username" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN username TEXT")
    if "password_hash" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
    if "email_verified" not in user_columns:
      conn.execute("ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)")

  payment_info = list(conn.execute("PRAGMA table_info(payment_orders)"))
  payment_columns = {row[1]: row for row in payment_info}
  if payment_columns:
    payment_fks = list(conn.execute("PRAGMA foreign_key_list(payment_orders)"))
    has_user_fk = any(row[2] == "users" and row[3] == "user_id" for row in payment_fks)
    user_not_null = bool(payment_columns.get("user_id")) and payment_columns["user_id"][3] == 1
    null_user_count = 0
    if "user_id" in payment_columns:
      null_user_count = conn.execute(
        "SELECT COUNT(*) FROM payment_orders WHERE user_id IS NULL OR user_id = ''"
      ).fetchone()[0]
    enforce_user_not_null = "user_id" in payment_columns and null_user_count == 0
    needs_rebuild = (not has_user_fk) or (enforce_user_not_null and not user_not_null)
    if needs_rebuild:
      _rebuild_payment_orders_table(
        conn,
        set(payment_columns),
        enforce_user_not_null=enforce_user_not_null,
      )
      payment_columns = {row[1]: row for row in conn.execute("PRAGMA table_info(payment_orders)")}
    if "user_id" not in payment_columns:
      conn.execute("ALTER TABLE payment_orders ADD COLUMN user_id TEXT")
    if "idempotency_key" not in payment_columns:
      conn.execute("ALTER TABLE payment_orders ADD COLUMN idempotency_key TEXT")
    if "paid_at" not in payment_columns:
      conn.execute("ALTER TABLE payment_orders ADD COLUMN paid_at TEXT")
  conn.execute(
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_idempotency
    ON payment_orders(user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL
    """
  )


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


def save_slide_image(image_bytes: bytes, project_id: str) -> str:
  relative_path = Path("slides") / f"{project_id}.png"
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


def get_user_by_username(conn: sqlite3.Connection, username: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT id, email, username, password_hash, email_verified FROM users
    WHERE username = ?
    """,
    (username,),
  ).fetchone()
  return dict(row) if row else None


def get_user_by_email(conn: sqlite3.Connection, email: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT id, email, username, password_hash, email_verified FROM users
    WHERE email = ?
    """,
    (email,),
  ).fetchone()
  return dict(row) if row else None


def create_user_with_password(
  conn: sqlite3.Connection,
  *,
  email: str,
  username: str,
  password_hash: str,
  name: str,
  created_at: str,
) -> str:
  user_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO users (id, email, username, password_hash, name, email_verified, created_at)
    VALUES (?, ?, ?, ?, ?, 1, ?)
    """,
    (user_id, email, username, password_hash, name, created_at),
  )
  return user_id


def update_user_password(conn: sqlite3.Connection, user_id: str, password_hash: str) -> None:
  conn.execute(
    "UPDATE users SET password_hash = ? WHERE id = ?",
    (password_hash, user_id),
  )


def delete_user(conn: sqlite3.Connection, user_id: str) -> None:
  conn.execute(
    "DELETE FROM users WHERE id = ?",
    (user_id,),
  )


def create_session(conn: sqlite3.Connection, *, user_id: str, created_at: str, expires_at: str) -> str:
  raw = secrets.token_urlsafe(32)
  token_hash = _hash_token(raw)
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
  token_hash = _hash_token(token)
  row = conn.execute(
    """
    SELECT user_id FROM sessions
    WHERE token_hash = ? AND expires_at > ?
    """,
    (token_hash, now),
  ).fetchone()
  return str(row["user_id"]) if row else None


def create_password_reset_token(
  conn: sqlite3.Connection,
  *,
  user_id: str,
  created_at: str,
  expires_at: str,
) -> str:
  raw = secrets.token_urlsafe(32)
  token_hash = _hash_token(raw)
  token_id = str(uuid4())
  conn.execute(
    """
    INSERT INTO password_reset_tokens (id, user_id, token_hash, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?)
    """,
    (token_id, user_id, token_hash, created_at, expires_at),
  )
  return raw


def consume_password_reset_token(conn: sqlite3.Connection, *, token: str, now: str) -> Optional[str]:
  token_hash = _hash_token(token)
  row = conn.execute(
    """
    SELECT id, user_id FROM password_reset_tokens
    WHERE token_hash = ? AND expires_at > ? AND used_at IS NULL
    """,
    (token_hash, now),
  ).fetchone()
  if not row:
    return None
  conn.execute(
    "UPDATE password_reset_tokens SET used_at = ? WHERE id = ?",
    (now, row["id"]),
  )
  return str(row["user_id"])


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


def update_project_slide_image(
  conn: sqlite3.Connection,
  *,
  owner_id: str,
  project_id: str,
  slide_image_path: Optional[str],
  updated_at: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE projects
    SET slide_image_path = ?, updated_at = ?
    WHERE owner_id = ? AND id = ?
    """,
    (slide_image_path, updated_at, owner_id, project_id),
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
    SELECT id, name, created_at, updated_at, last_prompt, last_slide_context, slide_image_path
    FROM projects
    WHERE owner_id = ? AND id = ?
    """,
    (owner_id, project_id),
  ).fetchone()
  return dict(row) if row else None


def get_project_slide_image_path(
  conn: sqlite3.Connection,
  *,
  owner_id: str,
  project_id: str,
) -> Optional[str]:
  row = conn.execute(
    """
    SELECT slide_image_path
    FROM projects
    WHERE owner_id = ? AND id = ?
    """,
    (owner_id, project_id),
  ).fetchone()
  if not row:
    return None
  return str(row["slide_image_path"]) if row["slide_image_path"] else None


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


def list_generation_image_paths(conn: sqlite3.Connection, project_id: str) -> list[str]:
  rows = conn.execute(
    """
    SELECT image_path
    FROM generations
    WHERE project_id = ?
    """,
    (project_id,),
  ).fetchall()
  return [str(row["image_path"]) for row in rows]


def get_generation_image_path(conn: sqlite3.Connection, generation_id: str) -> Optional[str]:
  row = conn.execute(
    "SELECT image_path FROM generations WHERE id = ?",
    (generation_id,),
  ).fetchone()
  return str(row["image_path"]) if row else None


def get_generation_image_path_for_user(
  conn: sqlite3.Connection,
  *,
  generation_id: str,
  owner_id: str,
) -> Optional[str]:
  row = conn.execute(
    """
    SELECT generations.image_path
    FROM generations
    JOIN projects ON projects.id = generations.project_id
    WHERE generations.id = ? AND projects.owner_id = ?
    """,
    (generation_id, owner_id),
  ).fetchone()
  return str(row["image_path"]) if row else None


def delete_project(conn: sqlite3.Connection, owner_id: str, project_id: str) -> bool:
  cursor = conn.execute(
    """
    DELETE FROM projects
    WHERE owner_id = ? AND id = ?
    """,
    (owner_id, project_id),
  )
  return cursor.rowcount > 0


def create_payment_order(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  user_id: str,
  idempotency_key: Optional[str] = None,
  plan_id: str,
  gross_amount: int,
  currency: str,
  customer_name: str,
  customer_email: str,
  customer_phone: str,
  status: str,
  created_at: str,
  updated_at: str,
  snap_token: Optional[str] = None,
  transaction_status: Optional[str] = None,
  fraud_status: Optional[str] = None,
  status_code: Optional[str] = None,
  paid_at: Optional[str] = None,
  last_notification_json: Optional[str] = None,
) -> None:
  if not user_id:
    raise ValueError("user_id required")
  conn.execute(
    """
    INSERT INTO payment_orders (
      order_id,
      user_id,
      idempotency_key,
      plan_id,
      gross_amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      status,
      snap_token,
      transaction_status,
      fraud_status,
      status_code,
      created_at,
      updated_at,
      paid_at,
      last_notification_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (
      order_id,
      user_id,
      idempotency_key,
      plan_id,
      gross_amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      status,
      snap_token,
      transaction_status,
      fraud_status,
      status_code,
      created_at,
      updated_at,
      paid_at,
      last_notification_json,
    ),
  )


def get_payment_order(conn: sqlite3.Connection, order_id: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      order_id,
      user_id,
      idempotency_key,
      plan_id,
      gross_amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      status,
      snap_token,
      transaction_status,
      fraud_status,
      status_code,
      created_at,
      updated_at,
      paid_at,
      last_notification_json
    FROM payment_orders
    WHERE order_id = ?
    """,
    (order_id,),
  ).fetchone()
  return dict(row) if row else None


def get_payment_order_by_idempotency_key(
  conn: sqlite3.Connection,
  *,
  user_id: str,
  idempotency_key: str,
) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      order_id,
      user_id,
      idempotency_key,
      plan_id,
      gross_amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      status,
      snap_token,
      transaction_status,
      fraud_status,
      status_code,
      created_at,
      updated_at,
      paid_at,
      last_notification_json
    FROM payment_orders
    WHERE user_id = ? AND idempotency_key = ?
    """,
    (user_id, idempotency_key),
  ).fetchone()
  return dict(row) if row else None


def get_open_payment_order_for_user(
  conn: sqlite3.Connection,
  *,
  user_id: str,
) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      order_id,
      user_id,
      idempotency_key,
      plan_id,
      gross_amount,
      currency,
      customer_name,
      customer_email,
      customer_phone,
      status,
      snap_token,
      transaction_status,
      fraud_status,
      status_code,
      created_at,
      updated_at,
      paid_at,
      last_notification_json
    FROM payment_orders
    WHERE user_id = ? AND status NOT IN ('PAID', 'FAILED', 'REFUNDED')
    ORDER BY created_at DESC
    LIMIT 1
    """,
    (user_id,),
  ).fetchone()
  return dict(row) if row else None


def update_payment_order_token(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  snap_token: str,
  updated_at: str,
  status: Optional[str] = None,
) -> bool:
  if status is None:
    cursor = conn.execute(
      """
      UPDATE payment_orders
      SET snap_token = ?, updated_at = ?
      WHERE order_id = ?
      """,
      (snap_token, updated_at, order_id),
    )
  else:
    cursor = conn.execute(
      """
      UPDATE payment_orders
      SET snap_token = ?, status = ?, updated_at = ?
      WHERE order_id = ?
      """,
      (snap_token, status, updated_at, order_id),
    )
  return cursor.rowcount > 0


def update_payment_order_processing_status(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  status: str,
  updated_at: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE payment_orders
    SET status = ?, updated_at = ?
    WHERE order_id = ?
    """,
    (status, updated_at, order_id),
  )
  return cursor.rowcount > 0


def update_payment_order_expired(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  updated_at: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE payment_orders
    SET status = ?, updated_at = ?, snap_token = NULL
    WHERE order_id = ?
    """,
    ("FAILED", updated_at, order_id),
  )
  return cursor.rowcount > 0


def claim_payment_order_for_token(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  allowed_statuses: tuple[str, ...],
  updated_at: str,
) -> bool:
  if not allowed_statuses:
    return False
  placeholders = ", ".join("?" for _ in allowed_statuses)
  cursor = conn.execute(
    f"""
    UPDATE payment_orders
    SET status = ?, updated_at = ?
    WHERE order_id = ? AND status IN ({placeholders}) AND snap_token IS NULL
    """,
    ("CREATING", updated_at, order_id, *allowed_statuses),
  )
  return cursor.rowcount > 0


def update_payment_order_status(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  status: str,
  transaction_status: Optional[str],
  fraud_status: Optional[str],
  status_code: Optional[str],
  last_notification_json: Optional[str],
  paid_at: Optional[str],
  updated_at: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE payment_orders
    SET
      status = ?,
      transaction_status = ?,
      fraud_status = ?,
      status_code = ?,
      last_notification_json = ?,
      updated_at = ?,
      paid_at = ?
    WHERE order_id = ?
    """,
    (
      status,
      transaction_status,
      fraud_status,
      status_code,
      last_notification_json,
      updated_at,
      paid_at,
      order_id,
    ),
  )
  return cursor.rowcount > 0


def insert_payment_event(
  conn: sqlite3.Connection,
  *,
  event_id: str,
  order_id: Optional[str],
  event_type: str,
  payload_json: str,
  received_at: str,
) -> None:
  conn.execute(
    """
    INSERT INTO payment_events (
      id,
      order_id,
      event_type,
      payload_json,
      received_at
    )
    VALUES (?, ?, ?, ?, ?)
    """,
    (event_id, order_id, event_type, payload_json, received_at),
  )


def get_latest_payment_event(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  event_type: str,
) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      id,
      order_id,
      event_type,
      payload_json,
      received_at
    FROM payment_events
    WHERE order_id = ? AND event_type = ?
    ORDER BY received_at DESC
    LIMIT 1
    """,
    (order_id, event_type),
  ).fetchone()
  return dict(row) if row else None


def create_subscription_period(
  conn: sqlite3.Connection,
  *,
  period_id: str,
  user_id: str,
  order_id: str,
  plan_id: str,
  status: str,
  period_start: str,
  period_end: str,
  created_at: str,
  updated_at: str,
) -> None:
  conn.execute(
    """
    INSERT INTO subscription_periods (
      id,
      user_id,
      order_id,
      plan_id,
      status,
      period_start,
      period_end,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """,
    (
      period_id,
      user_id,
      order_id,
      plan_id,
      status,
      period_start,
      period_end,
      created_at,
      updated_at,
    ),
  )


def get_subscription_period_by_order_id(
  conn: sqlite3.Connection,
  *,
  order_id: str,
) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      id,
      user_id,
      order_id,
      plan_id,
      status,
      period_start,
      period_end,
      created_at,
      updated_at
    FROM subscription_periods
    WHERE order_id = ?
    """,
    (order_id,),
  ).fetchone()
  return dict(row) if row else None


def update_subscription_period_status(
  conn: sqlite3.Connection,
  *,
  order_id: str,
  status: str,
  updated_at: str,
) -> bool:
  cursor = conn.execute(
    """
    UPDATE subscription_periods
    SET status = ?, updated_at = ?
    WHERE order_id = ?
    """,
    (status, updated_at, order_id),
  )
  return cursor.rowcount > 0


def list_subscription_periods_for_user(
  conn: sqlite3.Connection,
  *,
  user_id: str,
) -> list[dict]:
  rows = conn.execute(
    """
    SELECT
      id,
      user_id,
      order_id,
      plan_id,
      status,
      period_start,
      period_end,
      created_at,
      updated_at
    FROM subscription_periods
    WHERE user_id = ?
    ORDER BY period_end DESC, created_at DESC
    """,
    (user_id,),
  ).fetchall()
  return [dict(row) for row in rows]


def get_latest_active_subscription_period(
  conn: sqlite3.Connection,
  *,
  user_id: str,
) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      id,
      user_id,
      order_id,
      plan_id,
      status,
      period_start,
      period_end,
      created_at,
      updated_at
    FROM subscription_periods
    WHERE user_id = ? AND status = 'active'
    ORDER BY period_end DESC
    LIMIT 1
    """,
    (user_id,),
  ).fetchone()
  return dict(row) if row else None


def get_subscription(conn: sqlite3.Connection, user_id: str) -> Optional[dict]:
  row = conn.execute(
    """
    SELECT
      user_id,
      plan_id,
      status,
      order_id,
      started_at,
      current_period_end,
      created_at,
      updated_at
    FROM subscriptions
    WHERE user_id = ?
    """,
    (user_id,),
  ).fetchone()
  return dict(row) if row else None


def upsert_subscription(
  conn: sqlite3.Connection,
  *,
  user_id: str,
  plan_id: str,
  status: str,
  order_id: Optional[str],
  started_at: Optional[str],
  current_period_end: Optional[str],
  created_at: str,
  updated_at: str,
) -> None:
  conn.execute(
    """
    INSERT INTO subscriptions (
      user_id,
      plan_id,
      status,
      order_id,
      started_at,
      current_period_end,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      plan_id = excluded.plan_id,
      status = excluded.status,
      order_id = excluded.order_id,
      started_at = CASE
        WHEN subscriptions.started_at IS NULL THEN excluded.started_at
        ELSE subscriptions.started_at
      END,
      current_period_end = CASE
        WHEN excluded.current_period_end IS NOT NULL THEN excluded.current_period_end
        ELSE subscriptions.current_period_end
      END,
      updated_at = excluded.updated_at
    """,
    (
      user_id,
      plan_id,
      status,
      order_id,
      started_at,
      current_period_end,
      created_at,
      updated_at,
    ),
  )
