from pathlib import Path

import joblib
import pandas as pd

from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.utils.class_weight import compute_sample_weight


# --------------------------------------------------
# 1. Define project paths
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]

DATA_FILE = PROJECT_ROOT / "data" / "raw" / "shipment_history.csv"
MODEL_DIR = PROJECT_ROOT / "models"
REPORT_DIR = PROJECT_ROOT / "reports"

MODEL_FILE = MODEL_DIR / "delay_model.joblib"
METRICS_FILE = REPORT_DIR / "training_metrics.txt"


# --------------------------------------------------
# 2. Load and prepare the dataset
# --------------------------------------------------

def load_data():
    if not DATA_FILE.exists():
        raise FileNotFoundError(
            f"Dataset not found: {DATA_FILE}"
        )

    df = pd.read_csv(DATA_FILE)

    # Target: 0 = on time, 1 = delayed
    target = "delayed"

    # Remove identifiers, post-outcome information,
    # and fields that could cause data leakage.
    excluded_columns = [
        "shipment_id",
        "supplier_id",
        "order_date",
        "actual_lead_time_days",
        "actual_delay_days",
        "order_value",
        target,
    ]

    X = df.drop(columns=excluded_columns)
    y = df[target]

    return X, y


# --------------------------------------------------
# 3. Build preprocessing and ML pipeline
# --------------------------------------------------

def build_pipeline(X):
    numeric_features = X.select_dtypes(
        include=["number"]
    ).columns.tolist()

    categorical_features = X.select_dtypes(
        exclude=["number"]
    ).columns.tolist()

    numeric_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="median"),
            )
        ]
    )

    categorical_pipeline = Pipeline(
        steps=[
            (
                "imputer",
                SimpleImputer(strategy="most_frequent"),
            ),
            (
                "encoder",
                OneHotEncoder(handle_unknown="ignore"),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            (
                "numeric",
                numeric_pipeline,
                numeric_features,
            ),
            (
                "categorical",
                categorical_pipeline,
                categorical_features,
            ),
        ]
    )

    classifier = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=3,
        random_state=42,
        n_jobs=-1,
    )

    model = Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("classifier", classifier),
        ]
    )

    return model


# --------------------------------------------------
# 4. Train and evaluate
# --------------------------------------------------

def main():
    print("=" * 60)
    print("SYNCHAIN AI - SHIPMENT DELAY MODEL")
    print("=" * 60)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)

    X, y = load_data()

    print(f"\nTotal records: {len(X)}")
    print(f"Features used: {len(X.columns)}")

    print("\nFeatures:")
    for feature in X.columns:
        print(f"  - {feature}")

    print("\nSplitting dataset into training and testing sets...")

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    print(f"Training records: {len(X_train)}")
    print(f"Testing records: {len(X_test)}")

    model = build_pipeline(X_train)

    print("\nTraining Random Forest model...")

    # Account for the difference between on-time
    # and delayed shipment counts.
    sample_weights = compute_sample_weight(
        class_weight="balanced",
        y=y_train,
    )

    model.fit(
        X_train,
        y_train,
        classifier__sample_weight=sample_weights,
    )

    print("Training completed.")

    # Predict labels and delay probabilities.
    y_pred = model.predict(X_test)

    delayed_class_index = list(
        model.named_steps["classifier"].classes_
    ).index(1)

    y_probability = model.predict_proba(X_test)[
        :, delayed_class_index
    ]

    accuracy = accuracy_score(y_test, y_pred)

    roc_auc = roc_auc_score(
        y_test,
        y_probability,
    )

    report = classification_report(
        y_test,
        y_pred,
        zero_division=0,
    )

    matrix = confusion_matrix(
        y_test,
        y_pred,
        labels=[0, 1],
    )

    print("\n" + "=" * 60)
    print("MODEL EVALUATION")
    print("=" * 60)

    print(f"\nAccuracy: {accuracy:.4f}")
    print(f"ROC-AUC:  {roc_auc:.4f}")

    print("\nClassification Report:")
    print(report)

    print("Confusion Matrix:")
    print(matrix)

    # Save the trained pipeline.
    joblib.dump(model, MODEL_FILE)

    # Save evaluation results.
    with open(
        METRICS_FILE,
        "w",
        encoding="utf-8",
    ) as file:
        file.write("SYNCHAIN AI - MODEL EVALUATION\n\n")
        file.write(f"Total records: {len(X)}\n")
        file.write(f"Training records: {len(X_train)}\n")
        file.write(f"Testing records: {len(X_test)}\n")
        file.write(f"Accuracy: {accuracy:.4f}\n")
        file.write(f"ROC-AUC: {roc_auc:.4f}\n\n")
        file.write("Classification Report:\n")
        file.write(report)
        file.write("\nConfusion Matrix:\n")
        file.write(str(matrix))
        file.write("\n\n")
        file.write(
            "WARNING: Model trained on synthetic data. "
            "Metrics do not establish real-world accuracy.\n"
        )

    print(f"\nModel saved to: {MODEL_FILE}")
    print(f"Metrics saved to: {METRICS_FILE}")


if __name__ == "__main__":
    main()
