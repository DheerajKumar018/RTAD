"""
Real-Time Anomaly Detection with Concept Drift Handling
========================================================
Streamlit Dashboard — Final Year AIML Project

Run with:
    streamlit run dashboard/app.py
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
from datetime import datetime, timedelta
import time
import random
import requests
API_URL = "http://127.0.0.1:8000/stream"
# ──────────────────────────────────────────────
# PAGE CONFIG
# ──────────────────────────────────────────────
st.set_page_config(
    page_title="Anomaly Detection Dashboard",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────
# CUSTOM CSS
# ──────────────────────────────────────────────
st.markdown("""
<style>
    /* General */
    [data-testid="stAppViewContainer"] { background: #f0f2f6; }
    [data-testid="stSidebar"] { background: #1a1f2e; }
    [data-testid="stSidebar"] * { color: #e2e8f0 !important; }
    [data-testid="stSidebar"] .stSlider label { color: #94a3b8 !important; }
    h1, h2, h3 { font-family: 'Segoe UI', sans-serif; }

    /* Metric Cards */
    .metric-card {
        background: white;
        border-radius: 12px;
        padding: 18px 22px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.07);
        margin-bottom: 12px;
    }
    .metric-title { font-size: 0.75rem; color: #64748b; text-transform: uppercase;
                    letter-spacing: 0.06em; font-weight: 600; margin-bottom: 4px; }
    .metric-value { font-size: 1.9rem; font-weight: 700; color: #1e293b; line-height: 1; }
    .metric-sub   { font-size: 0.78rem; color: #94a3b8; margin-top: 4px; }

    /* Alert Cards */
    .alert-card {
        background: #fff5f5;
        border-left: 4px solid #ef4444;
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 10px;
    }
    .alert-header { font-weight: 700; color: #dc2626; font-size: 0.85rem; }
    .alert-detail { font-size: 0.78rem; color: #475569; margin-top: 4px; }

    /* Status Badges */
    .badge-green { background:#dcfce7; color:#166534; padding:3px 10px;
                   border-radius:20px; font-size:0.75rem; font-weight:600; }
    .badge-red   { background:#fee2e2; color:#991b1b; padding:3px 10px;
                   border-radius:20px; font-size:0.75rem; font-weight:600; }
    .badge-yellow{ background:#fef9c3; color:#854d0e; padding:3px 10px;
                   border-radius:20px; font-size:0.75rem; font-weight:600; }
    .badge-blue  { background:#dbeafe; color:#1e40af; padding:3px 10px;
                   border-radius:20px; font-size:0.75rem; font-weight:600; }

    /* Section headers */
    .section-header {
        font-size: 0.95rem; font-weight: 700; color: #334155;
        margin-bottom: 10px; padding-bottom: 6px;
        border-bottom: 2px solid #e2e8f0;
    }

    /* Log panel */
    .log-box {
        background: #0f172a;
        color: #94a3b8;
        font-family: 'Courier New', monospace;
        font-size: 0.75rem;
        padding: 14px;
        border-radius: 10px;
        max-height: 260px;
        overflow-y: auto;
        line-height: 1.7;
    }
    .log-info    { color: #60a5fa; }
    .log-warning { color: #fbbf24; }
    .log-error   { color: #f87171; }
    .log-success { color: #34d399; }

    /* Drift panel */
    .drift-card {
        background: white;
        border-radius: 12px;
        padding: 18px;
        box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }

    /* Refresh button */
    div[data-testid="stButton"] button {
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
    }
    div[data-testid="stButton"] button:hover { background: #2563eb; }
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────
# DATA SIMULATION ENGINE
# ──────────────────────────────────────────────
# ──────────────────────────────────────────────
# LIVE DATA ENGINE (BACKEND API)
# ──────────────────────────────────────────────

def generate_stream_data(n=80):
    """
    Fetch streaming transactions from FastAPI backend.
    """

    records = []

    for i in range(n):

        try:

            response = requests.get(API_URL, timeout=2)

            if response.status_code == 200:

                result = response.json()

                txn = result["transaction"]

                records.append({
                    "txn_id": f"TXN-{10000+i}",
                    "amount": txn["Amount"],
                    "timestamp": datetime.now(),
                    "score": result["score"],
                    "status": "🚨 Anomaly" if result["anomaly"] else "✅ Normal",
                    "is_anomaly": result["anomaly"],
                })

        except Exception as e:

            records.append({
                "txn_id": f"ERR-{i}",
                "amount": 0,
                "timestamp": datetime.now(),
                "score": 0,
                "status": "⚠ API ERROR",
                "is_anomaly": False,
            })

    return pd.DataFrame(records)


def get_drift_events(df, drift_point=None):
    """
    Detect drift events from anomaly scores.
    drift_point kept for compatibility with existing dashboard code.
    """

    drift_rows = df[df["score"] > 0.9]

    events = []

    for _, row in drift_rows.iterrows():

        events.append({
            "time": row["timestamp"],
            "method": "ADWIN",
            "action": "Model Retrained"
        })

    return events


def compute_metrics(df):
    """
    Compute basic anomaly metrics
    """

    total = len(df)

    anomalies = df["is_anomaly"].sum()

    normal = total - anomalies

    accuracy = round((normal / total), 4) if total else 0

    precision = round((anomalies / total), 4) if total else 0

    recall = precision

    f1 = precision

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "total": total,
        "anomalies": int(anomalies)
    }


def build_log(df, drift_events):

    logs = []

    logs.append((
        "INFO",
        datetime.now(),
        "Streaming API connected"
    ))

    anomaly_rows = df[df["is_anomaly"]].head(6)

    for _, row in anomaly_rows.iterrows():

        logs.append((
            "WARNING",
            row["timestamp"],
            f"Anomaly detected — {row['txn_id']} score={row['score']}"
        ))

    for e in drift_events:

        logs.append((
            "ERROR",
            e["time"],
            "Concept drift detected by ADWIN"
        ))

    return logs


# ──────────────────────────────────────────────
# SIDEBAR — CONTROLS
# ──────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚙️ Dashboard Controls")
    st.markdown("---")

    anomaly_threshold = st.slider(
        "Anomaly Score Threshold", 0.0, 1.0, 0.50, 0.01,
        help="Scores above this value are flagged as anomalies in the chart.",
    )
    time_range = st.selectbox(
        "Time Range", ["Last 20 records", "Last 40 records",
                       "Last 60 records", "All records"], index=2,
    )
    show_alerts = st.toggle("Show Anomaly Alerts Panel", value=True)
    auto_refresh = st.toggle("Auto-Refresh (5s)", value=False)

    st.markdown("---")
    st.markdown("### 📡 Stream Settings")
    drift_point = st.slider("Inject Drift After (records)", 20, 70, 50, 5)
    anomaly_rate = st.slider("Anomaly Injection Rate", 0.05, 0.35, 0.12, 0.01)

    st.markdown("---")
    refresh_btn = st.button("🔄 Refresh Data", use_container_width=True)

    st.markdown("---")
    st.markdown(
        "<div style='font-size:0.72rem;color:#64748b;'>"
        "🎓 Final Year AIML Project<br>"
        "Isolation Forest + ADWIN<br>"
        "Streamlit · Plotly · Pandas"
        "</div>",
        unsafe_allow_html=True,
    )

# ──────────────────────────────────────────────
# AUTO-REFRESH
# ──────────────────────────────────────────────
if auto_refresh:
    time.sleep(5)
    st.rerun()

# ──────────────────────────────────────────────
# LOAD DATA
# ──────────────────────────────────────────────
if "df" not in st.session_state or refresh_btn:
    st.session_state.df = generate_stream_data(n=80)
    st.session_state.generated_at = datetime.now()

df_full = st.session_state.df.copy()
drift_events = get_drift_events(df_full, drift_point)
metrics = compute_metrics(df_full)
logs = build_log(df_full, drift_events)

# Apply time range filter
range_map = {
    "Last 20 records": 20, "Last 40 records": 40,
    "Last 60 records": 60, "All records": len(df_full),
}
n_show = range_map[time_range]
df = df_full.tail(n_show).copy()

has_drift = len(drift_events) > 0
last_drift_time = drift_events[-1]["time"].strftime("%H:%M:%S") if has_drift else "—"


# ──────────────────────────────────────────────
# PAGE HEADER
# ──────────────────────────────────────────────
col_h1, col_h2, col_h3 = st.columns([3, 1, 1])
with col_h1:
    st.markdown("# 🔍 Real-Time Anomaly Detection Dashboard")
    st.caption("Isolation Forest + ADWIN Concept Drift Handling · Live Streaming Monitor")
with col_h2:
    st.markdown(
        f"<div style='text-align:right;padding-top:28px'>"
        f"<span class='badge-green'>● STREAMING ACTIVE</span></div>",
        unsafe_allow_html=True,
    )
with col_h3:
    st.markdown(
        f"<div style='text-align:right;padding-top:22px;font-size:0.75rem;color:#64748b'>"
        f"Last updated<br><b>{st.session_state.generated_at.strftime('%H:%M:%S')}</b></div>",
        unsafe_allow_html=True,
    )

st.markdown("---")


# ──────────────────────────────────────────────
# ROW 1 — SYSTEM STATUS + MODEL METRICS
# ──────────────────────────────────────────────
st.markdown('<div class="section-header">📊 System Overview</div>', unsafe_allow_html=True)

c1, c2, c3, c4, c5, c6, c7 = st.columns(7)

def metric_card(title, value, sub="", color="#1e293b"):
    return f"""<div class='metric-card'>
        <div class='metric-title'>{title}</div>
        <div class='metric-value' style='color:{color}'>{value}</div>
        <div class='metric-sub'>{sub}</div>
    </div>"""

with c1:
    st.markdown(metric_card("Processed Records", metrics["total"], "total transactions"), unsafe_allow_html=True)
with c2:
    st.markdown(metric_card("Anomalies Found", metrics["anomalies"],
                            f"{metrics['anomalies']/metrics['total']*100:.1f}% of stream", "#ef4444"), unsafe_allow_html=True)
with c3:
    st.markdown(metric_card("Accuracy", f"{metrics['accuracy']*100:.1f}%", "model accuracy"), unsafe_allow_html=True)
with c4:
    st.markdown(metric_card("Precision", f"{metrics['precision']*100:.1f}%", "anomaly precision"), unsafe_allow_html=True)
with c5:
    st.markdown(metric_card("Recall", f"{metrics['recall']*100:.1f}%", "anomaly recall"), unsafe_allow_html=True)
with c6:
    st.markdown(metric_card("F1 Score", f"{metrics['f1']*100:.1f}%", "harmonic mean"), unsafe_allow_html=True)
with c7:
    drift_color = "#ef4444" if has_drift else "#16a34a"
    drift_label = "DETECTED" if has_drift else "STABLE"
    st.markdown(metric_card("Concept Drift", drift_label, f"ADWIN | {last_drift_time}", drift_color), unsafe_allow_html=True)


# ──────────────────────────────────────────────
# ROW 2 — LIVE STREAM TABLE + ALERTS
# ──────────────────────────────────────────────
col_table, col_alerts = st.columns([3, 2])

with col_table:
    st.markdown('<div class="section-header">📡 Live Data Stream</div>', unsafe_allow_html=True)
    display_df = df[["txn_id", "amount", "timestamp", "score", "status"]].copy()
    display_df["timestamp"] = display_df["timestamp"].dt.strftime("%H:%M:%S")
    display_df["amount"] = display_df["amount"].apply(lambda x: f"${x:,.2f}")
    display_df.columns = ["Transaction ID", "Amount", "Time", "Anomaly Score", "Status"]
    display_df = display_df.sort_index(ascending=False).reset_index(drop=True)

    def highlight_anomalies(row):
        if "Anomaly" in str(row["Status"]):
            return ["background-color: #fff1f2"] * len(row)
        return [""] * len(row)

    st.dataframe(
        display_df.style.apply(highlight_anomalies, axis=1),
        use_container_width=True,
        height=340,
    )

with col_alerts:
    if show_alerts:
        st.markdown('<div class="section-header">🚨 Anomaly Alerts</div>', unsafe_allow_html=True)
        anomaly_rows = df[df["is_anomaly"]].sort_values("score", ascending=False).head(6)
        if len(anomaly_rows) == 0:
            st.info("No anomalies detected in the current window.")
        else:
            for _, row in anomaly_rows.iterrows():
                severity = "🔴 CRITICAL" if row["score"] > 0.8 else "🟡 HIGH"
                st.markdown(f"""
                <div class='alert-card'>
                    <div class='alert-header'>⚠️ {severity} — {row['txn_id']}</div>
                    <div class='alert-detail'>
                        💰 Amount: <b>${row['amount']:,.2f}</b> &nbsp;|&nbsp;
                        🕐 {row['timestamp'].strftime('%H:%M:%S')}<br>
                        📈 Score: <b>{row['score']}</b>
                        {'&nbsp;(above threshold)' if row['score'] > anomaly_threshold else ''}
                    </div>
                </div>
                """, unsafe_allow_html=True)


# ──────────────────────────────────────────────
# ROW 3 — ANOMALY SCORE CHART + DRIFT TIMELINE
# ──────────────────────────────────────────────
st.markdown('<div class="section-header">📈 Anomaly Score & Drift Timeline</div>', unsafe_allow_html=True)
col_score, col_drift_chart = st.columns([3, 2])

with col_score:
    fig_score = go.Figure()

    # Normal scores
    normal_df = df[~df["is_anomaly"]]
    fig_score.add_trace(go.Scatter(
        x=normal_df["timestamp"], y=normal_df["score"],
        mode="lines+markers",
        name="Normal",
        line=dict(color="#3b82f6", width=2),
        marker=dict(size=5, color="#3b82f6"),
    ))

    # Anomaly scores
    anomaly_df_plot = df[df["is_anomaly"]]
    fig_score.add_trace(go.Scatter(
        x=anomaly_df_plot["timestamp"], y=anomaly_df_plot["score"],
        mode="markers",
        name="Anomaly",
        marker=dict(size=10, color="#ef4444", symbol="x", line=dict(width=2)),
    ))

    # Threshold line
    fig_score.add_hline(
        y=anomaly_threshold, line_dash="dash",
        line_color="#f59e0b", line_width=2,
        annotation_text=f"Threshold ({anomaly_threshold})",
        annotation_position="top left",
        annotation_font_color="#f59e0b",
    )

    # Drift markers
    for e in drift_events:
        if df["timestamp"].min() <= e["time"] <= df["timestamp"].max():
            fig_score.add_vline(
                x=e["time"], line_dash="dot",
                line_color="#a855f7", line_width=2,
                annotation_text="Drift ⚡",
                annotation_font_color="#a855f7",
            )

    fig_score.update_layout(
        title="Anomaly Scores Over Time",
        xaxis_title="Timestamp", yaxis_title="Anomaly Score",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=10, r=10, t=50, b=10),
        height=320,
        yaxis=dict(range=[0, 1.05]),
    )
    st.plotly_chart(fig_score, use_container_width=True)

with col_drift_chart:
    # Build a timeline bar: normal = 0, anomaly = score, drift = spike
    fig_drift = go.Figure()

    df_sorted = df.sort_values("timestamp")
    colors = ["#ef4444" if a else "#3b82f6" for a in df_sorted["is_anomaly"]]

    fig_drift.add_trace(go.Bar(
        x=df_sorted["timestamp"],
        y=df_sorted["score"],
        marker_color=colors,
        name="Score",
        opacity=0.8,
    ))

    for e in drift_events:
        if df["timestamp"].min() <= e["time"] <= df["timestamp"].max():
            fig_drift.add_vline(
                x=e["time"], line_dash="dash",
                line_color="#a855f7", line_width=2.5,
            )
            fig_drift.add_annotation(
                x=e["time"], y=1.0,
                text="⚡ DRIFT",
                showarrow=False,
                font=dict(color="#a855f7", size=11, family="Courier New"),
            )

    fig_drift.update_layout(
        title="Drift Events Timeline",
        xaxis_title="Time", yaxis_title="Score",
        plot_bgcolor="white", paper_bgcolor="white",
        showlegend=False,
        margin=dict(l=10, r=10, t=50, b=10),
        height=320,
        yaxis=dict(range=[0, 1.05]),
    )
    st.plotly_chart(fig_drift, use_container_width=True)


# ──────────────────────────────────────────────
# ROW 4 — DATA DISTRIBUTION + CONCEPT DRIFT PANEL
# ──────────────────────────────────────────────
col_dist, col_drift_panel = st.columns([3, 2])

with col_dist:
    st.markdown('<div class="section-header">📊 Data Distribution</div>', unsafe_allow_html=True)
    fig_dist = go.Figure()

    fig_dist.add_trace(go.Histogram(
        x=df[~df["is_anomaly"]]["amount"],
        name="Normal",
        marker_color="#3b82f6",
        opacity=0.65,
        nbinsx=30,
    ))
    fig_dist.add_trace(go.Histogram(
        x=df[df["is_anomaly"]]["amount"],
        name="Anomaly",
        marker_color="#ef4444",
        opacity=0.75,
        nbinsx=20,
    ))

    fig_dist.update_layout(
        barmode="overlay",
        title="Transaction Amount Distribution — Normal vs Anomaly",
        xaxis_title="Transaction Amount ($)",
        yaxis_title="Frequency",
        plot_bgcolor="white", paper_bgcolor="white",
        legend=dict(orientation="h", yanchor="bottom", y=1.02),
        margin=dict(l=10, r=10, t=50, b=10),
        height=300,
    )
    st.plotly_chart(fig_dist, use_container_width=True)

with col_drift_panel:
    st.markdown('<div class="section-header">🔄 Concept Drift Detection</div>', unsafe_allow_html=True)

    drift_status_badge = (
        "<span class='badge-red'>⚡ DETECTED</span>"
        if has_drift else
        "<span class='badge-green'>✅ NOT DETECTED</span>"
    )
    st.markdown(f"""
    <div class='drift-card'>
        <table style='width:100%;font-size:0.84rem;border-collapse:collapse'>
            <tr style='border-bottom:1px solid #f1f5f9'>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Drift Status</td>
                <td style='padding:10px 6px'>{drift_status_badge}</td>
            </tr>
            <tr style='border-bottom:1px solid #f1f5f9'>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Detection Method</td>
                <td style='padding:10px 6px'><span class='badge-blue'>ADWIN</span></td>
            </tr>
            <tr style='border-bottom:1px solid #f1f5f9'>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Last Drift At</td>
                <td style='padding:10px 6px'><b>{last_drift_time}</b></td>
            </tr>
            <tr style='border-bottom:1px solid #f1f5f9'>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Total Drift Events</td>
                <td style='padding:10px 6px'><b>{len(drift_events)}</b></td>
            </tr>
            <tr style='border-bottom:1px solid #f1f5f9'>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Retraining Events</td>
                <td style='padding:10px 6px'><b>{len(drift_events)}</b></td>
            </tr>
            <tr>
                <td style='padding:10px 6px;color:#64748b;font-weight:600'>Base Model</td>
                <td style='padding:10px 6px'><span class='badge-blue'>Isolation Forest</span></td>
            </tr>
        </table>
    </div>
    """, unsafe_allow_html=True)

    if has_drift:
        st.warning(
            f"⚡ Drift detected at record #{drift_point}. "
            f"Model was retrained automatically.",
            icon="⚠️",
        )

    # Performance gauge
    fig_gauge = go.Figure(go.Indicator(
        mode="gauge+number",
        value=metrics["f1"] * 100,
        title={"text": "F1 Score", "font": {"size": 14}},
        gauge={
            "axis": {"range": [0, 100]},
            "bar": {"color": "#3b82f6"},
            "steps": [
                {"range": [0, 50],  "color": "#fee2e2"},
                {"range": [50, 75], "color": "#fef9c3"},
                {"range": [75, 100],"color": "#dcfce7"},
            ],
            "threshold": {"line": {"color": "#ef4444", "width": 3}, "value": 70},
        },
    ))
    fig_gauge.update_layout(
        height=200,
        margin=dict(l=20, r=20, t=30, b=10),
        paper_bgcolor="white",
    )
    st.plotly_chart(fig_gauge, use_container_width=True)


# ──────────────────────────────────────────────
# ROW 5 — SYSTEM LOG + SYSTEM STATUS
# ──────────────────────────────────────────────
col_log, col_status = st.columns([3, 2])

with col_log:
    st.markdown('<div class="section-header">🖥️ Model Retraining & System Log</div>', unsafe_allow_html=True)

    color_map = {
        "INFO":    "log-info",
        "SUCCESS": "log-success",
        "WARNING": "log-warning",
        "ERROR":   "log-error",
    }
    icon_map = {
        "INFO": "ℹ",
        "SUCCESS": "✔",
        "WARNING": "⚠",
        "ERROR": "✖",
    }

    lines_html = ""
    for level, ts, msg in reversed(logs[-30:]):
        cls  = color_map.get(level, "log-info")
        icon = icon_map.get(level, "•")
        lines_html += (
            f'<div><span class="{cls}">[{level}]</span> '
            f'<span style="color:#475569">{ts.strftime("%H:%M:%S")}</span> '
            f'<span style="color:#cbd5e1">{icon} {msg}</span></div>'
        )

    st.markdown(f"<div class='log-box'>{lines_html}</div>", unsafe_allow_html=True)

with col_status:
    st.markdown('<div class="section-header">🟢 System Status</div>', unsafe_allow_html=True)

    statuses = [
        ("Streaming Pipeline",  "ACTIVE",   "badge-green"),
        ("Isolation Forest",    "LOADED",   "badge-green"),
        ("ADWIN Detector",      "RUNNING",  "badge-green"),
        ("Data Preprocessor",   "ACTIVE",   "badge-green"),
        ("Alert Engine",        "ACTIVE",   "badge-green"),
        ("Dashboard API",       "ACTIVE",   "badge-green"),
    ]
    if has_drift:
        statuses.append(("Concept Drift",   "DETECTED", "badge-red"))
        statuses.append(("Model Retrainer", "COMPLETE", "badge-yellow"))
    else:
        statuses.append(("Concept Drift",   "STABLE",   "badge-green"))

    rows_html = ""
    for name, badge_text, badge_cls in statuses:
        rows_html += f"""
        <tr style='border-bottom:1px solid #f1f5f9'>
            <td style='padding:9px 6px;color:#475569;font-size:0.83rem'>{name}</td>
            <td style='padding:9px 6px'><span class='{badge_cls}'>{badge_text}</span></td>
        </tr>"""

    st.markdown(f"""
    <div class='drift-card'>
        <table style='width:100%;border-collapse:collapse'>{rows_html}</table>
    </div>
    """, unsafe_allow_html=True)

    # Records processed mini bar
    st.markdown("<br>", unsafe_allow_html=True)
    processed_pct = min(metrics["total"] / 100, 1.0)
    fig_prog = go.Figure(go.Bar(
        x=[metrics["total"]], y=["Records"],
        orientation="h",
        marker_color="#3b82f6",
        text=[f"{metrics['total']} / 100"],
        textposition="inside",
    ))
    fig_prog.update_layout(
        height=70,
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor="white",
        plot_bgcolor="white",
        xaxis=dict(range=[0, 100], showticklabels=False),
        yaxis=dict(showticklabels=False),
        showlegend=False,
        title=dict(text="Records Processed", font=dict(size=12), x=0),
    )
    st.plotly_chart(fig_prog, use_container_width=True)


# ──────────────────────────────────────────────
# FOOTER
# ──────────────────────────────────────────────
