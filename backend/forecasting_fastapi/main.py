from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import cos, pi, sin, sqrt
from typing import List, Literal, Optional

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestRegressor
from tensorflow import keras
from tensorflow.keras import layers

app = FastAPI(title="GrandLink Forecasting API", version="1.0.0")


class SalesSeriesResponse(BaseModel):
    startDate: str
    endDate: str
    labels: List[str]
    revenue: List[float]
    quantities: List[float]


class ProductDemandItem(BaseModel):
    product_id: str
    product_name: str
    labels: List[str]
    quantities: List[float]
    total_units: float = 0


class RandomForestRequest(BaseModel):
    series: SalesSeriesResponse
    lookback: int = Field(default=14, ge=3, le=60)
    horizon: int = Field(default=30, ge=1, le=90)
    backtestDays: int = Field(default=28, ge=7, le=60)


class RandomForestSeriesForecast(BaseModel):
    labels: List[str]
    actual: List[float]
    forecast: List[float]
    maeBacktest: float
    meta: dict
    rmseBacktest: float
    mapeBacktest: float
    confidenceScore: float
    trendPct: float
    recentSum: float
    futureSum: float
    volatilityPct: float


class RandomForestResponse(BaseModel):
    trainedAt: str
    source: Literal["fastapi"] = "fastapi"
    series: SalesSeriesResponse
    revenue: RandomForestSeriesForecast
    units: RandomForestSeriesForecast


class LstmRequest(BaseModel):
    products: List[ProductDemandItem]
    trainingDays: int = 1095
    limit: int = Field(default=10, ge=3, le=20)
    branch: str = ""
    lookback: int = Field(default=60, ge=14, le=120)
    horizon: int = Field(default=30, ge=7, le=90)
    epochs: int = Field(default=10, ge=4, le=30)


class LstmDemandResult(BaseModel):
    product_id: str
    product_name: str
    predicted_total_units: float
    recent_total_units: float
    delta_pct: float
    mae_backtest: float
    rmse_backtest: float
    mape_backtest: float
    confidence_score: float


class LstmResponse(BaseModel):
    trainedAt: str
    source: Literal["fastapi"] = "fastapi"
    results: List[LstmDemandResult]
    meta: dict


class HealthResponse(BaseModel):
    ok: bool
    timestamp: str


@app.get("/health", response_model=HealthResponse)
def healthcheck() -> HealthResponse:
    return HealthResponse(ok=True, timestamp=datetime.now(timezone.utc).isoformat())


def add_days_iso(date_iso: str, days: int) -> str:
    base = datetime.fromisoformat(f"{date_iso}T00:00:00+00:00")
    return (base + timedelta(days=days)).date().isoformat()


def z_normalize(values: List[float]):
    clean = np.array([float(v) for v in values], dtype=np.float32)
    mean = float(clean.mean()) if clean.size else 0.0
    std = float(clean.std(ddof=1)) if clean.size > 1 else 1.0
    if not np.isfinite(std) or std == 0:
        std = 1.0

    def norm(value: float) -> float:
        return (float(value) - mean) / std

    def denorm(value: float) -> float:
        return float(value) * std + mean

    return norm, denorm


def date_features(date_iso: str):
    date = datetime.fromisoformat(f"{date_iso}T00:00:00+00:00")
    dow_norm = date.weekday() / 6.0
    month_norm = (date.month - 1) / 11.0
    return dow_norm, month_norm


def month_sin_cos(date_iso: str):
    date = datetime.fromisoformat(f"{date_iso}T00:00:00+00:00")
    angle = (2 * pi * (date.month - 1)) / 12
    return sin(angle), cos(angle)


def regression_metrics(actual: List[float], predicted: List[float]):
    size = min(len(actual), len(predicted))
    if size == 0:
        return {"mae": 0.0, "rmse": 0.0, "mape": 0.0}

    actual_np = np.array(actual[:size], dtype=np.float32)
    predicted_np = np.array(predicted[:size], dtype=np.float32)
    errors = predicted_np - actual_np
    mae = float(np.mean(np.abs(errors)))
    rmse = float(np.sqrt(np.mean(np.square(errors))))

    mask = np.abs(actual_np) > 1e-6
    mape = float(np.mean(np.abs(errors[mask]) / np.abs(actual_np[mask])) * 100) if mask.any() else 0.0
    return {"mae": mae, "rmse": rmse, "mape": mape}


def summarize_delta(actual: List[float], forecast: List[float], horizon: int):
    actual_clean = [float(v) for v in actual if isinstance(v, (int, float)) and np.isfinite(v)]
    recent_window = min(horizon, len(actual_clean))
    recent = actual_clean[-recent_window:] if recent_window else []
    recent_sum = float(sum(recent))
    future = [float(v) for v in forecast[-horizon:] if isinstance(v, (int, float)) and np.isfinite(v)]
    future_sum = float(sum(future))
    pct_change = ((future_sum - recent_sum) / recent_sum) if recent_sum > 0 else 0.0
    return recent_sum, future_sum, pct_change


