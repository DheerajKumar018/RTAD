import pandas as pd
from sklearn.ensemble import IsolationForest
import joblib

df = pd.read_csv("data/creditcard_sample.csv")

X = df.drop("Class", axis=1)

model = IsolationForest(
    n_estimators=200,
    contamination=0.02,
    random_state=42
)

model.fit(X)

joblib.dump(model, "anomaly_model.pkl")

print("Model trained successfully")