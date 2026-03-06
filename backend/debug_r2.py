import pandas as pd
import numpy as np
import sys
import os
sys.path.append(os.getcwd())

from pocketbase_client import fetch_all_soil_data
from params_config import FEATURE_COLUMNS, TARGET_COLUMNS, NUMERIC_FEATURES, CATEGORICAL_FEATURES
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler, OneHotEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import cross_val_score
from xgboost import XGBRegressor

def analyze_r2():
    data = fetch_all_soil_data()
    if not data:
        print("No data found.")
        return
        
    df = pd.DataFrame(data)
    for col in NUMERIC_FEATURES + TARGET_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors='coerce')
        
    df = df.dropna(subset=TARGET_COLUMNS, how='all')
    X = df[FEATURE_COLUMNS]
    y = df[TARGET_COLUMNS]
    
    # Simple preprocessing
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
        ]
    )
    
    from sklearn.ensemble import RandomForestRegressor
    
    X_pre = preprocessor.fit_transform(X)
    
    print(f"Dataset size: {len(df)}")
    print("--- R2 Scores per Target (3-Fold CV with RandomForest) ---")
    
    for col in TARGET_COLUMNS:
        y_col = y[col].fillna(y[col].median() or 0)
        if y_col.nunique() <= 1:
            print(f"{col}: CONSTANT DATA (all values are same)")
            continue
            
        scores = cross_val_score(RandomForestRegressor(n_estimators=50, random_state=42), X_pre, y_col, cv=3, scoring='r2')
        mean_s = np.mean(scores)
        print(f"{col:12}: Mean R2 = {mean_s:6.3f} | Scores = {scores}")

if __name__ == "__main__":
    analyze_r2()
