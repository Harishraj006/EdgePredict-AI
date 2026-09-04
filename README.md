EdgePredict AI

Browser-Based Vehicle Health Prediction using Machine Learning and Edge AI




Live Demo: https://edge-predict-ai.vercel.app/

Overview

EdgePredict AI is a browser-based predictive maintenance prototype for vehicle health monitoring.

The application accepts vehicle sensor readings, processes them using an XGBoost model converted to ONNX, and runs inference directly inside the browser using ONNX Runtime Web.

The goal is to explore how machine learning can help identify abnormal vehicle conditions early and present the result in a simple, understandable dashboard.

Key Features

Browser-side ML inference using ONNX Runtime Web

Vehicle health prediction from sensor values

Anomaly / fault detection

Prediction confidence and vehicle health score

Affected component and severity analysis

Sensor abnormality analysis

AI Mechanic repair guidance

Estimated repair-cost guidance

Experimental Remaining Useful Life (RUL) prediction

Vehicle component visualizer

PDF report generation

Responsive deployment on Vercel

How It Works

Vehicle Sensor Values
        |
        v
Feature Extraction
        |
        v
Standard Scaling
        |
        v
XGBoost ONNX Model
        |
        v
Browser Inference
        |
        +----------------------+
        |                      |
        v                      v
Prediction / Confidence   Anomaly Analysis
        |                      |
        +----------+-----------+
                   |
                   v
        Vehicle Health Dashboard
                   |
          +--------+--------+
          |                 |
          v                 v
   AI Mechanic Advice   PDF Report

Sensor Inputs

Sensor

Description

Engine RPM

Engine rotational speed

Coolant Temperature

Engine coolant temperature

Battery Voltage

Electrical-system voltage

Fuel Pressure

Fuel-system pressure

Intake Air Temperature

Incoming air temperature

O2 Sensor Voltage

Oxygen sensor reading

Throttle Position

Throttle opening percentage

Speed

Vehicle speed

Prediction Output

After inference, EdgePredict AI can display:

Predicted vehicle status

Prediction confidence

Vehicle health score

Anomaly status

Affected component

Fault severity

Current sensor readings

Abnormal sensor values

Repair guidance

Estimated repair-cost range

Experimental RUL estimate

Tech Stack

Technology

Purpose

React

User interface

TypeScript

Type-safe development

Vite

Frontend tooling

XGBoost

Vehicle fault prediction

ONNX

Portable ML model format

ONNX Runtime Web

Browser-side inference

WebAssembly

Browser-compatible execution

Google Generative AI

AI Mechanic guidance

jsPDF + AutoTable

PDF reports

Vercel

Deployment

Why Edge AI?

The main fault-classification model runs directly in the browser instead of requiring a dedicated ML inference server.

Potential advantages include:

Lower inference latency

Reduced dependence on a backend inference service

Better privacy for primary sensor inference

Easier demos and deployment

A pathway toward future edge-device implementations

Optional generative-AI assistance may require an external API connection.

Local Setup

1. Clone the repository

git clone https://github.com/Harishraj006/EdgePredict-AI.git
cd EdgePredict-AI

2. Install dependencies

npm install

3. Start development server

npm run dev

4. Create a production build

npm run build

5. Preview the build

npm run preview

Project Structure

EdgePredict-AI/
├── public/
├── src/
│   ├── App.tsx
│   ├── App.css
│   ├── inference.ts
│   ├── rulInference.ts
│   ├── aiMechanic.ts
│   ├── scaler.ts
│   ├── config.ts
│   ├── exportUtils.ts
│   └── types/
├── package.json
└── vite.config.ts

Demo

Live Application

https://edge-predict-ai.vercel.app/

Source Code

https://github.com/Harishraj006/EdgePredict-AI

Current Status

EdgePredict AI is an educational / prototype predictive-maintenance project.

The core browser-based fault-classification workflow is implemented. Some features, especially Remaining Useful Life estimation, are experimental and should not be treated as production-grade automotive diagnostics.

Future Improvements

Train and validate on larger real-world vehicle datasets

Improve fault-classification accuracy and calibration

Build a dedicated RUL model aligned with the app's sensor features

Connect with real OBD-II / IoT sensor streams

Add historical vehicle-health trends

Add maintenance history and alerts

Optimize models for mobile and embedded edge devices

Add stronger explainability

Learning Outcomes

This project helped me explore:

ML deployment beyond notebooks

Converting models to ONNX

Running ML inference in the browser

Feature preprocessing and model integration

React + TypeScript development

Predictive maintenance concepts

Building user-friendly AI dashboards

Deploying an end-to-end AI application

Disclaimer

EdgePredict AI is a learning and research prototype. Predictions, health scores, repair advice, estimated costs, and RUL values should not replace inspection or diagnosis by a qualified automotive professional.

Author

Harishraj V

GitHub: @Harishraj006

If you find this project useful, consider giving the repository a star.
