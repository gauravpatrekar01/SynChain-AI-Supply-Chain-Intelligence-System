# SynChain AI — Supply Chain Intelligence System

<p align="center">
  <strong>AI-Powered Supply Chain Risk Intelligence, Digital Twin & Decision Support Platform</strong>
</p>

<img width="1919" height="907" alt="Screenshot 2026-08-23 232037" src="https://github.com/user-attachments/assets/195a99d4-3d99-4211-91f7-6fc2f9ee0c21" />

<p align="center">
  Predict • Simulate • Understand • Mitigate
</p>

<p align="center">

![Python](https://img.shields.io/badge/Python-3.x-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql)
![Neo4j](https://img.shields.io/badge/Neo4j-AuraDB-018BFF?logo=neo4j)
![XGBoost](https://img.shields.io/badge/XGBoost-ML-orange)
![Prophet](https://img.shields.io/badge/Prophet-Forecasting-blue)
![License](https://img.shields.io/badge/License-Academic-lightgrey)

</p>

---

## Overview

**SynChain AI** is an AI-powered **Supply Chain Risk Intelligence and Digital Twin platform** designed to help organizations identify, predict, simulate, and mitigate supply chain risks.

The system combines:

- Machine Learning
- Predictive Analytics
- Graph Analytics
- Demand & Supply Forecasting
- Scenario Simulation
- Explainable AI
- Enterprise API Integration
- Supply Chain Digital Twin
- Risk Monitoring and Recommendations

SynChain AI provides a centralized platform for understanding supply chain health, detecting potential disruptions, tracing dependencies, and evaluating the possible impact of disruption scenarios.

---

## Dashboard

<p align="center">
  <img 
    src="https://github.com/user-attachments/assets/bded643e-0c98-4447-929c-e0074ca598c9"
    alt="SynChain AI Dashboard"
    width="100%"
  />
</p>

---

# Key Features

## 1. Supply Chain Risk Prediction

Predict potential supply chain disruptions using machine learning models.

### Capabilities

- Risk prediction
- Risk scoring
- Supplier risk analysis
- Inventory risk analysis
- Demand-related risk analysis
- External event impact analysis
- Risk classification

---

## 2. Digital Twin & Dependency Graph

SynChain AI uses **Neo4j AuraDB** to represent the supply chain as a connected graph.

The graph can model:

- Suppliers
- Factories
- Products
- Warehouses
- Customers
- Orders
- Transportation routes
- Dependencies

This enables downstream dependency tracing and disruption impact analysis.

---

## 3. AI-Powered Forecasting

The system uses forecasting and machine learning techniques to analyze historical supply chain data.

### Technologies

- Prophet
- XGBoost
- Scikit-learn
- Pandas
- NumPy

### Use Cases

- Demand forecasting
- Supply forecasting
- Inventory trend prediction
- Risk forecasting
- Anomaly detection

---

## 4. Scenario Simulation

Users can simulate possible supply chain disruptions and evaluate their impact.

### Example Scenarios

- Supplier failure
- Shipment delays
- Inventory shortages
- Demand spikes
- Factory disruption
- Transportation disruption
- External events

The simulation engine helps determine:

> **"What happens to the supply chain if this event occurs?"**

---

## 5. Explainable AI

SynChain AI uses **SHAP (SHapley Additive exPlanations)** to explain machine learning predictions.

Instead of only showing:

```text
Risk Score: 82%
```

the system can explain the major factors contributing to the prediction.

Example:

```text
Risk Score: 82%

Major Risk Factors:
├── Supplier Reliability     +24%
├── Inventory Level          +21%
├── Shipment Delay           +18%
└── Demand Increase          +12%
```

This improves transparency and decision-making.

---

## 6. Enterprise Integration

Organizations can connect their existing enterprise systems through APIs.

### Supported Integration Types

- ERP
- WMS
- CRM
- Custom REST APIs

### Integration Workflow

```text
Enter API Details
       │
       ▼
Test Connection
       │
       ▼
Connection Successful
       │
       ▼
Securely Save Credentials
       │
       ▼
Complete Onboarding
       │
       ▼
SynChain AI Dashboard
```

Enterprise credentials are securely handled by the backend and are not exposed through frontend responses.

---

## 7. Authentication & Security

SynChain AI includes a complete authentication workflow.

### Features

- User registration
- JWT authentication
- Secure password hashing
- Email verification
- Forgot password
- Password reset
- Protected API endpoints
- Environment-based secrets
- Authenticated enterprise integrations
- Encrypted sensitive credentials

---

## 8. Risk Intelligence Dashboard

The dashboard provides centralized visibility into supply chain conditions.

### Dashboard Capabilities

- Overall supply chain risk
- Risk alerts
- Risk predictions
- Forecasts
- Supplier risk
- Inventory risk
- Scenario results
- Recommendations
- Digital Twin insights

---

# System Architecture

```text
                         ┌───────────────────────────┐
                         │       React Frontend       │
                         │        Vite + UI           │
                         └─────────────┬─────────────┘
                                       │
                                       │ REST API
                                       ▼
                         ┌───────────────────────────┐
                         │      FastAPI Backend       │
                         │    Authentication + API    │
                         └─────────────┬─────────────┘
                                       │
                ┌──────────────────────┼──────────────────────┐
                │                      │                      │
                ▼                      ▼                      ▼
       ┌────────────────┐    ┌────────────────┐    ┌────────────────┐
       │ Neon PostgreSQL│    │  Neo4j AuraDB  │    │   ML Engine    │
       │                │    │                │    │                │
       │ Users          │    │ Digital Twin   │    │ XGBoost        │
       │ Auth           │    │ Dependencies   │    │ Prophet        │
       │ Integrations   │    │ Relationships  │    │ SHAP           │
       │ Operational    │    │ Risk Propagation│   │ Forecasting    │
       │ Data           │    │                │    │                │
       └────────────────┘    └────────────────┘    └────────────────┘
                │                      │                      │
                └──────────────────────┼──────────────────────┘
                                       │
                                       ▼
                         ┌───────────────────────────┐
                         │  Risk Intelligence Engine │
                         │                           │
                         │ Prediction                │
                         │ Simulation                │
                         │ Recommendations           │
                         │ Alerts                    │
                         └───────────────────────────┘
```

---

# Technology Stack

## Frontend

| Technology | Purpose |
|---|---|
| React | User Interface |
| Vite | Development & Build Tool |
| JavaScript / JSX | Frontend Development |
| CSS | Styling |
| REST APIs | Backend Communication |

## Backend

| Technology | Purpose |
|---|---|
| Python | Backend & ML Development |
| FastAPI | REST API Framework |
| SQLAlchemy | ORM |
| Pydantic | Data Validation |
| JWT | Authentication |

## Databases

### Neon PostgreSQL

Used for:

- User accounts
- Authentication data
- Enterprise integrations
- Operational data
- Analytical data
- Application metadata

### Neo4j AuraDB

Used for:

- Supply chain graph
- Digital Twin
- Dependency relationships
- Supplier-product relationships
- Risk propagation
- Downstream impact analysis

## AI / Machine Learning

| Technology | Purpose |
|---|---|
| XGBoost | Risk Prediction |
| Prophet | Forecasting |
| SHAP | Explainable AI |
| Scikit-learn | ML Utilities |
| Pandas | Data Processing |
| NumPy | Numerical Computing |
| Google OR-Tools | Optimization |

## External Services

- Gmail SMTP
- Enterprise REST APIs
- Weather APIs
- External event/news data sources

---

# Supply Chain Digital Twin

The Digital Twin represents the physical supply chain as a graph.

Example:

```text
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
```

Neo4j allows SynChain AI to perform dependency analysis such as:

- Which products depend on a specific supplier?
- What happens if a supplier fails?
- Which warehouses are affected?
- Which customers are impacted?
- Which supply chain dependencies have the highest risk?

---

# Machine Learning Pipeline

```text
                 Historical Data
                       │
                       ▼
                 Data Cleaning
                       │
                       ▼
                Feature Engineering
                       │
                       ▼
                ┌──────┴──────┐
                │             │
                ▼             ▼
             XGBoost        Prophet
                │             │
                └──────┬──────┘
                       ▼
                Risk Prediction
                       │
                       ▼
                SHAP Explainability
                       │
                       ▼
                 Risk Analysis
                       │
                       ▼
                Recommendations
```

---

# Authentication Flow

```text
                    User
                      │
                      ▼
               Registration
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
                /       \
              Yes        No
               │          │
               ▼          ▼
          Onboarding    Dashboard
               │
               ▼
       Enterprise Integration
               │
               ▼
          Complete Setup
               │
               ▼
           Main Dashboard
```

---

# Project Structure

```text
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
```

---

# Getting Started

## Prerequisites

Make sure the following are installed:

- Python 3.x
- Node.js
- npm
- Git
- PostgreSQL-compatible database
- Neo4j AuraDB account

---

## 1. Clone the Repository

```bash
git clone https://github.com/gauravpatrekar01/SynChain-AI-Supply-Chain-Intelligence-System.git

cd SynChain-AI-Supply-Chain-Intelligence-System
```

---

# Backend Setup

## 2. Navigate to Backend

```bash
cd backend
```

## 3. Create Virtual Environment

```bash
python -m venv venv
```

### Windows

```powershell
venv\Scripts\activate
```

### Linux / macOS

```bash
source venv/bin/activate
```

---

## 4. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 5. Configure Environment Variables

Create:

```text
backend/.env
```

Use `.env.example` as a template.

Example:

```env
DATABASE_URL=your_neon_postgresql_url

NEO4J_URI=your_neo4j_uri
NEO4J_USERNAME=your_neo4j_username
NEO4J_PASSWORD=your_neo4j_password
NEO4J_DATABASE=your_neo4j_database

JWT_SECRET=your_secure_jwt_secret
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_email
SMTP_FROM_NAME=SynChain AI

FRONTEND_URL=http://localhost:5173
```

> **Important:** Never commit `.env` files, passwords, database credentials, JWT secrets, SMTP credentials, or API keys to GitHub.

---

# Database Setup

## 6. Run Database Migrations

From the `backend` directory:

```bash
alembic upgrade head
```

---

# Start the Backend

## 7. Run FastAPI

```bash
uvicorn app.main:app --reload
```

The backend will be available at:

```text
http://127.0.0.1:8000
```

### API Documentation

FastAPI Swagger UI:

```text
http://127.0.0.1:8000/docs
```

ReDoc:

```text
http://127.0.0.1:8000/redoc
```

---

# Frontend Setup

## 8. Open a New Terminal

From the project root:

```bash
cd synchain-frontend
```

## 9. Install Dependencies

```bash
npm install
```

## 10. Start Development Server

```bash
npm run dev
```

Frontend will be available at:

```text
http://localhost:5173
```

---

# Testing

## Backend Tests

```bash
cd backend
pytest
```

## Frontend Production Build

```bash
cd synchain-frontend
npm run build
```

---

# Development Status

| Component | Status |
|---|---|
| React Frontend | ✅ |
| FastAPI Backend | ✅ |
| Neon PostgreSQL | ✅ |
| Neo4j AuraDB | ✅ |
| JWT Authentication | ✅ |
| User Registration | ✅ |
| Email Verification | ✅ |
| Forgot Password | ✅ |
| Password Reset | ✅ |
| Enterprise Onboarding | ✅ |
| Enterprise API Integration | ✅ |
| Secure Credential Storage | ✅ |
| Supply Chain Graph Foundation | ✅ |
| ML Pipeline Foundation | ✅ |
| Risk Prediction Architecture | ✅ |
| Scenario Simulation Architecture | ✅ |

---

# Future Enhancements

- [ ] Advanced supply chain risk prediction
- [ ] Real-time external event ingestion
- [ ] Automated risk alerts
- [ ] Advanced scenario optimization
- [ ] AI Supply Chain Copilot
- [ ] Automated recommendations
- [ ] Advanced Digital Twin visualization
- [ ] Multi-enterprise integrations
- [ ] Real-time supply chain monitoring
- [ ] Production deployment
- [ ] Monitoring and observability

---

# Security

SynChain AI follows security practices including:

- JWT-based authentication
- Secure password hashing
- Email verification
- Password reset tokens
- Environment-based secrets
- Protected API routes
- Authenticated enterprise integrations
- Encrypted sensitive enterprise credentials
- No secrets committed to Git

If credentials are accidentally exposed, they should be **revoked and regenerated immediately**.

---

# Team

### SynChain AI Development Team

| Member | Role |
|---|---|
| **Gaurav Patrekar** | Developer |
| **Karan Chavan** | Developer |
| **Shridhar Gurav** | Developer |

---

# License

This project is developed for **academic and educational purposes**.

---

<p align="center">

## SynChain AI

**Predict. Simulate. Understand. Mitigate.**

</p>
