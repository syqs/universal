# uAsset Exchange - Backend Component

## Table of Contents
- [A Vision for a Self-Custodial CEX](#a-vision-for-a-self-custodial-cex)
- [Core Features](#core-features)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [API Documentation](#api-documentation)
- [Monitoring & Observability](#monitoring--observability)
- [Future Architectural Directions](#future-architectural-directions) 
     - Hybrid Order Book with Batched On-Chain Settlement
     - Verifiable Off-Chain Exchange using Zero-Knowledge Proofs
- [Running Tests](#running-tests)

This project is a production-architected backend component for a novel exchange platform designed to handle the settlement of `uAsset` (wrapped asset) transactions. It demonstrates best practices in API design, asynchronous processing, data integrity, and developer experience within a NestJS framework.

## A Vision for a Self-Custodial CEX
This project directly addresses the mission to bridge the gap between a Centralized (CEX) and Decentralized (DEX) exchange. It does so by implementing a novel "Self-Custodial CEX" model.
The core innovation is a delegated authentication system that provides a CEX-like user experience without sacrificing the fundamental security of self-custody.

### The User Flow:
A user authenticates once by signing a message with their main wallet (e.g., MetaMask).
This action securely delegates trading authority to a temporary, short-lived session key managed by our backend.
The user can then trade instantly and frequently without needing to sign every single transaction, just like on a CEX.
All the while, their main assets remain in their own smart contract, fully under their control. The session key has no permission to withdraw funds, providing a trustless "escape hatch."
This architecture, detailed below, delivers the speed and low friction of a centralized platform while upholding the decentralized principle of user-owned assets.

## Core Features

-   **RESTful API:** A fully documented Swagger API for creating and querying trades and assets.
-   **Asynchronous Trade Settlement:** Utilizes a **Bull message queue** with Redis to handle long-running settlement processes, ensuring the API remains fast and responsive.
-   **Dynamic uAsset Registry:** A dedicated module acts as a single source of truth for all supported assets. It validates trades against this registry, ensuring data integrity.
-   **High-Precision Decimal Handling:** Uses `decimal.js` and a custom TypeORM transformer to handle all monetary values, preventing common floating-point precision errors.
-   **Validated Configuration Management:** Uses `@nestjs/config` and `Joi` to manage and validate environment variables, ensuring safe and flexible deployment across multiple environments.
-   **Database Persistence:** Uses **TypeORM** with **SQLite** for lightweight, file-based persistence that is easily managed with Docker volumes.
-   **Production-Ready Architecture:** The design incorporates concepts like transactional database operations with pessimistic locking to prevent race conditions and a clear separation of concerns between services.

## Architecture Overview

This backend is designed with a microservice-oriented mindset, even though it is presented as a single application.

#### 1. Asynchronous Processing (BullMQ)

Blockchain operations are slow. To prevent API timeouts and ensure reliability, the settlement process is handled asynchronously.

-   When a `POST /trades/settle` request is received, the controller validates the request and queues a `settle-trade` job in Bull.
-   An `Accepted (202)` response is immediately returned to the client.
-   A separate `SettlementProcessor` class listens for jobs on the queue and executes the long-running settlement logic in the background, including interactions with the database and simulated blockchain services.

#### 2. Database & Persistence (TypeORM + SQLite)

-   **TypeORM** is used as the Object-Relational Mapper to interact with the database in a type-safe way.
-   **SQLite** is chosen as the database engine for its simplicity and serverless nature, making it perfect for this task. The entire database is contained in a single `db.sqlite` file.
-   For deployment, this file can be persisted outside the Docker container using a volume mount.

#### 3. The uAsset Registry

A novel exchange must have a definitive source of truth for the assets it supports.
-   The `AssetRegistryModule` manages a database table of supported `uAssets`.
-   On application startup, the `onApplicationBootstrap` lifecycle hook triggers a **seeding process** to populate the database with a default list of assets (e.g., uBTC, uUSD). This guarantees that the asset data is available before the application starts accepting traffic.
-   Before any trade is created, the `TradeSettlementService` validates the trade's assets against the registry to ensure they exist, are active, and are tradable.

## Getting Started

Follow these instructions to get the application running on your local machine.

### Prerequisites

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   [npm](https://www.npmjs.com/)
-   [Docker](https://www.docker.com/) (to run the Redis instance)

### 1. Run Redis for the Queue

The Bull message queue requires a Redis server. The easiest way to run one is with Docker.

```bash
docker run -d -p 6379:6379 --name u-asset-redis redis:latest
```
*This command starts a Redis container in detached mode (`-d`), maps the port (`-p`), and gives it a convenient name.*

### 2. Installation & Configuration

Clone the repository, create a local configuration file, and install the project dependencies.

```bash
# Clone the repository
# git clone ...

# Navigate into the project directory
cd u-asset-exchange

# Create a .env file from the example
cp .env.example .env

# Install dependencies
npm install
```

### 3. Running the Application

Once Redis is running and dependencies are installed, you can start the NestJS application.

```bash
# Run in development mode (with hot-reloading)
npm run start:dev
```
The application will start, connect to the Redis queue, seed the SQLite database, and begin listening on `http://localhost:3000`.

## API Documentation

Once the application is running, an interactive Swagger UI is available at:

**http://localhost:3000/api**

This UI allows you to explore all available endpoints, view schemas for requests and responses, and execute API calls directly from your browser.

## Monitoring & Observability

A production-ready system must be observable. This project is built with observability in mind and can be fully instrumented using a standard, modern stack.

### Approach to Instrumentation

Our approach is based on the **three pillars of observability**: Logs, Metrics, and Traces.

#### 1. Logs: What Happened?

-   **Current Implementation:** The `LoggingInterceptor` attaches a unique `traceId` to every incoming request and logs the start and end of each request, including its duration. This allows us to trace the journey of a single API call through the system.
-   **Production Strategy:** We would configure a logger like **Pino** to output structured, JSON-formatted logs. These JSON logs would be shipped by an agent (e.g., Fluentd, Vector) to a centralized logging platform like **Datadog**, **Grafana Loki**, or the **ELK Stack (Elasticsearch, Logstash, Kibana)**. This enables powerful searching, filtering, and alerting based on log content (e.g., "alert if `error.level` logs exceed 10 per minute").

#### 2. Metrics: How is the System Behaving?

-   **Current Implementation:** The foundational structure is in place to expose metrics.
-   **Production Strategy:** We would implement a `/metrics` endpoint using a library like `prom-client`. This endpoint would expose key application metrics in a **Prometheus**-compatible format, including:
    -   **Application Metrics (RED Method):** Rate (requests/sec), Errors (error rate), Duration (request latency histograms).
    -   **Queue Metrics:** The number of jobs in the Bull queue (waiting, active, failed). This is a critical indicator of system health and backpressure.
    -   **Business Metrics:** Number of trades created, number of settlements processed, total volume traded.
    -   A Prometheus server would scrape this endpoint periodically, and **Grafana** would be used to build dashboards for visualization and alerting (e.g., "alert if queue size > 1000 for 5 minutes").

#### 3. Tracing: Where Did it Go Wrong?

-   **Current Implementation:** The `traceId` in our logs provides a basic form of tracing.
-   **Production Strategy:** For a comprehensive view, especially in a microservices environment, we would integrate **OpenTelemetry (OTel)**.
    -   An OTel SDK would be configured within the application.
    -   The `LoggingInterceptor` would be enhanced to create a "span" for each request, propagating the `traceId` and `spanId` across service calls (including messages sent via the Bull queue).
    -   These traces would be exported to a tracing backend like **Jaeger** or **Datadog APM**. This would allow us to visualize the entire lifecycle of a request as a flame graph, instantly identifying which part of the process is slow or failing—whether it's an API call, a database query, or a job sitting in the queue.

This multi-faceted approach ensures that we can not only detect when a problem occurs but also have the rich, contextual data needed to rapidly troubleshoot and resolve it, from high-level system performance down to a single user's request.

## Future Architectural Directions

The current application provides a robust foundation for a next-generation exchange. The following features represent the next steps to fully bridge the gap between CEX and DEX platforms, building directly upon the architecture already in place.

### 1. Hybrid Order Book with Batched On-Chain Settlement

To deliver CEX-level speed and drastically reduce user costs, the next evolution is to move from settling every trade on-chain to a net settlement model.

-   **Concept:** Users would trade instantly and without gas fees on the high-performance off-chain order book we have built. On-chain transactions would only occur when a user deposits or withdraws funds, or at the end of a predefined "epoch" (e.g., every hour). At that point, the system calculates the net debit/credit for each user and executes a single, optimized on-chain transaction to settle all activity in the batch.

-   **Benefit:** This model enables a trading experience with the speed and zero-friction feel of a centralized exchange while reducing a user's gas costs by orders of magnitude. A user could perform thousands of trades and only pay for gas on their final withdrawal.

-   **Path Forward:** The existing `Trade` entity already serves as the perfect off-chain ledger. The `SettlementProcessor` would be adapted to handle batch processing of net balances, triggered by withdrawal requests or scheduled epoch-end events.

### 2. Verifiable Off-Chain Exchange using Zero-Knowledge Proofs

To solve the trust problem inherent in any off-chain system, the platform can be enhanced with cutting-edge cryptography to make its operations mathematically verifiable.

-   **Concept:** The exchange's backend would periodically generate a **Zero-Knowledge Proof** (specifically, a ZK-SNARK or ZK-STARK). This is a small piece of cryptographic data that proves the integrity of every single off-chain trade executed during an epoch, without revealing any private details. This proof is then posted on-chain for public verification.

-   **Benefit:** This provides the **ultimate guarantee of fairness**. Users no longer need to trust the exchange operator. They can be cryptographically certain that the platform is not faking volume, mismanaging funds, or censoring trades. This achieves the trustless security of a DEX with the performance of a CEX, similar to how modern ZK-Rollups operate.

## Running Tests

The project includes unit tests for services and controllers. To run the test suite:

```bash
npm test
```

# **Conclusion:**

### The Building Blocks: What is NOT Novel (The "Shoulders of Giants")

The individual components used are well-established and battle-tested, which is a *good thing* for security and reliability.

1.  **Smart Contract Vaults:** The concept of a user depositing assets into a personal smart contract that they ultimately control is a foundational pattern in DeFi. Protocols like MakerDAO, Compound, and Gnosis Safe are all built on this idea of user-owned on-chain vaults.
2.  **Delegated Keys:** The idea of a primary "owner key" delegating limited permissions to a secondary "session key" is a known pattern. The most prominent example is **dYdX (v3)**, which uses a system where users sign to generate a `starkKey` to interact with their off-chain system. Wallets like Argent also use concepts of guardian keys.
3.  **Session Tokens (JWTs):** This is the bedrock of modern Web2 authentication. Using a Bearer Token to manage a temporary, authenticated session is standard practice.

### The Synthesis: What IS Novel

The true innovation here is in the **combination and the architectural philosophy**. Which can create a unique point on the CEX/DEX spectrum.

1.  **The Goal-Oriented Design:** Most hybrid exchanges start from a complex cryptographic primitive (like StarkEx) and build a UX around it. Here we start from the user experience goal—**"make it feel exactly like a CEX login"**—and use the simplest, most robust components to achieve it. The use of a standard JWT flow makes it instantly understandable to any web developer, drastically lowering the barrier to entry for building on this system.

2.  **The "Web2.5" Authentication Bridge:** The model creates a seamless bridge between a Web3 wallet (the source of truth for ownership) and a Web2-style session (the source of truth for temporary activity). The `delegate/confirm` endpoint is the exact moment this bridge is crossed. This is a much simpler and more accessible pattern than the complex Layer 2 onboarding flows seen elsewhere.

3.  **The Clarity of the Security Model:** The security guarantee is incredibly simple to explain to a user:
    > "Your funds are in your vault. To trade, you give our server a temporary 'valet key' that can place trades but **cannot drive your car off the lot.** You can revoke this key at any time from your main wallet."

    This is a powerful and easy-to-understand model that builds trust, whereas explaining the intricacies of ZK-Rollups can be difficult.

The model is **novel** not because it invents a new form of cryptography, but because it creates a **novel architectural pattern** that achieves a specific, highly-desirable user experience. It finds a new and valuable "sweet spot" on the spectrum by consciously blending the best of Web2 session management with the best of Web3 self-custody.

It shows that you don't always need a brand-new cryptographic primitive to innovate. Sometimes, the most powerful innovation comes from using existing tools in a new and elegant way to solve a real human problem.