import sys
import json
import uuid
import hashlib
from datetime import datetime, date, timezone
from pathlib import Path
from decimal import Decimal

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.database import engine, SessionLocal
from sqlalchemy import text, inspect

BACKUP_ROOT = Path(__file__).resolve().parent.parent / "storage" / "backups"

# Schema to operate on
TARGET_SCHEMA = "public"

# System tables that MUST be preserved
PRESERVED_TABLES = [
    "alembic_version",
    "users",
    "email_verification_tokens",
    "password_reset_tokens",
    "enterprise_integrations",
    "integration_health_checks",
]

# Business tables to be cleared, in strict foreign-key dependency order
BUSINESS_TABLES_TO_CLEAR = [
    "simulation_evidence_reports",
    "scenario_results",
    "scenarios",
    "recommendations",
    "risk_factors",
    "risk_predictions",
    "demand_forecasts",
    "model_runs",
    "sales",
    "purchases",
    "sales_transactions",
    "order_items",
    "orders",
    "shipments",
    "imported_records",
    "data_imports",
    "lead_time_observations",
    "demand_observations",
    "inventory",
    "external_data",
    "products",
    "warehouses",
    "suppliers",
]

def default_json_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, uuid.UUID):
        return str(obj)
    if isinstance(obj, bytes):
        return obj.hex()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def create_and_verify_backup():
    print("=" * 60, flush=True)
    print("STEP 1: CREATING COMPLETE DATABASE BACKUP", flush=True)
    print("=" * 60, flush=True)
    
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    backup_dir = BACKUP_ROOT / f"neon_public_backup_{timestamp}"
    backup_dir.mkdir(parents=True, exist_ok=True)
    
    insp = inspect(engine)
    all_public_tables = sorted(insp.get_table_names(schema=TARGET_SCHEMA))
    
    backup_manifest = {
        "timestamp": timestamp,
        "database": str(engine.url.database),
        "host": str(engine.url.host),
        "schema": TARGET_SCHEMA,
        "tables": {},
    }
    
    with engine.connect() as conn:
        for table in all_public_tables:
            # Query all rows
            result = conn.execute(text(f'SELECT * FROM "{TARGET_SCHEMA}"."{table}"'))
            columns = list(result.keys())
            rows = [dict(zip(columns, row)) for row in result.fetchall()]
            
            table_file = backup_dir / f"{table}.json"
            with open(table_file, "w", encoding="utf-8") as f:
                json.dump(rows, f, default=default_json_serializer, indent=2)
                
            backup_manifest["tables"][table] = {
                "file": f"{table}.json",
                "row_count": len(rows),
                "columns": columns,
            }
            print(f"Backed up table '{table}': {len(rows)} rows -> {table_file.name}", flush=True)
            
    manifest_path = backup_dir / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(backup_manifest, f, indent=2)
        
    print(f"\nManifest created at: {manifest_path}", flush=True)
    
    # ----------------------------------------------------
    # Verification of Backup
    # ----------------------------------------------------
    print("\n" + "=" * 60, flush=True)
    print("STEP 2: VERIFYING BACKUP INTEGRITY AGAINST DATABASE", flush=True)
    print("=" * 60, flush=True)
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        read_manifest = json.load(f)
        
    with engine.connect() as conn:
        for table, meta in read_manifest["tables"].items():
            expected_count = meta["row_count"]
            table_file = backup_dir / meta["file"]
            assert table_file.exists(), f"Backup file {table_file} missing!"
            
            with open(table_file, "r", encoding="utf-8") as f:
                loaded_rows = json.load(f)
            assert len(loaded_rows) == expected_count, f"Row count mismatch in file {meta['file']}: {len(loaded_rows)} vs {expected_count}"
            
            current_db_count = conn.execute(text(f'SELECT count(*) FROM "{TARGET_SCHEMA}"."{table}"')).scalar()
            assert current_db_count == expected_count, f"Database count changed during backup for {table}: {current_db_count} vs {expected_count}"
            print(f"VERIFIED: {table} ({expected_count} rows match exactly)", flush=True)
            
    print("\nBACKUP VERIFICATION COMPLETED SUCCESSFULLY!", flush=True)
    print(f"Verified Backup Directory: {backup_dir.resolve()}", flush=True)
    return backup_dir, read_manifest

def execute_safe_business_reset(verified_backup_dir):
    print("\n" + "=" * 60, flush=True)
    print("STEP 3: EXECUTING SAFE BUSINESS DATA RESET", flush=True)
    print("=" * 60, flush=True)
    
    db = SessionLocal()
    cleared_counts = {}
    try:
        # Execute deletion in strict topological order within a single transaction
        for table in BUSINESS_TABLES_TO_CLEAR:
            cnt = db.execute(text(f'SELECT count(*) FROM "{TARGET_SCHEMA}"."{table}"')).scalar()
            db.execute(text(f'DELETE FROM "{TARGET_SCHEMA}"."{table}"'))
            cleared_counts[table] = cnt
            print(f"Deleted {cnt} records from '{TARGET_SCHEMA}.{table}'", flush=True)
            
        db.commit()
        print("\nAll business tables cleared and transaction committed successfully!", flush=True)
    except Exception as e:
        db.rollback()
        print(f"\nCRITICAL ERROR during reset: {e}. Transaction rolled back!", flush=True)
        raise
    finally:
        db.close()
        
    # Clean up staged temp uploads
    temp_dir = Path(__file__).resolve().parent.parent / "storage" / "uploads_temp"
    cleaned_files = 0
    if temp_dir.exists():
        for f in temp_dir.glob("*"):
            if f.is_file():
                try:
                    f.unlink()
                    cleaned_files += 1
                except Exception:
                    pass
    print(f"Cleaned up {cleaned_files} old staged files in {temp_dir}", flush=True)
    
    # ----------------------------------------------------
    # Verification of Reset
    # ----------------------------------------------------
    print("\n" + "=" * 60, flush=True)
    print("STEP 4: VERIFYING POST-RESET STATE", flush=True)
    print("=" * 60, flush=True)
    
    with engine.connect() as conn:
        print("\nChecking cleared business tables (MUST ALL BE 0):", flush=True)
        for table in BUSINESS_TABLES_TO_CLEAR:
            cnt = conn.execute(text(f'SELECT count(*) FROM "{TARGET_SCHEMA}"."{table}"')).scalar()
            assert cnt == 0, f"Table {table} still has {cnt} rows!"
            print(f" - {table}: {cnt} rows [CLEARED]")
            
        print("\nChecking preserved system tables (MUST BE INTACT):", flush=True)
        for table in PRESERVED_TABLES:
            cnt = conn.execute(text(f'SELECT count(*) FROM "{TARGET_SCHEMA}"."{table}"')).scalar()
            print(f" - {table}: {cnt} rows [PRESERVED]")
            assert cnt > 0, f"Preserved table {table} unexpectedly empty!"

    print("\nPOST-RESET VERIFICATION CONFIRMED: BUSINESS DATA SAFELY RESET!", flush=True)
    return cleared_counts

if __name__ == "__main__":
    backup_dir, manifest = create_and_verify_backup()
    cleared_counts = execute_safe_business_reset(backup_dir)
    print("\nReset operation complete.")
