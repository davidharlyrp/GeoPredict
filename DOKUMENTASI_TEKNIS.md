# Geotechnical Parameter Predictor - Technical Documentation (v6.3.0)

## 1. Executive Summary
The **Geotechnical Parameter Predictor** is a specialized engineering platform designed to solve the problem of missing soil data in borehole logs. By combining cross-correlated Machine Learning models with classical statistical regression and **Symbolic-Lite Formula Discovery**, the system allows engineers to estimate critical soil properties with quantified reliability.

---

## 2. Core Architecture & Technology Stack

### A. Integrated System Design
*   **Database Integrated**: Real-time synchronization with **PocketBase**.
*   **Framework**: **FastAPI** (Python 3.10+) for the backend engine.
*   **Frontend**: **React 19** with **Vite 7** and **TypeScript**.
*   **Styling Engine**: **Tailwind CSS v4** with a custom **Army Design System**.

### B. Single Source of Truth (`parameters.json`)
The entire application (DB Schema, Pydantic Models, Frontend Forms, and ML Targets) is dynamically driven by a centralized configuration file.
*   **Feature Columns**: Input parameters (Depth, N-SPT, Soil Type).
*   **Target Columns**: Predicted parameters (Su, Phi, e0, Cc, etc.).
*   **Automatic Adaptation**: Modifying this JSON immediately updates the entire pipeline across FE/BE.

---

## 3. Advanced Machine Learning Engine

### A. Data Preprocessing Pipeline
1.  **Strict Domain Cleaning**:
    *   **Zero-to-NaN Conversion**: Geotechnical parameters like Weight or Strength cannot be zero. The system converts `0` to `NaN` in target columns to prevent biasing the model with missing data placeholders.
2.  **Imputation Strategy**:
    *   **Numeric**: Uses the **Median** of actual physical measurements to fill missing feature values.
    *   **Categorical**: Uses the **Most Frequent** (Mode) category for soil type classification.
3.  **Scaling**: All features are standardized via `StandardScaler` ($\mu=0, \sigma=1$) to ensure numerical stability for the XGBoost regressor.

### B. Dual-Model Architecture
The system computes predictions using two different mathematical perspectives:
1.  **Multi-Output Regressor**:
    *   **Logic**: Treats each soil parameter as a mathematically independent variable.
    *   **Strength**: Fast and stable, ideal for parameters with weak correlation.
2.  **Regressor Chain**:
    *   **Logic**: Captures physical inter-dependencies. Parameter $A$ influences the prediction of $B$, which both influence $C$.
    *   **Scientific Basis**: Reflects the real-world nature of soil where Depth and N-SPT naturally correlate with Strength and Density.

### C. Split reliability Scoring System
Each model is evaluated independently using **3-Fold Cross-Validation** ($R^2$ metric).
*   **Mathematical Mapping**:
    *   For $R^2 \ge 0$: $Reliability = 0.3 + (0.7 \times R^2)$
    *   For $R^2 < 0$: $Reliability = \max(0.05, \frac{0.3}{1 + |R^2|})$
*   **Winsorization**: Scores are calculated on data clipped to the **5th-95th percentile** to ensure extreme outliers don't unfairly penalize the model reliability.

---

## 4. Scientific Regression & Formula Discovery Suite

### A. Data Filtering Logic
In the Correlation tab, data is automatically filtered to the **5th-95th percentile** range.
*   **Purpose**: This removes "noise" and clerical errors, allowing the trendline or discovered formula to reflect the true physical behavior of the soil.

### B. Multi-Model Curve Fitting
The engine tests four classical regression models specifically chosen for soil mechanics:
1.  **Linear**: $y = ax + b$
2.  **Polynomial (Deg 2)**: $y = ax^2 + bx + c$
3.  **Power**: $y = ax^b$
4.  **Exponential**: $y = ae^{bx}$

### C. Formula Discovery Engine (Multi-Parameter)
Version 5.0.0 introduces the **Symbolic-Lite Discovery Engine**.
*   **Logic**: Searches for complex relationships where $Y = f(X_1, X_2, \dots, X_n)$.
*   **Transformations**: For each input $X_i$, the system tests a library of mathematical kernels: $\{x, x^2, \sqrt{|x|}, 1/x, \ln(|x|), e^x\}$.
*   **Optimization**: Uses Stepwise Forward Selection to pick the top 4 most significant mathematical terms that maximize $R^2$ while maintaining engineering legibility.
*   **Visualization**: Switches to an **Observed vs Predicted** plot to visualize the accuracy of the multi-parameter formula.

---

## 5. Scientific Regression & Formula Discovery Suite

### D. Geotechnical Prediction Constraints (v5.2.1)
To ensure engineering validity, the system enforces **Scientific Restrictions** based on soil classification:
*   **Rules Engine (`geotech_rules.json`)**: A centralized configuration for both FE/BE.
*   **Safe Inference**: Predictions for **Su, c', Cc, Cr, Cv, LL, PL, PI** are automatically disabled and marked as **N/A** for "Sand" and "Gravel".
*   **Data Integrity (Data Entry)**: In the input form, these parameters are **automatically disabled** and **reset to 0** when non-cohesive soils are selected, preventing incorrect data entry and ensuring ML model training quality.

---

## 6. UI/UX: The Army Design System

### A. Design Constraints
*   **Typography**: Clean sans-serif fonts (Inter/System) with high contrast.
*   **Palette**: Dark mode (`#0a0a0a`) with primary accents (`#727b56`).
*   **Spacing**: **Ultra-Compact** layout with minimal `gap-4` metrics and tight `0.25rem` rounding to maximize information density on one screen.

### B. Dashboard Features
*   **Distribution View**: Real-time histograms with **Skewness** analysis.
*   **Bias detection**:
    *   $|Skew| > 1.0$: Classified as **High Bias** (User alerted to unbalanced data).
    *   $|Skew| \le 1.0$: Classified as **Neutral** (Safe for AI generalization).

---

## 6. End-to-End Workflow

1.  **Data Entry**:borehole data is synchronized to PocketBase.
2.  **System Training**:
    *   Fetches raw data.
    *   Applies Domain Cleaning (Zero-to-NaN).
    *   Trains Dual Models.
    *   Generates separate Reliability scores.
3.  **Visualization**: Engineer verifies data distribution and correlations in the "Distribution" tab.
4.  **Prediction**: Engineer enters partial data to generate high-fidelity estimates of missing parameters.

---
**Documentation Version**: 5.0.0 (Symbolic Discovery Edition)  
**Latest Update**: Multi-Parameter Formula Discovery, Symbolic-Lite Engine, and 5-95th Percentile Filtering.  
**Engineer**: Antigravity AI  
**Date**: 2026-03-06
