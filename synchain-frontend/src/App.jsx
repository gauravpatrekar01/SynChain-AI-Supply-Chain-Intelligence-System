import { useState } from "react";
import "./App.css";

const modules = [
  {
    id: "overview",
    label: "Overview",
    icon: "◉",
    section: "MAIN",
  },
  {
    id: "data",
    label: "Data Input",
    icon: "⬡",
    section: "INTELLIGENCE",
  },
  {
    id: "forecast",
    label: "Forecasting",
    icon: "◌",
    section: "INTELLIGENCE",
  },
  {
    id: "risk",
    label: "Risk Management",
    icon: "◇",
    section: "INTELLIGENCE",
  },
  {
    id: "scenario",
    label: "Scenario Simulation",
    icon: "◎",
    section: "INTELLIGENCE",
  },
  {
    id: "recommendations",
    label: "AI Recommendations",
    icon: "✦",
    section: "DECISION SUPPORT",
  },
  {
    id: "alerts",
    label: "Alert Center",
    icon: "⚠",
    section: "DECISION SUPPORT",
  },
  {
    id: "reports",
    label: "Reports",
    icon: "▤",
    section: "REPORTING",
  },
];

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!email || !password) {
      alert("Please enter your email and password.");
      return;
    }

    onLogin();
  };

  return (
    <div className="login-page">
      <div className="grid-background" />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <div className="system-status">
        <span className="status-pulse" />
        SYNCHAIN AI CORE
        <span className="separator">/</span>
        SECURE ACCESS
      </div>

      <main className="login-container">
        {/* LEFT */}
        <section className="login-visual">
          <div className="visual-content">
            <div className="logo-mark">
              <span>S</span>
            </div>

            <p className="eyebrow">
              SUPPLY CHAIN INTELLIGENCE PLATFORM
            </p>

            <h1>
              Predict.
              <br />
              <span>Prevent.</span>
              <br />
              Optimize.
            </h1>

            <p className="visual-description">
              AI-powered supply chain intelligence for forecasting,
              risk prediction, scenario simulation and intelligent
              decision support.
            </p>

            <div className="intelligence-lines">
              <div className="intel-line">
                <span className="line-icon">◈</span>
                <div>
                  <strong>Predictive Intelligence</strong>
                  <small>Demand & supply forecasting</small>
                </div>
              </div>

              <div className="intel-line">
                <span className="line-icon">◇</span>
                <div>
                  <strong>Risk Intelligence</strong>
                  <small>Real-time disruption prediction</small>
                </div>
              </div>

              <div className="intel-line">
                <span className="line-icon">✦</span>
                <div>
                  <strong>Decision Intelligence</strong>
                  <small>AI-powered recommendations</small>
                </div>
              </div>
            </div>
          </div>

          <div className="ai-orb-container">
            <div className="orb-ring ring-one" />
            <div className="orb-ring ring-two" />
            <div className="orb-ring ring-three" />

            <div className="orb-core">
              <span>SC</span>
            </div>

            <div className="orb-particle particle-one" />
            <div className="orb-particle particle-two" />
            <div className="orb-particle particle-three" />
          </div>
        </section>

        {/* RIGHT */}
        <section className="login-panel">
          <div className="login-card">
            <div className="mobile-logo">
              <div className="small-logo">S</div>

              <div>
                <strong>SynChain</strong>
                <small>AI ANALYZER</small>
              </div>
            </div>

            <div className="login-header">
              <div className="secure-icon">◉</div>

              <div>
                <span className="login-eyebrow">
                  AUTHENTICATION
                </span>

                <h2>Welcome back</h2>

                <p>
                  Access your supply chain intelligence center.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="input-group">
                <label htmlFor="email">EMAIL ADDRESS</label>

                <div className="input-wrapper">
                  <span className="input-icon">@</span>

                  <input
                    id="email"
                    type="email"
                    placeholder="manager@synchain.ai"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <div className="password-label">
                  <label htmlFor="password">PASSWORD</label>

                  <button
                    type="button"
                    className="forgot-btn"
                    onClick={() =>
                      alert(
                        "Password recovery will be connected to the backend."
                      )
                    }
                  >
                    Forgot password?
                  </button>
                </div>

                <div className="input-wrapper">
                  <span className="input-icon">◆</span>

                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />

                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                  >
                    {showPassword ? "◉" : "◎"}
                  </button>
                </div>
              </div>

              <div className="login-options">
                <label className="remember">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) =>
                      setRemember(e.target.checked)
                    }
                  />

                  <span className="custom-checkbox">
                    {remember ? "✓" : ""}
                  </span>

                  <span>Keep me signed in</span>
                </label>

                <div className="secure-label">
                  <span />
                  ENCRYPTED
                </div>
              </div>

              <button
                type="submit"
                className="login-button"
              >
                <span>Enter SynChain</span>
                <strong>→</strong>
              </button>
            </form>

            <div className="divider">
              <span>SECURE ACCESS</span>
            </div>

            <div className="system-info">
              <div>
                <span className="info-dot" />
                AI ENGINE
                <strong>ONLINE</strong>
              </div>

              <div>
                <span className="info-dot" />
                DATA PIPELINE
                <strong>READY</strong>
              </div>

              <div>
                <span className="info-dot" />
                SECURITY
                <strong>ACTIVE</strong>
              </div>
            </div>

            <p className="login-footer">
              SynChain AI • Supply Chain Intelligence
            </p>
          </div>
        </section>
      </main>

      <div className="bottom-status">
        <span>SYS.ID</span>
        <strong>SC-AI-01</strong>

        <span className="bottom-separator" />

        <span>STATUS</span>
        <strong className="online">OPERATIONAL</strong>
      </div>
    </div>
  );
}


