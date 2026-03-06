import os
import json
import numpy as np
import pandas as pd
import joblib

from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.multioutput import MultiOutputRegressor, RegressorChain
from sklearn.model_selection import cross_val_score
from xgboost import XGBRegressor

from params_config import (
    NUMERIC_FEATURES,
    CATEGORICAL_FEATURES,
    FEATURE_COLUMNS,
    TARGET_COLUMNS,
)

# Path to save/load the trained models
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH = os.path.join(MODEL_DIR, "models_bundle.joblib")


def _build_base_regressor():
    return XGBRegressor(
        n_estimators=100,
        max_depth=6,
        learning_rate=0.1,
        random_state=42,
        n_jobs=-1,
    )


def _build_pipeline(regressor_type="multioutput") -> Pipeline:
    """
    Build the full sklearn Pipeline with specified regressor type.
    """
    numeric_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="median")),
        ("scaler", StandardScaler()),
    ])

    categorical_transformer = Pipeline(steps=[
        ("imputer", SimpleImputer(strategy="most_frequent")),
        ("encoder", OneHotEncoder(handle_unknown="ignore", sparse_output=False)),
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ],
        remainder="drop",
    )

    if regressor_type == "chain":
        reg = RegressorChain(_build_base_regressor(), order="random", random_state=42)
    else:
        reg = MultiOutputRegressor(_build_base_regressor())

    return Pipeline(steps=[
        ("preprocessor", preprocessor),
        ("regressor", reg),
    ])


def train_model(data: list[dict]) -> dict:
    """
    Train both ML models and calculate confidence scores.
    """
    df = pd.DataFrame(data)

    if len(df) < 5:  # Need more data for stable cross-validation
        raise ValueError(
            f"Not enough data to train. Got {len(df)} records, need at least 5 for validation."
        )

    for col in NUMERIC_FEATURES + TARGET_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        # --- TREATMENT OF 0 AS MISSING DATA ---
        # Per user domain knowledge, 0 is a placeholder for NULL/Missing.
        # Soil parameters like weight, strength, etc. are never truly 0.
        if col in TARGET_COLUMNS:
            df[col] = df[col].replace(0, np.nan)

    # Drop rows where all targets are missing (nothing to learn from)
    df = df.dropna(subset=TARGET_COLUMNS, how="all")

    X = df[FEATURE_COLUMNS].copy()
    y = df[TARGET_COLUMNS].copy()

    # Fill missing targets for training (standard requirement for these regressors)
    # We use the median of ACTUAL non-zero data for imputation.
    for col in TARGET_COLUMNS:
        median_val = y[col].median()
        if pd.isna(median_val):
            # If the whole column is missing, we'll use a safe placeholder
            # but this will be reflected in 0% confidence.
            median_val = 0.0
        y[col] = y[col].fillna(median_val)

    # 1. Train MultiOutputRegressor
    p_multi = _build_pipeline("multioutput")
    p_multi.fit(X, y)

    # 2. Train RegressorChain
    p_chain = _build_pipeline("chain")
    p_chain.fit(X, y)

    # 3. Calculate Confidence Scores for both models
    conf_multi = {}
    conf_chain = {}
    
    for col_idx, col in enumerate(TARGET_COLUMNS):
        try:
            y_col = y[col].fillna(y[col].median() or 0)
            q_low, q_high = y_col.quantile([0.05, 0.95])
            y_col_clipped = y_col.clip(q_low, q_high)
            
            if y_col_clipped.nunique() <= 1:
                conf_multi[col] = 0.1
                conf_chain[col] = 0.1
                continue

            X_pre = p_multi.named_steps["preprocessor"].transform(X)
            
            # 3a. MultiOutput Score (Base Regressor)
            scores_m = cross_val_score(_build_base_regressor(), X_pre, y_col_clipped, cv=3, scoring="r2")
            r2_m = np.mean(scores_m)
            
            # 3b. RegressorChain Score (needs to include other targets as features)
            # For a more realistic estimate for Chain, we use all other targets as features (simulating the chain)
            X_chain = np.column_stack([X_pre] + [y[other].values for other in TARGET_COLUMNS if other != col])
            scores_c = cross_val_score(_build_base_regressor(), X_chain, y_col_clipped, cv=3, scoring="r2")
            r2_c = np.mean(scores_c)

            def r2_to_conf(r2):
                if r2 >= 0:
                    val = 0.3 + (0.7 * r2)
                else:
                    val = max(0.05, 0.3 / (1 + abs(r2)))
                return round(float(val), 3)

            conf_multi[col] = r2_to_conf(r2_m)
            conf_chain[col] = r2_to_conf(r2_c)
            
        except Exception:
            conf_multi[col] = 0.2
            conf_chain[col] = 0.2

    # Save Bundle
    os.makedirs(MODEL_DIR, exist_ok=True)
    bundle = {
        "multi": p_multi,
        "chain": p_chain,
        "conf_multi": conf_multi,
        "conf_chain": conf_chain
    }
    joblib.dump(bundle, MODEL_PATH)

    return {
        "status": "success",
        "num_samples": len(df),
        "features": FEATURE_COLUMNS,
        "targets": TARGET_COLUMNS,
        "conf_multi": conf_multi,
        "conf_chain": conf_chain
    }