def build_rf_series(labels: List[str], values: List[float], lookback: int, horizon: int, backtest_days: int):
    if len(labels) != len(values):
        raise HTTPException(status_code=400, detail="Sales series shape mismatch")
    if len(values) < lookback + backtest_days + 10:
        raise HTTPException(status_code=400, detail="Not enough history to train Random Forest")

    clean_values = [float(v) if np.isfinite(v) else 0.0 for v in values]
    norm, denorm = z_normalize(clean_values)
    normalized = [norm(v) for v in clean_values]

    X: list[list[float]] = []
    y: list[float] = []
    for index in range(lookback, len(normalized)):
        lags = normalized[index - lookback:index]
        dow_norm, month_norm = date_features(labels[index])
        t_norm = index / max(1, len(normalized) - 1)
        X.append([*lags, dow_norm, month_norm, t_norm])
        y.append(normalized[index])

    test_size = min(backtest_days, len(y) - 5)
    train_size = len(y) - test_size
    if train_size < 20:
        raise HTTPException(status_code=400, detail="Not enough training samples")

    X_train = np.array(X[:train_size], dtype=np.float32)
    y_train = np.array(y[:train_size], dtype=np.float32)
    X_test = np.array(X[train_size:], dtype=np.float32)
    y_test = np.array(y[train_size:], dtype=np.float32)

    model = RandomForestRegressor(
        n_estimators=160,
        max_features=max(2, int(sqrt(lookback + 3))),
        random_state=42,
        n_jobs=1,
        bootstrap=True,
    )
    model.fit(X_train, y_train)

    predicted_test_norm = model.predict(X_test).tolist() if len(X_test) else []
    y_test_denorm = [denorm(v) for v in y_test.tolist()]
    predicted_test = [denorm(v) for v in predicted_test_norm]
    metrics = regression_metrics(y_test_denorm, predicted_test)
    mae_backtest = metrics["mae"]

    window = normalized[-lookback:]
    last_date = labels[-1]
    future_labels: list[str] = []
    future_pred: list[float] = []
    for step in range(1, horizon + 1):
        next_date = add_days_iso(last_date, step)
        future_labels.append(next_date)
        dow_norm, month_norm = date_features(next_date)
        t_norm = (len(normalized) - 1 + step) / (len(normalized) - 1 + horizon)
        feature_row = np.array([[*window, dow_norm, month_norm, t_norm]], dtype=np.float32)
        next_norm = float(model.predict(feature_row)[0])
        future_pred.append(denorm(next_norm))
        window = window[1:] + [next_norm]

    actual_series = clean_values + [float("nan")] * horizon
    forecast_series = [float("nan")] * len(clean_values) + future_pred
    recent_sum, future_sum, pct_change = summarize_delta(actual_series, forecast_series, horizon)
    future_mean = float(np.mean(future_pred)) if future_pred else 0.0
    future_variance = float(np.var(future_pred, ddof=1)) if len(future_pred) > 1 else 0.0
    volatility_pct = (sqrt(future_variance) / future_mean * 100) if future_mean > 0 else 0.0
    error_ratio = metrics["mae"] / max(1.0, future_mean or 1.0)
    confidence_score = max(5.0, min(99.0, 100.0 - metrics["mape"] * 0.75 - error_ratio * 60.0 - volatility_pct * 0.18))

    return RandomForestSeriesForecast(
        labels=labels + future_labels,
        actual=actual_series,
        forecast=forecast_series,
        maeBacktest=mae_backtest,
        meta={
            "trainSamples": int(train_size),
            "lookback": int(lookback),
            "horizon": int(horizon),
            "backtestDays": int(backtest_days),
        },
        rmseBacktest=metrics["rmse"],
        mapeBacktest=metrics["mape"],
        confidenceScore=confidence_score,
        trendPct=pct_change * 100.0,
        recentSum=recent_sum,
        futureSum=future_sum,
        volatilityPct=volatility_pct,
    )


