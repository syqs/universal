# uAsset Exchange - Backend Component

This project is a production-architected backend component for a novel exchange platform designed to handle the settlement of `uAsset` (wrapped asset) transactions. It demonstrates best practices in API design, asynchronous processing, data integrity, and developer experience within a NestJS framework.

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

## Running Tests

The project includes unit tests for services and controllers. To run the test suite:

```bash
npm test
```