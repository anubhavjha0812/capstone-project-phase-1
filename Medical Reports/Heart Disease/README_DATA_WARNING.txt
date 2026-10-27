data.csv in this folder is the popular Kaggle copy of the UCI heart disease data (1,025 rows, of which
723 are duplicates). Its "target" column is REVERSED: target 1 means NO heart disease.
Do not train on it. The Predictix heart model is trained on the original UCI file in
ML/Heart Disease Prediction/data/processed.cleveland.data (see train_heart_model.py).

HeartReport_Suffering.pdf / HeartReport_NotSuffering.pdf were named from that reversed label; the
names were swapped to match the real diagnosis.
