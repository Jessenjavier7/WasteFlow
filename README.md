# Smart Waste Management System

An integrated waste management platform powered by AI-based waste classification to improve waste reporting, monitoring, and management efficiency.

## Overview

Smart Waste Management System is a technology-driven platform designed to simplify waste reporting and improve waste management processes through an integrated website, mobile application, and machine learning service.

The system consists of three main components:

- **Website:** Administrative dashboard for managing waste reports, users, and system statistics.
- **Mobile Application:** Mobile platform for users to submit waste reports with images and location information.
- **Machine Learning Service:** AI-powered image classification service for automatically identifying waste categories.

## Features

### Website

- Role-based authentication (Admin and User).
- Dashboard with waste report statistics.
- Waste report management (CRUD).
- User management.
- Report filtering and searching.
- Report status management (Pending, In Progress, Completed, Rejected).
- Responsive interface.

### Mobile Application

- User registration and login.
- User dashboard.
- Create waste reports with images.
- Automatic waste classification using machine learning.
- View report history.
- Logout functionality.

### Machine Learning Service

- Image-based waste classification.
- REST API powered by FastAPI.
- Prediction results and confidence scores.
- Integration with the mobile application.

## Tech Stack

| Component        | Technology                 |
| ---------------- | -------------------------- |
| Website          | Next.js, React, TypeScript |
| Styling          | Tailwind CSS               |
| Authentication   | NextAuth.js                |
| ORM              | Prisma                     |
| Database         | PostgreSQL                 |
| Mobile           | React Native, Expo         |
| ML Backend       | Python, FastAPI            |
| Machine Learning | TensorFlow                 |
| Version Control  | Git, GitHub                |

## Project Structure

```text
smart-waste-ms/
├── website/
├── mobile/
├── ml-service/
└── README.md
```

## Prerequisites

Before running the project, make sure you have installed:

- Node.js and npm
- Python 3.x
- Git
- PostgreSQL
- Expo Go (for mobile testing)

## Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/Jessenjavier7/WasteFlow
cd smart-waste-ms
```

### 2. Website Setup

```bash
cd website
npm install
```

Configure environment variables using `.env.example`.

Run database migrations:

```bash
npx prisma generate
npx prisma migrate dev
```

Start the development server:

```bash
npm run dev
```

Access the website at `http://localhost:3000`.

### 3. Mobile Setup

```bash
cd mobile
npm install
```

Configure the API URL in the environment variables.

Start Expo:

```bash
npx expo start
```

### 4. ML Service Setup

```bash
cd ml-service
python -m venv venv
```

Activate virtual environment:

**Windows:**

```bash
venv\Scripts\activate
```

**Linux/macOS:**

```bash
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirement.txt
```

Start FastAPI:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Access API documentation at `http://localhost:8000/docs`.

## Environment Variables

Each component requires its own environment configuration.

Refer to the `.env.example` files in the respective directories.

Never commit actual credentials or secret keys to the repository.

## API Documentation

The ML service provides REST API endpoints for waste image classification.

FastAPI Swagger documentation:

`http://localhost:8000/docs`

## Screenshots

Add application screenshots in `docs/screenshots/`.

## Future Improvements

- Real-time waste collection monitoring.
- Advanced waste analytics.
- Improved machine learning classification accuracy.
- Integration with waste collection services.
- Deployment to cloud infrastructure.

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a new feature branch.
3. Commit your changes.
4. Push the branch.
5. Open a Pull Request.
