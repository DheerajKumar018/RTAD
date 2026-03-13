from fastapi import FastAPI
import pandas as pd

from utils.model_loader import load_model
from drift.drift_detector import DriftDetector
from streaming.stream_data import DataStreamer
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # allow all origins for development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
model = load_model()
drift = DriftDetector()
streamer = DataStreamer("data/creditcard_sample.csv")


@app.get("/")
def home():
    return {"message": "Real Time Anomaly Detection API"}


from fastapi import FastAPI
import pandas as pd

from utils.model_loader import load_model
from drift.drift_detector import DriftDetector
from streaming.stream_data import DataStreamer
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

model = load_model()
drift = DriftDetector()
streamer = DataStreamer("data/creditcard_sample.csv")


@app.get("/")
def home():
    return {"message": "Real Time Anomaly Detection API"}


@app.get("/stream")
def stream_data():

    batch = []

    for _ in range(80):   # fetch 80 transactions

        data = streamer.get_next()

        df = pd.DataFrame([data])

        X = df.drop("Class", axis=1)

        score = float(model.decision_function(X)[0])
        prediction = int(model.predict(X)[0])

        anomaly = prediction == -1
        drift_detected = drift.update(score)

        batch.append({
            "ts": data["Time"],
            "amount": data["Amount"],
            "score": score,
            "isAnom": anomaly,
            "drift_signal": drift_detected,
            "health": 1 - abs(score)
        })

    return batch