def predict(input_data: dict) -> dict:
    """
    Predict using both models and apply clipping.
    """
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError("No trained model found.")

    bundle = joblib.load(MODEL_PATH)
    p_multi = bundle["multi"]
    p_chain = bundle["chain"]
    conf_multi = bundle.get("conf_multi", bundle.get("confidences", {}))
    conf_chain = bundle.get("conf_chain", bundle.get("confidences", {}))

    # Preprocess input
    input_row = {}
    for col in FEATURE_COLUMNS:
        value = input_data.get(col, None)
        if value == "" or value is None:
            input_row[col] = np.nan if col in NUMERIC_FEATURES else None
        else:
            input_row[col] = value

    df_input = pd.DataFrame([input_row])
    for col in NUMERIC_FEATURES:
        df_input[col] = pd.to_numeric(df_input[col], errors="coerce")

    # Load Geotech Rules
    rules_path = os.path.join(os.path.dirname(__file__), "geotech_rules.json")
    rules = []
    if os.path.exists(rules_path):
        with open(rules_path, "r") as f:
            rules = json.load(f).get("rules", [])

    # Identify restricted targets for the current input
    restricted_targets = []
    soil_type = input_data.get("soil_type")
    for rule in rules:
        if soil_type in rule.get("condition", {}).get("soil_type", []):
            restricted_targets.extend(rule.get("restricted_targets", []))

    # Predict with MultiOutput
    pred_m = p_multi.predict(df_input)
    # Predict with Chain
    pred_c = p_chain.predict(df_input)

    # Format result: value clipped at 0
    res_multi = {}
    res_chain = {}
    
    for i, col in enumerate(TARGET_COLUMNS):
        if col in restricted_targets:
            res_multi[col] = {"value": None, "confidence": 0, "restricted": True}
            res_chain[col] = {"value": None, "confidence": 0, "restricted": True}
            continue

        val_m = max(0.0, float(pred_m[0][i]))
        val_c = max(0.0, float(pred_c[0][i]))
        
        res_multi[col] = {
            "value": round(val_m, 4),
            "confidence": conf_multi.get(col, 0.5)
        }
        res_chain[col] = {
            "value": round(val_c, 4),
            "confidence": conf_chain.get(col, 0.5)
        }

    return {
        "multi_output": res_multi,
        "regressor_chain": res_chain
    }


def model_exists() -> bool:
    return os.path.exists(MODEL_PATH)


def get_distribution_stats(data: list[dict]) -> dict:
    """
    Calculate detailed distribution statistics for features and targets.
    Used for the front-end visual distribution dashboard.
    """
    if not data:
        return {}
    
    df = pd.DataFrame(data)
    
    # Pre-process columns (convert types and treat 0 as NaN where appropriate)
    for col in NUMERIC_FEATURES + TARGET_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        # For targets, treat 0 as NaN for stats calculation
        if col in TARGET_COLUMNS:
            df[col] = df[col].replace(0, np.nan)
    
    stats_bundle = {}
    
    all_numeric = NUMERIC_FEATURES + TARGET_COLUMNS
    
    for col in all_numeric:
        col_data = df[col].dropna()
        if col_data.empty:
            continue
            
        # Basic Descriptive Stats
        desc = col_data.describe()
        skew = col_data.skew()
        
        # Calculate Histogram (10 bins for clean visualization)
        counts, bin_edges = np.histogram(col_data, bins=10)
        histogram = []
        for i in range(len(counts)):
            histogram.append({
                "bin": f"{bin_edges[i]:.2f} - {bin_edges[i+1]:.2f}",
                "count": int(counts[i]),
                "range": [float(bin_edges[i]), float(bin_edges[i+1])]
            })
            
        # Bias Detection
        bias_level = "Neutral"
        if abs(skew) > 1:
            bias_level = "High" if skew > 0 else "High (Negative)"
        elif abs(skew) > 0.5:
            bias_level = "Moderate"
            
        stats_bundle[col] = {
            "type": "numeric",
            "mean": float(desc["mean"]),
            "median": float(desc["50%"]),
            "std": float(desc["std"]),
            "min": float(desc["min"]),
            "max": float(desc["max"]),
            "skew": float(skew) if not pd.isna(skew) else 0.0,
            "bias": bias_level,
            "histogram": histogram,
            "count": int(desc["count"])
        }
        
    # Categorical Features (e.g., Soil Type)
    for col in CATEGORICAL_FEATURES:
        counts = df[col].value_counts()
        distribution = []
        for val, count in counts.items():
            distribution.append({
                "label": str(val) if val else "Unknown",
                "count": int(count)
            })
            
        stats_bundle[col] = {
            "type": "categorical",
            "distribution": distribution,
            "count": int(len(df[col].dropna()))
        }
        
    return stats_bundle


