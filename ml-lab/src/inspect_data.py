from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = PROJECT_ROOT / "data" / "raw"

SHIPMENT_FILE = DATA_DIR / "shipment_history.csv"
SUPPLIER_FILE = DATA_DIR / "supplier_master.csv"


def inspect_csv(file_path: Path) -> None:
    """Display basic information about a CSV dataset."""

    print("\n" + "=" * 60)
    print(f"FILE: {file_path.name}")
    print("=" * 60)

    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}")
        return

    df = pd.read_csv(file_path)

    print(f"\nNumber of rows: {df.shape[0]}")
    print(f"Number of columns: {df.shape[1]}")

    print("\nColumn names:")
    print(df.columns.tolist())

    print("\nFirst five rows:")
    print(df.head().to_string(index=False))

    print("\nMissing values per column:")
    print(df.isnull().sum().to_string())

    print("\nData types:")
    print(df.dtypes.to_string())

    if "delayed" in df.columns:
        print("\nShipment delay distribution:")
        print(df["delayed"].value_counts().to_string())

        print("\nShipment delay percentages:")
        print(
            (df["delayed"].value_counts(normalize=True) * 100)
            .round(2)
            .to_string()
        )


def main() -> None:
    inspect_csv(SHIPMENT_FILE)
    inspect_csv(SUPPLIER_FILE)


if __name__ == "__main__":
    main()
