🧠 Self-Healing Distributed System (Local, Zero-Cost)

A locally runnable, zero-cost, explainable self-healing distributed system that autonomously detects failures, diagnoses root causes, and recovers under chaos testing — without Kubernetes or cloud services.

This project focuses on understanding and implementing the intelligence behind self-healing, not outsourcing it to platforms.

⸻

🚀 What This Project Does
	•	Runs multiple microservices locally using Docker
	•	Continuously monitors health and performance metrics
	•	Detects anomalies and failures using statistical methods
	•	Automatically heals the system by restarting, rerouting, or scaling services
	•	Logs why each healing decision was made (explainability)
	•	Validates resilience using chaos engineering

⸻

❌ What This Project Does NOT Use
	•	Kubernetes
	•	Cloud providers (AWS/GCP/Azure)
	•	Paid APIs
	•	Prometheus / Grafana
	•	Black-box ML models

Everything runs offline, locally.

⸻

🧱 System Architecture

┌──────────────┐
│ Chaos Engine │  ← Injects failures
└──────┬───────┘
       ↓
┌──────────────┐
│ Microservices│  ← Fault-prone services
└──────┬───────┘
       ↓ metrics
┌──────────────┐
│ Monitor      │  ← Health + metrics collector
└──────┬───────┘
       ↓ anomalies
┌──────────────┐
│ Healer       │  ← Decision engine
└──────┬───────┘
       ↓ explanation
┌──────────────┐
│ Explain Logs │  ← Why healing happened
└──────────────┘


⸻

🧠 Core Concepts Implemented
	•	Distributed systems monitoring
	•	Anomaly detection (EWMA, Z-score)
	•	Rule-based decision engines
	•	Chaos engineering
	•	Explainable system behavior
	•	Fault tolerance & recovery metrics

⸻

🛠️ Tech Stack

Layer	Technology
Language	Node.js + TypeScript
Services	Express.js
Containers	Docker, Docker Compose
Monitoring	Custom metrics collector
Anomaly Detection	EWMA + statistical thresholds
Healing Engine	Rule-based controller
Routing	NGINX / custom proxy
Chaos Testing	Bash + Node scripts
Logging	Structured JSON logs
Dashboard (optional)	React


⸻

📂 Project Structure

self-healing-system/
├── services/
│   ├── service-a/
│   ├── service-b/
│   └── service-c/
├── monitor/
│   ├── metrics-collector.ts
│   └── anomaly-detector.ts
├── healer/
│   ├── decision-engine.ts
│   └── actions.ts
├── router/
│   └── routing-config.json
├── chaos/
│   └── inject-failures.sh
├── logs/
│   └── healing-log.json
├── docker-compose.yml
└── README.md


⸻

🔍 Metrics Collected
	•	Average latency (P50, P95)
	•	Error rate (%)
	•	Uptime
	•	Memory usage (via Docker stats)
	•	Request rate

⸻

🧠 Anomaly Detection

The system maintains rolling baselines and flags anomalies using:
	•	EWMA (Exponentially Weighted Moving Average)
	•	Z-score thresholding

Example:

IF latency > mean + 2 × std
→ latency anomaly detected

Anomalies are translated into human-readable symptoms.

⸻

🩺 Healing Actions

Depending on detected anomalies, the system can:
	•	Restart unhealthy containers
	•	Remove instances from routing
	•	Spin up additional replicas
	•	Update routing configuration dynamically

All actions are deterministic and explainable.

⸻

🧾 Explainability Logs

Every healing action produces a structured log:

{
  "time": "12:41:02",
  "service": "service-a",
  "symptoms": ["latency spike", "error burst"],
  "root_cause": "memory exhaustion",
  "action": "restart + scale",
  "confidence": 0.87
}

This is the core differentiator of the project.

⸻

🧪 Chaos Engineering

Failures are injected intentionally:
	•	Kill containers
	•	Throttle memory or CPU
	•	Add artificial latency

Example:

docker kill service-b
docker update --memory 128m service-a

The system must detect, heal, and explain each failure.

⸻

📈 Evaluation Metrics
	•	MTTD — Mean Time To Detect
	•	MTTR — Mean Time To Recover
	•	Failure recovery success rate

These metrics validate system resilience.

⸻

▶️ How to Run

docker-compose up --build

To inject failures:

bash chaos/inject-failures.sh

Logs are written to:

logs/healing-log.json


⸻

🏆 Resume Highlights
	•	Designed a self-healing distributed system that autonomously detects, diagnoses, and recovers from failures.
	•	Implemented statistical anomaly detection without external monitoring tools.
	•	Built an explainable healing engine with root-cause reasoning.
	•	Validated resilience using chaos engineering.

⸻

📌 Design Philosophy

“Self-healing is not restarting containers — it is understanding why systems fail and responding intelligently.”

This project exposes the thinking layer behind modern distributed systems.

⸻

📜 License

MIT