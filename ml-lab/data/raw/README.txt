SynChain AI — Synthetic ML starter dataset

IMPORTANT:
These files contain SYNTHETIC, generated data for development and practice. They are not real ERP records and must not be presented as real business results.

Files:
1. shipment_history.csv
   1,500 historical shipment rows. Use this to train a model that predicts `delayed` (0 = on time, 1 = delayed).
   Recommended first task: classification.
   Optional second task: predict `actual_delay_days` with regression.

2. supplier_master.csv
   15 current supplier profiles. Use this after training to help rank possible replacement suppliers. It is not the training target table by itself.

Suggested first ML workflow:
- Target: `delayed`
- Exclude leakage columns from features: shipment_id, actual_lead_time_days, actual_delay_days, delayed, order_value (optional), and identifiers such as shipment_id.
- Parse order_date into month/season features or drop it initially.
- Use a chronological train/test split if modeling time-dependent data.
- OneHotEncode categorical columns and scale is not required for RandomForest.
- Evaluate with precision, recall, F1, confusion matrix, and ROC-AUC where appropriate.
- A delay prediction model predicts shipment risk; it does NOT automatically decide which supplier to switch to. The recommendation stage should filter inactive suppliers, verify component compatibility and capacity, then rank by predicted delay risk, cost, quality, and lead time.
