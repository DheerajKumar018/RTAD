from fastapi import FastAPI
import pandas as pd

from utils.model_loader import load_model
from drift.drift_detector import DriftDetector
from streaming.stream_data import DataStreamer

app = FastAPI()

model = load_model()

drift = DriftDetector()

streamer = DataStreamer("data/creditcard_sample.csv")


@app.get("/")
def home():

    return {"message": "Real Time Anomaly Detection API"}


@app.get("/stream")
def stream_data():

    data = streamer.get_next()

    df = pd.DataFrame([data])

    X = df.drop("Class", axis=1)

    score = model.decision_function(X)[0]

    prediction = model.predict(X)[0]

    anomaly = True if prediction == -1 else False

    drift_detected = drift.update(score)

    return {
        "transaction": data,
        "score": float(score),
        "anomaly": anomaly,
        "drift": drift_detected
    }