/* =========================================================
   MAIN APPLICATION
========================================================= */

function Dashboard({ onLogout }) {
  const [activeModule, setActiveModule] = useState("overview");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const active =
    modules.find((module) => module.id === activeModule) ||
    modules[0];

  const renderModule = () => {
    switch (activeModule) {
      case "data":
        return <DataInput />;

      case "forecast":
        return <Forecasting />;

      case "risk":
        return <RiskManagement />;

      case "scenario":
        return <ScenarioSimulation />;

      case "recommendations":
        return <Recommendations />;

      case "alerts":
        return <AlertCenter />;

      case "reports":
        return <Reports />;

      default:
        return <Overview />;
    }
  };

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside
        className={`sidebar ${
          sidebarOpen ? "sidebar-open" : "sidebar-closed"
        }`}
      >
        <div className="brand">
          <div className="brand-logo">S</div>

          {sidebarOpen && (
            <div className="brand-text">
              <strong>SynChain</strong>
              <span>AI ANALYZER</span>
            </div>
          )}
        </div>

        <div className="sidebar-status">
          <span />
          {sidebarOpen && "SYSTEM ONLINE"}
        </div>

        <nav className="navigation">
          {["MAIN", "INTELLIGENCE", "DECISION SUPPORT", "REPORTING"].map(
            (section) => {
              const sectionModules = modules.filter(
                (module) => module.section === section
              );

              return (
                <div className="nav-section" key={section}>
                  {sidebarOpen && (
                    <div className="nav-section-title">
                      {section}
                    </div>
                  )}

                  {sectionModules.map((module) => (
                    <button
                      key={module.id}
                      className={`nav-item ${
                        activeModule === module.id
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setActiveModule(module.id)
                      }
                    >
                      <span className="nav-icon">
                        {module.icon}
                      </span>

                      {sidebarOpen && (
                        <span>{module.label}</span>
                      )}

                      {module.id === "alerts" &&
                        sidebarOpen && (
                          <span className="alert-count">
                            3
                          </span>
                        )}
                    </button>
                  ))}
                </div>
              );
            }
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="user-card">
            <div className="user-avatar">GP</div>

            {sidebarOpen && (
              <div className="user-info">
                <strong>Supply Manager</strong>
                <span>Administrator</span>
              </div>
            )}
          </div>

          {sidebarOpen && (
            <button
              className="logout-button"
              onClick={onLogout}
            >
              ↪ Logout
            </button>
          )}
        </div>
      </aside>

      {/* MAIN */}
      <main className="main-content">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-button"
              onClick={() =>
                setSidebarOpen(!sidebarOpen)
              }
            >
              ☰
            </button>

            <div>
              <span className="breadcrumb">
                SYNCHAIN AI / {active.section}
              </span>

              <h1>{active.label}</h1>
            </div>
          </div>

          <div className="topbar-right">
            <div className="live-status">
              <span />
              LIVE
            </div>

            <div className="top-icon">
              ⚙
            </div>

            <div className="top-icon notification-icon">
              ◇
              <span>3</span>
            </div>

            <div className="top-avatar">GP</div>
          </div>
        </header>

        <div className="page-content">
          {renderModule()}
        </div>
      </main>
    </div>
  );
}


/* =========================================================
   OVERVIEW
========================================================= */

function Overview() {
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="section-label">
            INTELLIGENCE CENTER
          </span>

          <h2>Supply Chain Overview</h2>

          <p>
            Real-time visibility across your supply chain.
          </p>
        </div>

        <div className="date-badge">
          18 AUG 2026
        </div>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Overall Risk"
          value="72"
          suffix="/100"
          status="HIGH"
          icon="◇"
        />

        <StatCard
          title="Demand Forecast"
          value="+18.4"
          suffix="%"
          status="INCREASE"
          icon="◌"
        />

        <StatCard
          title="Supply Stability"
          value="93.8"
          suffix="%"
          status="STABLE"
          icon="⬡"
        />

        <StatCard
          title="Critical Alerts"
          value="03"
          suffix=""
          status="ACTION REQUIRED"
          icon="⚠"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel large-panel">
          <PanelHeader
            title="Demand Forecast"
            subtitle="Next 30 days"
          />

          <ForecastChart />
        </div>

        <div className="panel">
          <PanelHeader
            title="Risk Distribution"
            subtitle="Current exposure"
          />

          <RiskBars />
        </div>

        <div className="panel">
          <PanelHeader
            title="Active Alerts"
            subtitle="Requires attention"
          />

          <MiniAlerts />
        </div>

        <div className="panel large-panel">
          <PanelHeader
            title="AI Recommendations"
            subtitle="Priority actions"
          />

          <RecommendationRows />
        </div>
      </div>
    </>
  );
}


/* =========================================================
   DATA INPUT
========================================================= */

function DataInput() {
  const [activeTab, setActiveTab] =
    useState("supply");

  const tabs = [
    ["supply", "Supply Chain Data"],
    ["erp", "ERP Integration"],
    ["wms", "WMS Integration"],
    ["weather", "Weather API"],
    ["news", "News & Disruption"],
  ];

  return (
    <>
      <PageTitle
        label="DATA INTELLIGENCE"
        title="Data Input Center"
        description="Connect and validate the data sources powering SynChain AI."
      />

      <div className="module-tabs">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            className={activeTab === id ? "selected" : ""}
            onClick={() => setActiveTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="input-dashboard">
        <div className="panel input-main">
          <PanelHeader
            title={
              tabs.find((tab) => tab[0] === activeTab)?.[1]
            }
            subtitle="Data source configuration"
          />

          <div className="form-grid">
            <InputField
              label="DATA SOURCE NAME"
              placeholder="Enter source name"
            />

            <InputField
              label="SOURCE TYPE"
              placeholder="Select source type"
            />

            <InputField
              label="API ENDPOINT"
              placeholder="https://api.example.com"
            />

            <InputField
              label="UPDATE FREQUENCY"
              placeholder="Every 15 minutes"
            />
          </div>

          <div className="upload-zone">
            <div className="upload-icon">↑</div>

            <strong>
              Drop your dataset here
            </strong>

            <span>
              CSV, XLSX or JSON • Maximum 100 MB
            </span>

            <button className="secondary-button">
              Browse Files
            </button>
          </div>

          <button className="primary-button">
            Validate & Integrate →
          </button>
        </div>

        <div className="panel">
          <PanelHeader
            title="Pipeline Status"
            subtitle="Data processing"
          />

          <PipelineStatus />
        </div>
      </div>
    </>
  );
}


/* =========================================================
   FORECASTING
========================================================= */

function Forecasting() {
  return (
    <>
      <PageTitle
        label="PREDICTIVE INTELLIGENCE"
        title="Forecasting"
        description="AI-powered demand, supply and lead-time forecasting."
      />

      <div className="filter-row">
        <select>
          <option>30 Day Forecast</option>
          <option>60 Day Forecast</option>
          <option>90 Day Forecast</option>
        </select>

        <select>
          <option>All Products</option>
          <option>Product P-101</option>
          <option>Product P-104</option>
        </select>

        <button className="primary-button small">
          Run Forecast
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          title="Forecast Accuracy"
          value="92.3"
          suffix="%"
          status="EXCELLENT"
          icon="◌"
        />

        <StatCard
          title="Expected Demand"
          value="48.2K"
          suffix=" units"
          status="+18.4%"
          icon="↗"
        />

        <StatCard
          title="Avg Lead Time"
          value="5.8"
          suffix=" days"
          status="-0.7 days"
          icon="◷"
        />

        <StatCard
          title="Supply Gap"
          value="6.2"
          suffix="%"
          status="WATCH"
          icon="△"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel large-panel">
          <PanelHeader
            title="Demand Forecast"
            subtitle="Historical vs predicted demand"
          />

          <ForecastChart detailed />
        </div>

        <div className="panel">
          <PanelHeader
            title="Supplier Performance"
            subtitle="Reliability score"
          />

          <SupplierRows />
        </div>
      </div>
    </>
  );
}


/* =========================================================
   RISK MANAGEMENT
========================================================= */

function RiskManagement() {
  return (
    <>
      <PageTitle
        label="RISK INTELLIGENCE"
        title="Risk Management"
        description="Monitor, explain and mitigate supply chain risks."
      />

      <div className="risk-hero">
        <div>
          <span>OVERALL SUPPLY CHAIN RISK</span>

          <div className="risk-number">
            72
            <small>/100</small>
          </div>

          <strong className="risk-high">
            HIGH RISK
          </strong>
        </div>

        <div className="risk-circle">
          <div>
            72%
            <small>Exposure</small>
          </div>
        </div>
      </div>

      <div className="risk-category-grid">
        <RiskCategory
          title="Supplier Risk"
          score="82"
          status="HIGH"
        />

        <RiskCategory
          title="Inventory Risk"
          score="64"
          status="MEDIUM"
        />

        <RiskCategory
          title="Logistics Risk"
          score="71"
          status="HIGH"
        />

        <RiskCategory
          title="Weather Risk"
          score="58"
          status="MEDIUM"
        />
      </div>

      <div className="dashboard-grid">
        <div className="panel large-panel">
          <PanelHeader
            title="Risk Heatmap"
            subtitle="Entities requiring attention"
          />

          <RiskHeatmap />
        </div>

        <div className="panel">
          <PanelHeader
            title="Risk Factors"
            subtitle="Model explanation"
          />

          <RiskFactors />
        </div>
      </div>
    </>
  );
}


/* =========================================================
   SCENARIO
========================================================= */

function ScenarioSimulation() {
  const [running, setRunning] =
    useState(false);

  const runSimulation = () => {
    setRunning(true);

    setTimeout(() => {
      setRunning(false);
    }, 1500);
  };

  return (
    <>
      <PageTitle
        label="PREDICTIVE SIMULATION"
        title="Scenario Simulation"
        description="Test what-if conditions before they impact the supply chain."
      />

      <div className="scenario-grid">
        <div className="panel">
          <PanelHeader
            title="Scenario Parameters"
            subtitle="Modify conditions"
          />

          <ScenarioSlider
            label="Supplier Delay"
            value="7 days"
          />

          <ScenarioSlider
            label="Demand Increase"
            value="+20%"
          />

          <ScenarioSlider
            label="Transport Cost"
            value="+10%"
          />

          <ScenarioSlider
            label="Weather Severity"
            value="Heavy"
          />

          <button
            className="primary-button"
            onClick={runSimulation}
          >
            {running
              ? "Running Simulation..."
              : "Run Scenario →"}
          </button>
        </div>

        <div className="panel">
          <PanelHeader
            title="Predicted Impact"
            subtitle="Simulation result"
          />

          <div className="simulation-result">
            <div>
              <span>RISK SCORE</span>
              <strong>91</strong>
            </div>

            <div>
              <span>INVENTORY GAP</span>
              <strong>18%</strong>
            </div>

            <div>
              <span>LEAD TIME</span>
              <strong>+4.2d</strong>
            </div>
          </div>

          <div className="scenario-recommendation">
            <span>AI RECOMMENDATION</span>

            <strong>
              Increase safety stock and shift 30%
              procurement to Supplier B.
            </strong>
          </div>
        </div>
      </div>
    </>
  );
}


/* =========================================================
   RECOMMENDATIONS
========================================================= */

function Recommendations() {
  return (
    <>
      <PageTitle
        label="DECISION INTELLIGENCE"
        title="AI Recommendations"
        description="Actionable recommendations generated from risk and forecasting models."
      />

      <div className="recommendation-banner">
        <div className="recommendation-ai">
          ✦
        </div>

        <div>
          <span>AI ANALYSIS COMPLETE</span>
          <strong>
            3 high-priority actions detected
          </strong>
        </div>

        <button className="primary-button small">
          Generate New Analysis
        </button>
      </div>

      <div className="recommendation-list">
        <RecommendationCard
          priority="01"
          level="CRITICAL"
          title="Shift procurement from Supplier A to Supplier B"
          reason="Supplier A has an 86% disruption probability due to increasing lead time and poor delivery history."
          impact="31%"
          cost="+4.2%"
        />

        <RecommendationCard
          priority="02"
          level="HIGH"
          title="Increase safety stock for Product P-104"
          reason="Forecasted demand is expected to increase by 25% over the next 30 days."
          impact="24%"
          cost="+2.1%"
        />

        <RecommendationCard
          priority="03"
          level="MEDIUM"
          title="Use alternate transportation route"
          reason="Weather conditions indicate elevated disruption probability on the primary route."
          impact="17%"
          cost="+1.4%"
        />
      </div>
    </>
  );
}


/* =========================================================
   ALERT CENTER
========================================================= */

function AlertCenter() {
  return (
    <>
      <PageTitle
        label="REAL-TIME MONITORING"
        title="Alert Center"
        description="Monitor critical changes and supply chain disruptions."
      />

      <div className="alert-summary">
        <div>
          <strong>12</strong>
          <span>ACTIVE ALERTS</span>
        </div>

        <div className="critical">
          <strong>03</strong>
          <span>CRITICAL</span>
        </div>

        <div>
          <strong>05</strong>
          <span>HIGH</span>
        </div>

        <div>
          <strong>04</strong>
          <span>MEDIUM</span>
        </div>
      </div>

      <div className="panel">
        <PanelHeader
          title="Alert Feed"
          subtitle="Latest events"
        />

        <AlertRows />
      </div>
    </>
  );
}


/* =========================================================
   REPORTS
========================================================= */

function Reports() {
  const [generating, setGenerating] =
    useState(false);

  const generateReport = () => {
    setGenerating(true);

    setTimeout(() => {
      setGenerating(false);
      alert("Report generated successfully.");
    }, 1200);
  };

  return (
    <>
      <PageTitle
        label="ANALYTICS & REPORTING"
        title="Reports"
        description="Generate AI-powered supply chain intelligence reports."
      />

      <div className="report-grid">
        <div className="panel">
          <PanelHeader
            title="Generate Report"
            subtitle="Configure report"
          />

          <div className="report-form">
            <label>
              REPORT TYPE
              <select>
                <option>Supply Chain Risk Report</option>
                <option>Forecast Report</option>
                <option>Supplier Performance Report</option>
                <option>Scenario Report</option>
                <option>Executive Summary</option>
              </select>
            </label>

            <label>
              PERIOD
              <select>
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>Current Month</option>
              </select>
            </label>

            <div className="report-checks">
              <label>
                <input type="checkbox" defaultChecked />
                Risk Analysis
              </label>

              <label>
                <input type="checkbox" defaultChecked />
                Demand Forecast
              </label>

              <label>
                <input type="checkbox" defaultChecked />
                Supplier Performance
              </label>

              <label>
                <input type="checkbox" defaultChecked />
                Recommendations
              </label>

              <label>
                <input type="checkbox" defaultChecked />
                Alerts
              </label>
            </div>

            <button
              className="primary-button"
              onClick={generateReport}
            >
              {generating
                ? "Generating..."
                : "Generate AI Report →"}
            </button>
          </div>
        </div>

        <div className="panel">
          <PanelHeader
            title="Recent Reports"
            subtitle="Generated documents"
          />

          <div className="report-list">
            <ReportItem
              title="Monthly Risk Analysis"
              date="18 Aug 2026"
            />

            <ReportItem
              title="Supplier Performance"
              date="15 Aug 2026"
            />

            <ReportItem
              title="Demand Forecast"
              date="10 Aug 2026"
            />

            <ReportItem
              title="Scenario Analysis"
              date="06 Aug 2026"
            />
          </div>
        </div>
      </div>
    </>
  );
}


/* =========================================================
   REUSABLE COMPONENTS
========================================================= */

function PageTitle({
  label,
  title,
  description,
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="section-label">
          {label}
        </span>

        <h2>{title}</h2>

        <p>{description}</p>
      </div>
    </div>
  );
}


function StatCard({
  title,
  value,
  suffix,
  status,
  icon,
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{title}</span>

        <div className="stat-icon">
          {icon}
        </div>
      </div>

      <div className="stat-value">
        {value}
        <small>{suffix}</small>
      </div>

      <div className="stat-status">
        {status}
      </div>
    </div>
  );
}


function PanelHeader({
  title,
  subtitle,
}) {
  return (
    <div className="panel-header">
      <div>
        <h3>{title}</h3>
        <span>{subtitle}</span>
      </div>

      <button className="more-button">
        ⋯
      </button>
    </div>
  );
}


function ForecastChart({ detailed = false }) {
  return (
    <div className="chart">
      <div className="chart-y">
        <span>100K</span>
        <span>75K</span>
        <span>50K</span>
        <span>25K</span>
        <span>0</span>
      </div>

      <svg
        className="forecast-svg"
        viewBox="0 0 700 250"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id="forecastGradient"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >
            <stop
              offset="0%"
              stopColor="#00e5ff"
              stopOpacity="0.22"
            />

            <stop
              offset="100%"
              stopColor="#00e5ff"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        <path
          d="M0 190
             C40 175 55 150 90 165
             C125 180 135 125 175 135
             C215 145 220 95 260 110
             C300 125 315 70 355 90
             C395 110 420 55 455 75
             C490 95 520 45 550 65
             C590 90 610 35 650 55
             C670 65 690 45 700 40
             L700 250
             L0 250 Z"
          fill="url(#forecastGradient)"
        />

        <path
          d="M0 190
             C40 175 55 150 90 165
             C125 180 135 125 175 135
             C215 145 220 95 260 110
             C300 125 315 70 355 90
             C395 110 420 55 455 75
             C490 95 520 45 550 65
             C590 90 610 35 650 55
             C670 65 690 45 700 40"
          fill="none"
          stroke="#00e5ff"
          strokeWidth="3"
        />
      </svg>

      <div className="chart-x">
        <span>01</span>
        <span>07</span>
        <span>14</span>
        <span>21</span>
        <span>30</span>
      </div>
    </div>
  );
}


function RiskBars() {
  const risks = [
    ["Supplier", 82],
    ["Logistics", 71],
    ["Inventory", 64],
    ["Weather", 58],
    ["Demand", 47],
  ];

  return (
    <div className="risk-bars">
      {risks.map(([name, value]) => (
        <div className="risk-bar-row" key={name}>
          <div>
            <span>{name}</span>
            <strong>{value}</strong>
          </div>

          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: `${value}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}


function MiniAlerts() {
  const alerts = [
    ["CRITICAL", "Supplier A delivery probability dropped"],
    ["HIGH", "Heavy rainfall detected near WH-03"],
    ["MEDIUM", "Demand spike predicted for P-104"],
  ];

  return (
    <div className="mini-alerts">
      {alerts.map(([level, text]) => (
        <div className="mini-alert" key={text}>
          <span className={`alert-level ${level.toLowerCase()}`}>
            {level}
          </span>

          <p>{text}</p>
        </div>
      ))}
    </div>
  );
}


function RecommendationRows() {
  const recommendations = [
    "Shift procurement to Supplier B",
    "Increase safety stock for P-104",
    "Use alternate transportation route",
  ];

  return (
    <div className="recommendation-rows">
      {recommendations.map((item, index) => (
        <div
          className="recommendation-row"
          key={item}
        >
          <span>0{index + 1}</span>
          <strong>{item}</strong>
          <button>View →</button>
        </div>
      ))}
    </div>
  );
}


function InputField({
  label,
  placeholder,
}) {
  return (
    <label className="input-field">
      <span>{label}</span>
      <input placeholder={placeholder} />
    </label>
  );
}


function PipelineStatus() {
  const items = [
    ["Data Validation", "COMPLETE"],
    ["Data Cleaning", "COMPLETE"],
    ["Feature Engineering", "RUNNING"],
    ["Model Pipeline", "READY"],
    ["AI Engine", "ONLINE"],
  ];

  return (
    <div className="pipeline">
      {items.map(([name, status]) => (
        <div className="pipeline-item" key={name}>
          <span className="pipeline-dot" />

          <div>
            <strong>{name}</strong>
            <small>{status}</small>
          </div>
        </div>
      ))}
    </div>
  );
}


function SupplierRows() {
  const suppliers = [
    ["Supplier A", 91],
    ["Supplier B", 87],
    ["Supplier C", 76],
    ["Supplier D", 69],
  ];

  return (
    <div className="supplier-rows">
      {suppliers.map(([name, score]) => (
        <div className="supplier-row" key={name}>
          <div className="supplier-avatar">
            {name.slice(-1)}
          </div>

          <span>{name}</span>

          <strong>{score}%</strong>
        </div>
      ))}
    </div>
  );
}


function RiskCategory({
  title,
  score,
  status,
}) {
  return (
    <div className="risk-category">
      <div>
        <span>{title}</span>
        <strong>{score}</strong>
      </div>

      <small>{status}</small>

      <div className="category-track">
        <div
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}


function RiskHeatmap() {
  const data = [
    ["Supplier A", 91],
    ["Supplier B", 64],
    ["Supplier C", 41],
    ["Warehouse WH-01", 76],
    ["Warehouse WH-02", 53],
    ["Transport Route 01", 71],
  ];

  return (
    <div className="heatmap">
      {data.map(([name, score]) => (
        <div className="heat-row" key={name}>
          <span>{name}</span>

          <div className="heat-track">
            <div
              style={{ width: `${score}%` }}
            />
          </div>

          <strong>{score}</strong>
        </div>
      ))}
    </div>
  );
}


function RiskFactors() {
  const factors = [
    ["Supplier Delay", "+32"],
    ["Historical Delivery", "+24"],
    ["Weather Conditions", "+14"],
    ["Demand Increase", "+10"],
    ["Inventory Level", "+06"],
  ];

  return (
    <div className="risk-factors">
      {factors.map(([name, score]) => (
        <div key={name}>
          <span>{name}</span>
          <strong>{score}</strong>
        </div>
      ))}
    </div>
  );
}


function ScenarioSlider({
  label,
  value,
}) {
  return (
    <div className="scenario-control">
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="fake-slider">
        <span />
      </div>
    </div>
  );
}


function RecommendationCard({
  priority,
  level,
  title,
  reason,
  impact,
  cost,
}) {
  return (
    <div className="recommendation-card">
      <div className="recommendation-priority">
        {priority}
      </div>

      <div className="recommendation-content">
        <span className={`priority-label ${level.toLowerCase()}`}>
          {level}
        </span>

        <h3>{title}</h3>

        <p>{reason}</p>

        <div className="recommendation-metrics">
          <span>
            RISK REDUCTION
            <strong>{impact}</strong>
          </span>

          <span>
            COST IMPACT
            <strong>{cost}</strong>
          </span>
        </div>
      </div>

      <div className="recommendation-actions">
        <button>Accept</button>
        <button>Simulate</button>
        <button>Reject</button>
      </div>
    </div>
  );
}


function AlertRows() {
  const alerts = [
    [
      "CRITICAL",
      "Supplier A delivery probability dropped below threshold",
      "2 min ago",
    ],
    [
      "HIGH",
      "Heavy rainfall predicted near Warehouse WH-03",
      "15 min ago",
    ],
    [
      "MEDIUM",
      "Product P-104 demand expected to increase by 25%",
      "34 min ago",
    ],
    [
      "HIGH",
      "Transportation route disruption detected",
      "51 min ago",
    ],
    [
      "RESOLVED",
      "Supplier B delay risk returned to normal",
      "1 hr ago",
    ],
  ];

  return (
    <div className="alert-rows">
      {alerts.map(([level, text, time]) => (
        <div className="alert-row" key={text}>
          <span
            className={`alert-level ${level.toLowerCase()}`}
          >
            {level}
          </span>

          <div>
            <strong>{text}</strong>
            <small>{time}</small>
          </div>

          <button>View</button>
        </div>
      ))}
    </div>
  );
}


function ReportItem({
  title,
  date,
}) {
  return (
    <div className="report-item">
      <div className="report-icon">
        ▤
      </div>

      <div>
        <strong>{title}</strong>
        <span>{date}</span>
      </div>

      <button>↓</button>
    </div>
  );
}


function App() {
  const [authenticated, setAuthenticated] =
    useState(false);

  if (!authenticated) {
    return (
      <Login
        onLogin={() => setAuthenticated(true)}
      />
    );
  }

  return (
    <Dashboard
      onLogout={() => setAuthenticated(false)}
    />
  );
}

export default App;