def perform_regression_analysis(data: list[dict], x_col: str, y_col: str, force_origin: bool = False, model_type: str = "auto") -> dict:
    """
    Find the best fitting curve or a specific curve type between two numerical columns.
    Returns model details, equation string, R2, and trendline points.
    model_type can be: 'auto', 'Linear', 'Polynomial', 'Power', 'Exponential'
    """
    if not data or not x_col or not y_col:
        return {}

    df = pd.DataFrame(data)
    
    # Cast and Drop NaNs
    df[x_col] = pd.to_numeric(df[x_col], errors="coerce")
    df[y_col] = pd.to_numeric(df[y_col], errors="coerce")
    
    # Per user: 0 is missing for targets. For features it might be real, but for regression we usually want valid data.
    # In Geoteknik, most parameters (SPT, weight, etc) are > 0.
    df = df.replace(0, np.nan).dropna(subset=[x_col, y_col])
    
    # Per user: only take data between 5th and 95th percentile
    if len(df) > 10:  # Only apply if we have enough data to calculate percentiles meaningfully
        x_low, x_high = df[x_col].quantile([0.05, 0.95])
        y_low, y_high = df[y_col].quantile([0.05, 0.95])
        df = df[(df[x_col] >= x_low) & (df[x_col] <= x_high) & 
                (df[y_col] >= y_low) & (df[y_col] <= y_high)]
    
    if len(df) < 3:
        return {"error": "Not enough data points for regression (need at least 3)."}

    x = df[x_col].values
    y = df[y_col].values
    
    # Results container
    fits = []

    def calc_r2(y_true, y_pred):
        ss_res = np.sum((y_true - y_pred) ** 2)
        ss_tot = np.sum((y_true - np.mean(y_true)) ** 2)
        if ss_tot == 0: return 0
        return 1 - (ss_res / ss_tot)

    # 1. Linear Fit
    if force_origin:
        # y = ax -> a = sum(xy)/sum(x^2)
        a = np.sum(x * y) / np.sum(x * x)
        y_pred = a * x
        eq = f"y = {a:.4f}x"
    else:
        a, b = np.polyfit(x, y, 1)
        y_pred = a * x + b
        sign = "+" if b >= 0 else "-"
        eq = f"y = {a:.4f}x {sign} {abs(b):.4f}"
    fits.append({
        "name": "Linear", 
        "r2": calc_r2(y, y_pred), 
        "eq": eq, 
        "predict": lambda val: a * val + (0 if force_origin else b),
        "params": (a, 0 if force_origin else b)
    })

    # 2. Polynomial Fit (Deg 2)
    if force_origin:
        # y = ax^2 + bx
        X_mat = np.column_stack((x**2, x))
        params, _, _, _ = np.linalg.lstsq(X_mat, y, rcond=None)
        pa, pb = params
        y_pred = pa * x**2 + pb * x
        sign_b = "+" if pb >= 0 else "-"
        eq = f"y = {pa:.4f}x² {sign_b} {abs(pb):.4f}x"
        def poly_pred(val): return pa*val**2 + pb*val
    else:
        p = np.polyfit(x, y, 2)
        pa, pb, pc = p
        y_pred = np.polyval(p, x)
        s1 = "+" if pb >= 0 else "-"
        s2 = "+" if pc >= 0 else "-"
        eq = f"y = {pa:.4f}x² {s1} {abs(pb):.4f}x {s2} {abs(pc):.4f}"
        def poly_pred(val): return np.polyval(p, val)
    fits.append({
        "name": "Polynomial", 
        "r2": calc_r2(y, y_pred), 
        "eq": eq, 
        "predict": poly_pred,
        "params": (pa, pb, 0 if force_origin else pc)
    })

    # 3. Power Fit (y = ax^b) -> naturally passes through 0 if b > 0
    # log(y) = log(a) + b*log(x)
    try:
        mask = (x > 0) & (y > 0)
        if np.any(mask):
            lx = np.log(x[mask])
            ly = np.log(y[mask])
            b, log_a = np.polyfit(lx, ly, 1)
            a = np.exp(log_a)
            y_pred_mask = a * (x[mask] ** b)
            eq = f"y = {a:.4f}x^{b:.4f}"
            fits.append({
                "name": "Power", 
                "r2": calc_r2(y[mask], y_pred_mask), 
                "eq": eq, 
                "predict": lambda val: a * (val ** b) if val > 0 else 0,
                "params": (a, b)
            })
    except: pass

    # 4. Exponential Fit (y = a*e^(bx)) 
    # Log transform: log(y) = bx + log(a)
    try:
        mask = y > 0
        if np.any(mask):
            ly = np.log(y[mask])
            b, log_a = np.polyfit(x[mask], ly, 1)
            a = np.exp(log_a)
            if force_origin:
                # Adjust to y = a(e^bx - 1) - complicated for simple polyfit, but 
                # we'll stick to basic exponential for now or skip origin force if it's too complex
                pass
            y_pred_mask = a * np.exp(b * x[mask])
            eq = f"y = {a:.4f}e^({b:.4f}x)"
            fits.append({
                "name": "Exponential", 
                "r2": calc_r2(y[mask], y_pred_mask), 
                "eq": eq, 
                "predict": lambda val: a * np.exp(b * val),
                "params": (a, b)
            })
    except: pass

    # Sort by R2 and find best
    fits = [f for f in fits if not np.isnan(f["r2"])]
    
    if model_type != "auto":
        fits = [f for f in fits if f["name"] == model_type]
        
    if not fits:
        return {"error": f"Could not fit requested model '{model_type}' to the data." if model_type != "auto" else "Could not fit any model to the data."}
    
    fits.sort(key=lambda x: x["r2"], reverse=True)
    best = fits[0]

    # Generate trendline points (100 points from min to max)
    x_min, x_max = x.min(), x.max()
    margin = (x_max - x_min) * 0.1
    plot_x = np.linspace(max(0, x_min - margin), x_max + margin, 100)
    trendline = []
    for val in plot_x:
        try:
            p_y = best["predict"](val)
            if not np.isnan(p_y) and not np.isinf(p_y):
                trendline.append({"x": float(val), "y": float(p_y)})
        except: continue

    # Return raw data for scatter + best fit details
    scatter_data = [{"x": float(xi), "y": float(yi)} for xi, yi in zip(x, y)]

    # Helpers for LaTeX conversion
    def to_latex(model_name, best_params):
        if model_name == "Linear":
            return f"y = {best_params[0]:.4f}x + {best_params[1]:.4f}"
        elif model_name == "Polynomial":
            return f"y = {best_params[0]:.4f}x^2 + {best_params[1]:.4f}x + {best_params[2]:.4f}"
        elif model_name == "Power":
            return f"y = {best_params[0]:.4f}x^{{{best_params[1]:.4f}}}"
        elif model_name == "Exponential":
            return f"y = {best_params[0]:.4f}e^{{{best_params[1]:.4f}x}}"
        return ""

    best_latex = to_latex(best["name"], best["params"])

    return {
        "best_model": best["name"],
        "equation": best["eq"],
        "latex": best_latex,
        "r2": float(best["r2"]),
        "trendline": trendline,
        "scatter": scatter_data,
        "x_label": x_col,
        "y_label": y_col
    }

