SynChain AI — Supply Chain Intelligence System

SynChain AI is an AI-powered supply chain risk intelligence and digital twin platform designed to help organizations identify, predict, simulate, and mitigate supply chain risks.
<img width="1919" height="907" alt="Screenshot 2026-08-23 232037" src="https://github.com/user-attachments/assets/bded643e-0c98-4447-929c-e0074ca598c9" />

The system combines machine learning, graph analytics, forecasting, scenario simulation, and enterprise data integration to provide a centralized view of supply chain health and potential disruptions.

Key Features
Supply Chain Risk Prediction
Predict potential supply chain disruptions using machine learning.
Risk scoring based on operational and external factors.
Digital Twin & Dependency Graph
Uses Neo4j to model suppliers, products, warehouses, factories, and dependencies.
Enables downstream impact and dependency tracing.
AI-Powered Forecasting
Demand and supply forecasting using Prophet and XGBoost.
Historical data analysis and predictive insights.
Scenario Simulation
Simulate disruptions such as:
Supplier failure
Shipment delays
Inventory shortages
Demand spikes
External events
Explainable AI
SHAP-based explanations for ML predictions.
Helps users understand why a particular risk score was generated.
Enterprise Integration
Connect enterprise systems through APIs.
Supports ERP, WMS, CRM, and custom REST APIs.
Securely stores enterprise API credentials.
Authentication & Security
JWT-based authentication.
Email verification.
Forgot-password and password-reset functionality.
Secure password hashing.
Protected API endpoints.
Risk Dashboard
Monitor supply chain risk levels.
View alerts, predictions, forecasts, and recommendations.
System Architecture
                    ┌──────────────────────┐
                    │    React Frontend    │
                    │      Vite + UI       │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │    FastAPI Backend   │
                    │   REST API + Auth    │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             │                 │                 │
             ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │     Neon     │  │    Neo4j     │  │  ML Engine   │
     │ PostgreSQL   │  │   AuraDB     │  │              │
     └──────────────┘  └──────────────┘  └──────────────┘
             │                 │                 │
             ▼                 ▼                 ▼
       Operational       Supply Chain       Prediction &
          Data              Graph           Forecasting
Technology Stack
Frontend
React
Vite
JavaScript / JSX
CSS
REST API integration
Backend
Python
FastAPI
SQLAlchemy
Pydantic
JWT Authentication
Databases
Neon PostgreSQL
Users
Authentication
Enterprise integrations
Operational and analytical data
Neo4j AuraDB
Supply chain graph
Digital Twin
Dependency relationships
Risk propagation
AI / ML
XGBoost
Prophet
SHAP
Scikit-learn
Pandas
NumPy
Google OR-Tools
External Services
Gmail SMTP
Enterprise REST APIs
Weather / external event data sources
Project Structure
SynChain-AI-Supply-Chain-Intelligence-System/
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── ml/
│   │   └── main.py
│   │
│   ├── tests/
│   ├── alembic/
│   ├── .env.example
│   └── requirements.txt
│
├── synchain-frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── datasets/
├── data/
├── outputs/
├── scripts/
│
├── .gitignore
├── README.md
└── task.md
Getting Started
1. Clone the Repository
git clone https://github.com/gauravpatrekar01/SynChain-AI-Supply-Chain-Intelligence-System.git
cd SynChain-AI-Supply-Chain-Intelligence-System
2. Backend Setup
cd backend

Create a virtual environment:

python -m venv venv

Activate it on Windows:

venv\Scripts\activate

Install dependencies:

pip install -r requirements.txt

Create:

backend/.env

using .env.example as a reference.

Configure your:

DATABASE_URL=
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
NEO4J_DATABASE=

JWT_SECRET=
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_FROM_EMAIL=
SMTP_FROM_NAME=SynChain AI

FRONTEND_URL=http://localhost:5173

Never commit .env or expose API keys/passwords in the repository.

3. Run Database Migrations
alembic upgrade head
4. Start Backend

From the backend directory:

uvicorn app.main:app --reload

Backend:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs
5. Frontend Setup

Open another terminal:

cd synchain-frontend

Install dependencies:

npm install

Start the development server:

npm run dev

Frontend:

http://localhost:5173
Authentication Flow
User Registration
       │
       ▼
Create Account
       │
       ▼
Email Verification
       │
       ▼
Login
       │
       ▼
JWT Authentication
       │
       ▼
New User?
   ┌───┴────┐
  Yes       No
   │         │
   ▼         ▼
Onboarding Dashboard
   │
   ▼
Connect Enterprise API
   │
   ▼
SynChain AI Dashboard
Enterprise Integration

New users can connect their enterprise systems through the onboarding interface.

Supported integration types include:

ERP
WMS
CRM
Custom REST API

The integration workflow is:

Enter API Details
       ↓
Test Connection
       ↓
Connection Successful
       ↓
Securely Save Credentials
       ↓
Complete Onboarding
       ↓
Access Dashboard

Enterprise credentials are handled by the backend and are not exposed to the frontend.

Supply Chain Digital Twin

Neo4j represents the supply chain as a graph.

Example:

Supplier
   │
   │ SUPPLIES
   ▼
Factory
   │
   │ PRODUCES
   ▼
Product
   │
   │ STORED_IN
   ▼
Warehouse
   │
   │ SHIPS_TO
   ▼
Customer

This allows SynChain AI to answer questions such as:

Which products depend on a specific supplier?
What happens if a supplier fails?
Which warehouses are affected by a disruption?
What downstream customers are impacted?
Which dependencies represent the highest risk?
Machine Learning Pipeline
Historical Data
      │
      ▼
Data Cleaning
      │
      ▼
Feature Engineering
      │
      ▼
ML Models
 ┌────┴─────┐
 │          │
XGBoost   Prophet
 │          │
 └────┬─────┘
      ▼
Risk Prediction
      │
      ▼
SHAP Explainability
      │
      ▼
Recommendations
Security

SynChain AI follows security practices including:

JWT-based authentication
Secure password hashing
Email verification
Password reset tokens
Environment-based secrets
Protected API routes
Authenticated enterprise integrations
Encrypted sensitive enterprise credentials
No secrets committed to Git
Testing

Backend tests:

cd backend
pytest

Frontend production build:

cd synchain-frontend
npm run build
Development Status

Current implementation includes:

 React frontend
 FastAPI backend
 Neon PostgreSQL integration
 Neo4j AuraDB integration
 JWT authentication
 Email verification
 Forgot password
 Password reset
 Enterprise onboarding
 Enterprise API integration
 Secure credential storage
 Supply chain graph foundation
 ML pipeline foundation
 Risk prediction architecture
 Scenario simulation architecture
Future Enhancements
Advanced supply chain risk prediction
Real-time external event ingestion
Automated risk alerts
Advanced scenario optimization
AI Supply Chain Copilot
Automated recommendations
Advanced Digital Twin visualization
Multi-enterprise integrations
Production deployment and monitoring
Team

SynChain AI Development Team

Gaurav Patrekar
Karan
Shridhar
License

This project is developed for academic and educational purposes.

SynChain AI — Predict. Simulate. Understand. Mitigate.
