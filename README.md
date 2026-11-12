# Chat Backend API

A NestJS chat backend using PostgreSQL (Prisma), Firebase Firestore, Passport JWT, and Swagger.

## Features

- User registration and login with bcrypt password hashing
- JWT authentication with protected chat routes
- Direct chat creation with duplicate prevention through a canonical direct key
- Message creation and retrieval from Firestore
- Read receipts and last-seen tracking in Firestore
- Prisma-based chat membership and user persistence
- Validation, global error handling, and Swagger docs

## Project structure

```text
src/
├── app.module.ts
├── app.controller.ts
├── app.service.ts
├── main.ts
├── config/
│   └── env.validation.ts
├── prisma/
│   ├── prisma.module.ts
│   └── prisma.service.ts
├── firebase/
│   ├── firebase.module.ts
│   └── firebase.service.ts
├── common/
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   └── public.decorator.ts
│   ├── filters/
│   │   └── global-exception.filter.ts
│   └── guards/
│       └── jwt-auth.guard.ts
├── auth/
│   ├── auth.controller.ts
│   ├── auth.module.ts
│   ├── auth.service.ts
│   ├── jwt.strategy.ts
│   └── dto/
├── users/
│   ├── users.module.ts
│   └── users.service.ts
├── chats/
│   ├── chats.controller.ts
│   ├── chats.module.ts
│   ├── chats.service.ts
│   └── dto/
├── messages/
│   ├── messages.controller.ts
│   ├── messages.module.ts
│   └── messages.service.ts
├── read-receipts/
│   ├── read-receipts.module.ts
│   └── read-receipts.service.ts
└── ...
```

## Environment setup

1. Copy `.env.example` to `.env`.
2. Configure PostgreSQL connection and Firebase credentials.
3. Fill in Firebase values in `.env`:

```bash
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/chat_db
JWT_SECRET=change_this_secret
JWT_EXPIRES_IN=1d
BCRYPT_ROUNDS=10
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
MAX_MESSAGE_LENGTH=5000
```

## PostgreSQL setup

Ensure a PostgreSQL server is running locally and the `chat_db` database is created. For a default local PostgreSQL install, the connection string usually looks like:

```bash
postgresql://postgres:postgres@localhost:5432/chat_db
```

If your local install uses a different username/password, update `DATABASE_URL` to match it.

Then sync the Prisma schema without migrations:

```bash
npx prisma db push
npx prisma generate
```

## Firebase setup

Create a Firebase Project and a service account with Firestore access. Use the generated JSON credentials to fill `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, and `FIREBASE_PRIVATE_KEY` in `.env`.

## Run locally

```bash
npm install
npm run start
```

For development watch mode:

```bash
npm run start:dev
```

Swagger docs are served at:

```text
http://localhost:3000/api/docs
```

## API summary

### Auth

- POST /auth/register
- POST /auth/login
- GET /auth/me

### Chat

- POST /chat/create
- POST /chat/:chatId/message/send
- GET /chat/:chatId/messages
- POST /chat/:chatId/message/:messageId/read
- POST /chat/:chatId/lastseen
- GET /user/:userId/chats

## Important note on Firestore sync

Message persistence is stored in Firestore for the assignment requirement. Some PostgreSQL metadata updates (like `Chat.lastMessageAt`) are attempted after Firestore persistence. If the database update fails, the message is still kept in Firestore and the error is logged. This limitation is documented because PostgreSQL and Firestore are eventually consistent in this implementation.