def discover_best_formula(data: list[dict], x_cols: list[str], y_col: str) -> dict:
    """
    Experimental engine that 'discovers' a complex empirical formula 
    by testing various mathematical transformations of multiple inputs.
    """
    df = pd.DataFrame(data)
    all_cols = x_cols + [y_col]
    
    # 1. Clean and Filter
    for col in all_cols:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    
    df = df.dropna(subset=all_cols)
    if len(df) < 5:
        return {"error": "Not enough data for formula discovery (need at least 5 valid records)."}

    # Filter 5th-95th percentile to remove extremes (User updated to 5-95 in docs)
    for col in all_cols:
        q_low, q_high = df[col].quantile([0.05, 0.95])
        df = df[(df[col] >= q_low) & (df[col] <= q_high)]

    if len(df) < 5:
        return {"error": "Too much data filtered out by percentile rules. Try another parameter."}

    X_raw = df[x_cols].values
    y = df[y_col].values
    
    from sklearn.linear_model import LinearRegression
    from sklearn.metrics import r2_score

    # 2. Generate Candidate Terms
    # We create a library of transformations for each X_i
    library_X = []
    library_names = []
    library_latex = []
    
    # Clean feature names for LaTeX (underscores can be problematic if not escaped)
    def clean_tex(name):
        return name.replace("_", "\\_")

    for i, col_name in enumerate(x_cols):
        xi = X_raw[:, i]
        tex_col = clean_tex(col_name)
        
        # Linear
        library_X.append(xi)
        library_names.append(col_name)
        library_latex.append(tex_col)
        
        # Square
        library_X.append(xi**2)
        library_names.append(f"({col_name})^2")
        library_latex.append(f"{{{tex_col}}}^2")
        
        # Sqrt (protected)
        library_X.append(np.sqrt(np.abs(xi)))
        library_names.append(f"sqrt({col_name})")
        library_latex.append(f"\\sqrt{{{tex_col}}}")
        
        # Inverse (protected)
        library_X.append(1.0 / (xi + 1e-6))
        library_names.append(f"1/({col_name})")
        library_latex.append(f"\\frac{{1}}{{{tex_col}}}")
        
        # Log (protected)
        library_X.append(np.log(np.abs(xi) + 1e-6))
        library_names.append(f"ln({col_name})")
        library_latex.append(f"\\ln({tex_col})")
        
        # Exp (capped to avoid overflow)
        x_scaled = (xi - xi.mean()) / (xi.std() + 1e-6)
        library_X.append(np.exp(np.clip(x_scaled, -5, 5)))
        library_names.append(f"exp(norm_{col_name})")
        library_latex.append(f"e^{{scaled\\_{tex_col}}}")

    # Stack all terms
    X_f = np.column_stack(library_X)
    
    # 3. Stepwise Selection (Simple Forward)
    selected_indices = []
    best_r2 = -np.inf
    
    for _ in range(min(4, X_f.shape[1])):
        temp_best_r2 = -np.inf
        temp_best_idx = -1
        
        for i in range(X_f.shape[1]):
            if i in selected_indices: continue
            
            trial_indices = selected_indices + [i]
            model = LinearRegression()
            model.fit(X_f[:, trial_indices], y)
            r2 = r2_score(y, model.predict(X_f[:, trial_indices]))
            
            if r2 > temp_best_r2:
                temp_best_r2 = r2
                temp_best_idx = i
                
        if temp_best_idx != -1 and temp_best_r2 > best_r2 + 0.005:
            best_r2 = temp_best_r2
            selected_indices.append(temp_best_idx)
        else:
            break

    if not selected_indices:
        return {"error": "Could not find any significant correlation."}

    # 4. Final Fit
    model = LinearRegression()
    model.fit(X_f[:, selected_indices], y)
    y_pred = model.predict(X_f[:, selected_indices])
    final_r2 = float(r2_score(y, y_pred))
    
    # 5. Build Formula Strings
    terms = []
    tex_terms = []
    intercept = model.intercept_
    for coef, idx in zip(model.coef_, selected_indices):
        name = library_names[idx]
        tex_name = library_latex[idx]
        
        sign = "+" if coef >= 0 else "-"
        abs_coef = abs(coef)
        
        terms.append(f"({coef:.4f} * {name})")
        tex_terms.append(f"{sign} {abs_coef:.4f} \\cdot {tex_name}")
    
    equation = f"y = {intercept:.4f} + " + " + ".join(terms)
    
    intercept_sign = "" if intercept >= 0 else "-"
    abs_intercept = abs(intercept)
    latex_equation = f"y = {intercept:.4f} " + " ".join(tex_terms)
    
    # 6. Generate Plot Data (Observed vs Predicted)
    plot_data = []
    for obs, pred in zip(y, y_pred):
        plot_data.append({"x": float(obs), "y": float(pred)})

    # Also calculate a trendline for the Observed vs Predicted (to show bias)
    # This is a linear fit of the results
    if len(plot_data) > 2:
        obs_vals = np.array([p["x"] for p in plot_data])
        pred_vals = np.array([p["y"] for p in plot_data])
        m, b = np.polyfit(obs_vals, pred_vals, 1)
        x_range = np.linspace(min(obs_vals), max(obs_vals), 50)
        discovery_trend = [{"x": float(xi), "y": float(m*xi + b)} for xi in x_range]
    else:
        discovery_trend = []

    return {
        "equation": equation,
        "latex": latex_equation,
        "r2": final_r2,
        "scatter": plot_data,
        "trendline": discovery_trend, # This is the "Actual Fit" line the user wants
        "x_label": f"Observed {y_col}",
        "y_label": f"Predicted {y_col}",
        "is_discovery": True
    }
