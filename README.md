
# uAsset Exchange - Backend Component

This project is a production-architected backend component for a novel exchange platform designed to handle the settlement of `uAsset` (wrapped asset) transactions. It demonstrates best practices in API design, asynchronous processing, data integrity, and developer experience within a NestJS framework.

## Core Features

-   **RESTful API:** A fully documented Swagger API for creating and querying trades and assets.
-   **Asynchronous Trade Settlement:** Utilizes a **Bull message queue** with Redis to handle long-running settlement processes, ensuring the API remains fast and responsive.
-   **Dynamic uAsset Registry:** A dedicated module acts as a single source of truth for all supported assets. It validates trades against this registry, ensuring data integrity.
-   **High-Precision Decimal Handling:** Uses `decimal.js` and a custom TypeORM transformer to handle all monetary values, preventing common floating-point precision errors.
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

### 2. Installation

Clone the repository and install the project dependencies.

```bash
# Clone the repository (if you haven't already)
# git clone ...

# Navigate into the project directory
cd u-asset-exchange

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

A production-ready system must be observable. This project includes foundational elements for this:

-   **Structured Logging:** The `LoggingInterceptor` attaches a unique trace ID to every incoming request, making it easy to follow the entire lifecycle of an API call through the logs.
-   **Health Checks:** A production system would add a `/health` endpoint (e.g., using `@nestjs/terminus`) to report the status of the database and other critical connections.
-   **Metrics:** A `/metrics` endpoint could be added using a library like `prom-client` to expose application-level metrics (e.g., number of trades processed, queue size) in a Prometheus-compatible format.

## Running Tests

The project includes unit tests for services and controllers. To run the test suite:

```bash
npm test
```