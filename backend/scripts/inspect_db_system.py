import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

print("Importing settings...", flush=True)
from app.core.config import settings
print(f"DATABASE_URL starts with: {settings.DATABASE_URL.split('@')[-1] if '@' in settings.DATABASE_URL else 'local'}", flush=True)

print("Connecting engine...", flush=True)
from app.core.database import engine
from sqlalchemy import text, inspect

insp = inspect(engine)
print("Schemas:", insp.get_schema_names(), flush=True)

with engine.connect() as conn:
    schemas = [s for s in insp.get_schema_names() if s not in ['pg_catalog', 'information_schema', 'pg_toast']]
    for schema in schemas:
        tables = insp.get_table_names(schema=schema)
        print(f"\n--- Schema: {schema} ({len(tables)} tables) ---", flush=True)
        for t in sorted(tables):
            try:
                cnt = conn.execute(text(f'SELECT count(*) FROM "{schema}"."{t}"')).scalar()
                print(f"{schema}.{t}: {cnt} rows", flush=True)
            except Exception as e:
                print(f"{schema}.{t}: Error: {e}", flush=True)
print("\nDone inspection!", flush=True)
