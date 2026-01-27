# RabbitMQ Notification Migration Guide

## Overview

This guide details the migration of the notification system from a direct synchronous model to an asynchronous, event-driven architecture using RabbitMQ. This change improves scalability and decouples notification generation from delivery.

## Architecture

The new system consists of the following components:

1.  **Backend Service (Producer & Consumer)**:
    -   **Producer**: Emits `notification.created` events to RabbitMQ whenever a user performs an action (like, comment, share, friend request).
    -   **Consumer**: Listens for `notification.send` events from the RabbitMQ service to broadcast real-time updates via WebSocket (Socket.IO).

2.  **RabbitMQ Microservice (Processor)**:
    -   **Consumer**: Listens for `notification.created` events.
    -   **Aggregation Worker**: Groups similar notifications (e.g., multiple likes on the same post) into a single `PendingNotification` within a time window.
    -   **Sender Worker**: Processes `PendingNotification`s, creates final `Notification` records in MongoDB, and emits `notification.send` events back to the Backend.

## Key Changes

### Backend Service (`/backend`)

-   **`NotificationEmitterService`**: New service to emit events. Replaces direct calls to `NotificationService.create`.
-   **`RabbitMQEventsController`**: New controller to handle incoming events from RabbitMQ and trigger Socket.IO broadcasts.
-   **Services Updated**: `PostService`, `CommentService`, `ReactionService`, `GroupService`, `RelationshipService` now use `NotificationEmitterService`.

### RabbitMQ Service (`/rabbitmq`)

-   **`NotificationAggregationService`**: Handles event intake and aggregation logic.
-   **`NotificationSenderService`**: Handles final notification creation and dispatching back to Backend.
-   **Schemas**: Uses `Notification`, `PendingNotification` schemas (mirrored from backend).

## Setup Instructions

### Prerequisites

-   RabbitMQ Server running (locally or cloud).
-   MongoDB running.

### Environment Variables

Ensure the following variables are set in your `.env` files for both **backend** and **rabbitmq** services:

```env
RABBITMQ_URL=amqp://localhost:5672  # Or your RabbitMQ URL
RABBITMQ_QUEUE_NAME=notification_queue
MONGODB_URI=mongodb://localhost:27017/your_db_name
```

### Running the Services

1.  **Start RabbitMQ Service**:
    ```bash
    cd rabbitmq
    npm install
    npm run start:dev
    ```

2.  **Start Backend Service**:
    ```bash
    cd backend
    npm install
    npm run start:dev
    ```

## Verification

To verify the system is working:

1.  Trigger an action (e.g., react to a post).
2.  Check RabbitMQ logs: You should see "Received notification event".
3.  Wait for the aggregation window (default 5-30 seconds).
4.  Check RabbitMQ logs: You should see "Sent notification to user...".
5.  Check Client (Frontend): The user should receive a real-time notification via Socket.IO.

## Troubleshooting

-   **No Notification Received**:
    -   Check if RabbitMQ is running and reachable.
    -   Check if the `notification_queue` and `backend_queue` exists in RabbitMQ management interface.
    -   Check logs in both `backend` and `rabbitmq` terminals for any connection errors.

