# 🚀 NextGen Social Chat Platform

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=flat&logo=docker&logoColor=white)
![NestJS](https://img.shields.io/badge/nestjs-%23E0234E.svg?style=flat&logo=nestjs&logoColor=white)
![Next JS](https://img.shields.io/badge/Next-black?style=flat&logo=next.js&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-%234ea94b.svg?style=flat&logo=mongodb&logoColor=white)
![Kafka](https://img.shields.io/badge/Apache_Kafka-231F20?style=flat&logo=apache-kafka&logoColor=white)
![RabbitMQ](https://img.shields.io/badge/RabbitMQ-FF6600?style=flat&logo=rabbitmq&logoColor=white)

## 📖 Introduction

**NextGen Social Chat Platform** is a cutting-edge, scalable social networking solution designed to bridge the gap between real-time communication and personalized content discovery. Built upon a robust **Event-Driven Microservices Architecture**, this platform ensures high availability, seamless user experience, and intelligent content curation.

Unlike traditional monolithic applications, this project leverages the power of **Kafka** for high-throughput event streaming and **RabbitMQ** for reliable asynchronous task processing, ensuring that heavy operations (like notification aggregation or feed generation) never block the user interface. Furthermore, it integrates a dedicated **AI Engine** to analyze user behavior and provide hyper-personalized content recommendations using Vector Embeddings.

---

## 🌟 Key Features

### 1. 🔐 Advanced Authentication & Security
- **Multi-method Login:** Support for local credentials, Google OAuth2, and social logins.
- **Security:** High-standard password encryption (Argon2/Bcrypt), JWT-based stateless authentication (Access/Refresh Tokens).
- **Identity Management:** Integrated with **Firebase Admin SDK** for secure user verification.
- **Password Recovery:** Secure "Forgot Password" flow with OTP via **Brevo (Sendinblue)**.

### 2. 📡 Real-Time Communication Ecosystem
- **Instant Messaging:** Powered by **Socket.io**, enabling sub-millisecond message delivery.
- **Smart Chat Features:**
  - One-on-one private messaging.
  - Group chats with admin controls.
  - Real-time typing indicators and online status.
  - "Ghost Mode" (Hidden conversations) & Mute functionality.
- **Live Notifications:** Real-time alerts for likes, comments, shares, and messages, pushed instantly to the client.

### 3. 📱 Dynamic Social Feed
- **Rich Media Support:** Upload and share high-quality images and videos (powered by **Cloudinary**).
- **Interactions:** React (Love, Haha, Sad, etc.), Comment, and Share posts in real-time.
- **News Feed Algorithm:** A hybrid algorithm that combines chronological sorting with AI-based relevance scoring.

### 4. 🧠 AI-Driven Experience (Artificial Intelligence)
- **Content Recommendation Engine:** A dedicated Python Microservice using **Vector Database** logic to recommend "Reels" and posts based on user interaction history.
- **Smart Filtering:** Automatic content categorization and filtering based on media types and user preferences.
- **Real-time Learning:** The system learns from every `view`, `like`, and `share` to refine user vectors instantly via Kafka streams.

### 5. 🔔 Intelligent Notification System
- **Notification Aggregation:** Uses **RabbitMQ** to batch high-volume notifications (e.g., "10 people liked your post") to prevent spamming the user.
- **Cross-Platform Delivery:** Architecture ready for Push Notifications (FCM).

### 6. 💳 Payment & Premium Features
- **Payment Gateway:** seamless integration with **VNPay** for processing secure transactions.
- **Membership:** Premium features unlocking themes, badges, and advanced analytics.

### 7. 🛠 Admin & Analytics Dashboard
- **Comprehensive Monitoring:** View real-time server statistics, active users, and system health.
- **User Management:** Ban, restrict, or manage user roles.
- **Theming System:** Dynamic theme switching (Dark/Light/Custom Palettes) controlled centrally.

---

## 🏗 System Architecture

The project follows a **Microservices-oriented architecture**, containerized with Docker for consistency across development and production environments.

### Component Breakdown:

1.  **Frontend (Client):**
    -   Built with **Next.js 14+ (App Router)** for SEO optimization and server-side rendering.
    -   State management via **Zustand**.
    -   UI/UX designed with **TailwindCSS** and **MUI** for a premium aesthetic.

2.  **API Gateway / Main Backend:**
    -   **NestJS** application acting as the primary entry point.
    -   Handles HTTP requests, WebSocket (Gateway), and Auth.
    -   Producers events to Kafka/RabbitMQ.

3.  **Kafka Service (Event Streaming):**
    -   **NestJS Microservice** listening to **Apache Kafka**.
    -   Handles "Fire-and-Forget" events: Feed generation, Post analytics, User Activity Tracking.
    -   Ensures data consistency across services without tight coupling.

4.  **Worker Service (Task Queue):**
    -   **NestJS Microservice** listening to **RabbitMQ**.
    -   Handles "Reliable" tasks: Sending emails, aggregating notifications, background image processing.

5.  **AI Server:**
    -   **Python** Service (FastAPI/Flask).
    -   Computes embeddings, manages Vector Search, and serves recommendations.

6.  **Data Persistence:**
    -   **MongoDB:** Primary NoSQL database for flexible data modeling (Users, Posts, Chats).
    -   **Redis:** In-memory caching layer for sessions, feed caching, and rate limiting.
    -   **Zookeeper:** Distributes synchronization for Kafka brokers.

---

## 💻 Technolgoy Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | Next.js, React, TypeScript, TailwindCSS, Zustand, Socket.io-client, Axios, Framer Motion |
| **Backend** | NestJS, TypeScript, RxJS, Socket.io, Firebase Admin, Mongoose |
| **Microservices** | Apache Kafka, RabbitMQ, gRPC (internal comms) |
| **AI / Data** | Python, NumPy, Pandas, Vector DB |
| **Database** | MongoDB Atlas, Redis |
| **DevOps** | Docker, Docker Compose, Git |
| **Third-Party** | Cloudinary (Media), VNPay (Payment), Brevo (Email), Google OAuth |

---

## ⚙️ Installation & Setup

### Prerequisites
- Docker Desktop (Running)
- Node.js (v18+)
- Python (v3.10+)

### Quick Start (Docker)

This is the recommended way to run the entire infrastructure ensuring all microservices are connected.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/YourUsername/Project-Chat-Social.git
    cd Project-Chat-Social
    ```

2.  **Configure Environment:**
    Ensure `.env` files are configured in `backend/`, `frontend/`, `kafka-server/`, and `rabbitmq/`.

3.  **Launch via Docker Compose:**
    ```bash
    docker-compose up -d --build
    ```
    *This command initializes MongoDB, Redis, Zookeeper, Kafka, RabbitMQ, and all application services.*

4.  **Access the Application:**
    -   **Frontend:** `http://localhost:3000`
    -   **Backend API:** `http://localhost:8080`
    -   **Kafka UI:** `http://localhost:8090`
    -   **RabbitMQ UI:** `http://localhost:15672` (User: `user`, Pass: `123123123`)

---

## 🔮 Future Roadmap

- [ ] **Mobile Application:** Native iOS and Android apps using React Native.
- [ ] **Voice/Video Calls:** WebRTC implementation for direct calling.
- [ ] **Stories:** 24h ephemeral content.
- [ ] **Marketplace:** Peer-to-peer trading platform integration.
- [ ] **Blockchain:** NFT integration for premium profile avatars.

---

## 🤝 Contribution

Contributions are what make the open-source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

1.  Fork the Project
2.  Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3.  Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4.  Push to the Branch (`git push origin feature/AmazingFeature`)
5.  Open a Pull Request

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  Built with ❤️ by <b>Arisu</b>
</p>
