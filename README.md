# AI Pana (एआई पाना)

A bilingual AI-powered information and news platform built with React, Node.js, Express, and SQLite.

AI Pana provides a Nepali and English interface, light and dark themes, and an administrative panel for content management.

## Features

- **Bilingual interface:** Nepali (ने) and English (EN).
- **Responsive frontend:** React 18 with Vite.
- **Backend API:** Node.js and Express.js.
- **Database:** SQLite using better-sqlite3.
- **Authentication:** JWT-based authentication.
- **Admin panel:** Dedicated administration interface at `/admin`.
- **Theme support:** Light and dark modes.
- **File handling:** Image and file uploads using Multer.
- **Production deployment:** Express serves the built React application and API from a single server.

## Technology Stack

| Component | Technologies |
|---|---|
| Frontend | React 18, Vite 5 |
| Routing | React Router |
| Backend | Node.js, Express.js |
| Database | SQLite, better-sqlite3 |
| Authentication | JSON Web Tokens (JWT) |
| File uploads | Multer |
| Configuration | dotenv |

## Project Structure

```text
ai_info_news_articles/
├── client/                 # React frontend
│   ├── src/
│   ├── public/
│   └── package.json
│
├── server/                 # Express backend
│   ├── data/               # SQLite database and uploaded files
│   ├── index.js            # Backend entry point
│   ├── seed.js             # Database seeding
│   ├── .env.example        # Environment template
│   └── package.json
│
├── .gitignore
├── package.json            # Root project configuration
└── README.md
```

## Prerequisites

Install the following before running the application:

- Node.js (preferably an active LTS release)
- npm
- Git

## Installation and Local Development

### 1. Clone the repository

```bash
git clone https://github.com/ShyamBhe/ai_info_news_articles.git

cd ai_info_news_articles
```

### 2. Install dependencies

```bash
npm run install:all
```

### 3. Configure environment variables

Create the server environment file:

```bash
cp server/.env.example server/.env
```

Edit `server/.env` and configure the required environment variables, including:

- `ADMIN_PASSWORD`
- `JWT_SECRET`

Use a strong, unique password and a securely generated JWT secret. Never commit your actual `.env` file.

### 4. Start the backend

Open Terminal 1:

```bash
npm run dev:server
```

Backend:

http://localhost:4000

### 5. Start the frontend

Open Terminal 2:

```bash
npm run dev:client
```

Frontend:

http://localhost:5173

## Production Build and Deployment

AI Pana supports a single-server production deployment where Express serves both the backend API and the compiled React frontend.

### 1. Install dependencies

```bash
npm run install:all
```

### 2. Build the frontend

```bash
npm run build
```

### 3. Start the production server

```bash
NODE_ENV=production npm start
```

The application serves the frontend and API through the configured server port (`PORT`).

## Database and File Storage

Application data is stored under:

```text
server/data/
```

This directory contains the SQLite database and uploaded images.

**Important deployment considerations:**

- Use persistent storage for the database and uploaded files.
- Back up the SQLite database regularly.
- Protect uploaded files and user data.
- Do not expose environment files or authentication secrets.
- Ensure the production server has appropriate read/write permissions.

## Admin Panel

The administrative interface is available at:

```text
/admin
```

Administrative access requires the configured credentials and authentication mechanism.

## Security

- Keep environment variables and secrets out of version control.
- Use strong administrative credentials.
- Generate a secure JWT secret.
- Validate uploaded files and user input.
- Use HTTPS in production.
- Back up application data regularly.

## License

This project is maintained by Shyam Bhetuwal. All rights reserved unless otherwise specified.

## Author

**Shyam Bhetuwal**

GitHub: https://github.com/ShyamBhe

Repository: https://github.com/ShyamBhe/ai_info_news_articles