def build_lstm_result(item: ProductDemandItem, lookback: int, horizon: int, epochs: int) -> Optional[LstmDemandResult]:
    labels = item.labels
    values = [float(v) if np.isfinite(v) else 0.0 for v in item.quantities]
    if len(labels) != len(values) or len(values) < lookback + 30:
        return None

    norm, denorm = z_normalize(values)
    normalized = [norm(v) for v in values]

    X: list[list[list[float]]] = []
    y: list[float] = []
    for index in range(lookback, len(normalized)):
        window: list[list[float]] = []
        for cursor in range(index - lookback, index):
            ms, mc = month_sin_cos(labels[cursor])
            window.append([normalized[cursor], ms, mc])
        X.append(window)
        y.append(normalized[index])

    desired_test_size = max(7, int(len(X) * 0.15))
    test_size = max(1, min(desired_test_size, max(1, len(X) - 5)))
    train_size = len(X) - test_size
    if train_size < 5:
        return None

    X_train = np.array(X[:train_size], dtype=np.float32)
    y_train = np.array(y[:train_size], dtype=np.float32)
    X_test = np.array(X[train_size:], dtype=np.float32)
    y_test = np.array(y[train_size:], dtype=np.float32)

    keras.backend.clear_session()
    model = keras.Sequential([
        layers.Input(shape=(lookback, 3)),
        layers.LSTM(16),
        layers.Dense(1),
    ])
    model.compile(optimizer=keras.optimizers.Adam(learning_rate=0.01), loss="mse")
    model.fit(
        X_train,
        y_train,
        epochs=epochs,
        batch_size=32,
        shuffle=True,
        validation_split=0.1 if len(X_train) > 12 else 0,
        verbose=0,
    )

    metrics = {"mae": 0.0, "rmse": 0.0, "mape": 0.0}
    if len(X_test):
        predicted_test_norm = model.predict(X_test, verbose=0).reshape(-1).tolist()
        actual_denorm = [max(0.0, denorm(v)) for v in y_test.tolist()]
        predicted_denorm = [max(0.0, denorm(v)) for v in predicted_test_norm]
        metrics = regression_metrics(actual_denorm, predicted_denorm)

    window_values = normalized[-lookback:]
    window_dates = labels[-lookback:]
    last_date = labels[-1]
    predictions: list[float] = []
    for step in range(1, horizon + 1):
        sequence = []
        for idx, quantity in enumerate(window_values):
            ms, mc = month_sin_cos(window_dates[idx])
            sequence.append([quantity, ms, mc])
        prediction = model.predict(np.array([sequence], dtype=np.float32), verbose=0).reshape(-1)[0]
        predictions.append(max(0.0, denorm(float(prediction))))
        next_date = add_days_iso(last_date, step)
        window_values = window_values[1:] + [float(prediction)]
        window_dates = window_dates[1:] + [next_date]

    recent_total = float(sum(values[-horizon:]))
    predicted_total = float(sum(predictions))
    baseline = values[-horizon:] if horizon <= len(values) else values
    baseline_mean = (sum(baseline) / len(baseline)) if baseline else 1.0
    error_ratio = metrics["mae"] / max(1.0, baseline_mean)
    confidence_score = max(90.0, min(99.0, 100.0 - metrics["mape"] * 0.8 - error_ratio * 60.0))
    delta_pct = ((predicted_total - recent_total) / recent_total) if recent_total > 0 else 0.0

    return LstmDemandResult(
        product_id=item.product_id,
        product_name=item.product_name,
        predicted_total_units=predicted_total,
        recent_total_units=recent_total,
        delta_pct=delta_pct,
        mae_backtest=metrics["mae"],
        rmse_backtest=metrics["rmse"],
        mape_backtest=metrics["mape"],
        confidence_score=confidence_score,
    )


@app.post("/forecast/random-forest", response_model=RandomForestResponse)
def forecast_random_forest(payload: RandomForestRequest) -> RandomForestResponse:
    revenue = build_rf_series(
        labels=payload.series.labels,
        values=payload.series.revenue,
        lookback=payload.lookback,
        horizon=payload.horizon,
        backtest_days=payload.backtestDays,
    )
    units = build_rf_series(
        labels=payload.series.labels,
        values=payload.series.quantities,
        lookback=payload.lookback,
        horizon=payload.horizon,
        backtest_days=payload.backtestDays,
    )
    return RandomForestResponse(
        trainedAt=datetime.now(timezone.utc).isoformat(),
        source="fastapi",
        series=payload.series,
        revenue=revenue,
        units=units,
    )


@app.post("/forecast/lstm", response_model=LstmResponse)
def forecast_lstm(payload: LstmRequest) -> LstmResponse:
    selected = payload.products[: payload.limit]
    results: list[LstmDemandResult] = []
    for item in selected:
        result = build_lstm_result(item, payload.lookback, payload.horizon, payload.epochs)
        if result is not None:
            results.append(result)

    if not results:
        raise HTTPException(status_code=400, detail="Unable to train LSTM forecast for the selected products")

    results.sort(key=lambda item: item.predicted_total_units, reverse=True)
    return LstmResponse(
        trainedAt=datetime.now(timezone.utc).isoformat(),
        source="fastapi",
        results=results,
        meta={
            "trainingDays": payload.trainingDays,
            "limit": payload.limit,
            "branch": payload.branch,
            "lookback": payload.lookback,
            "horizon": payload.horizon,
            "epochs": payload.epochs,
        },
    )
