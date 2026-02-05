# Portal Backend (Express + Mongoose)

Quick start

1. cd backend
2. copy `.env.example` to `.env` and set `MONGO_URI` (your Atlas connection) and `JWT_SECRET`
3. npm install
4. npm run dev

Available routes (basic examples):
- POST /api/auth/register {name, email, password, role}
- POST /api/auth/login {email, password}
- CRUD /api/students
- CRUD /api/attendance
- CRUD /api/events

Use the `Authorization: Bearer <token>` header for protected routes.

Security note: do not commit a `.env` containing secrets into public repos.