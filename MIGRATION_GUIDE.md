# Supabase to Express/MongoDB Migration Guide

## Summary of Changes Made

### 1. ✅ Environment Configuration
- **Updated `.env`**: Changed from Supabase keys to `VITE_API_URL=http://localhost:5000`

### 2. ✅ API Service Layer
- **Created `src/services/api.ts`**: Complete API service with all methods for:
  - `authAPI`: login, register, send-otp, verify-otp, reset-password, change-password
  - `studentsAPI`: CRUD operations
  - `attendanceAPI`: CRUD operations
  - `eventsAPI`: CRUD operations
  - `subjectsAPI`: CRUD operations
  - `marksAPI`: CRUD operations (including upsert)
  - `enrollmentsAPI`: CRUD operations
  - `bulkAPI`: Bulk operations
  - Token management utilities

### 3. ✅ Authentication
- **Updated `src/contexts/AuthContext.tsx`**: Now uses Express JWT instead of Supabase
  - Stores token in localStorage
  - Decodes JWT to get user info and role
  - Removed Supabase auth dependencies

### 4. ✅ Auth Page
- **Updated `src/pages/Auth.tsx`**: All auth calls now use `authAPI`
  - Login via Express API
  - Password reset via OTP
  - Removed Supabase auth functions

### 5. ✅ Backend Setup
- **Extended auth routes** with OTP and password reset functionality
- **Created models**: Subject, Marks, Enrollment
- **Created routes**: subjects.js, marks.js, enrollments.js
- **Registered routes** in backend index.js
- **Backend supports**: JWT auth, MongoDB storage, all CRUD operations

### 6. ✅ Removed Dependencies
- Removed `@supabase/supabase-js` from package.json

## Manual Updates Needed

You still need to update the following files to use the API service. Here's the pattern:

### Pattern for Page Updates

**Before (Supabase):**
```tsx
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase
  .from("marks")
  .select("*")
  .eq("student_id", studentId);
```

**After (Express API):**
```tsx
import { marksAPI } from "@/services/api";

const data = await marksAPI.getAll({ student: studentId });
```

### Files to Update

#### 1. **StudentDashboard.tsx** - Update these calls:
- `supabase.from("students").select()` → `studentsAPI.getAll()`
- `supabase.from("marks").select()` → `marksAPI.getAll({ student: studentId })`
- `supabase.from("attendance").select()` → `attendanceAPI.getAll(studentId)`

#### 2. **TeacherDashboard.tsx** - Update these calls:
- `supabase.from("subjects").select()` → `subjectsAPI.getAll({ teacher: userId })`
- `supabase.from("marks").upsert()` → `marksAPI.upsert(data)`
- `supabase.functions.invoke('send-marks-notification')` → `bulkAPI.sendMarksNotification(data)`
- `supabase.functions.invoke('bulk-import-marks')` → `bulkAPI.importMarks(data)`
- `supabase.from("enrollments").select()` → `enrollmentsAPI.getAll({ subject: subjectId })`

#### 3. **IAMarks.tsx** - Update these calls:
- All `supabase.from()` calls → corresponding `API.getAll()` calls
- `supabase.auth.getSession()` → Not needed (AuthContext handles this)

#### 4. **AdminDashboard.tsx** - Update these calls:
- All Supabase queries → corresponding API service calls
- `supabase.functions.invoke()` → `bulkAPI` methods

## Backend Endpoints Available

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/send-otp
POST   /api/auth/verify-otp
POST   /api/auth/reset-password
POST   /api/auth/change-password
GET    /api/auth/user/:id

POST   /api/students
GET    /api/students
GET    /api/students/:id
PUT    /api/students/:id
DELETE /api/students/:id

POST   /api/attendance
GET    /api/attendance
PUT    /api/attendance/:id
DELETE /api/attendance/:id

POST   /api/events
GET    /api/events
PUT    /api/events/:id
DELETE /api/events/:id

POST   /api/subjects
GET    /api/subjects
GET    /api/subjects/:id
PUT    /api/subjects/:id
DELETE /api/subjects/:id

POST   /api/marks
POST   /api/marks/upsert
GET    /api/marks
PUT    /api/marks/:id
DELETE /api/marks/:id

POST   /api/enrollments
GET    /api/enrollments
PUT    /api/enrollments/:id
DELETE /api/enrollments/:id
```

## Database Setup (MongoDB)

Make sure your `.env` file in the backend folder has:
```
MONGO_URI=mongodb+srv://user:password@cluster.mongodb.net/portal
JWT_SECRET=your_jwt_secret_key
PORT=5000
```

## Running the Application

### Terminal 1 - Backend:
```bash
cd backend
npm install
npm run dev
```

### Terminal 2 - Frontend:
```bash
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`
The backend will be available at `http://localhost:5000`

## Data Migration (If Needed)

To migrate data from Supabase PostgreSQL to MongoDB:
1. Export data from Supabase as JSON/CSV
2. Use MongoDB import tools or write a migration script
3. Adjust field names to match MongoDB schema if needed

## Next Steps

1. Remove the Supabase integration folder if you no longer need it
2. Update the remaining pages (StudentDashboard, TeacherDashboard, IAMarks, AdminDashboard)
3. Test all flows thoroughly
4. Set up proper email service for OTP sending (nodemailer, SendGrid, etc.)
5. Deploy backend to a server (Heroku, AWS, DigitalOcean, etc.)
