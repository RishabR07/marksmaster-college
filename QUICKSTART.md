# Quick Start Guide - Express/MongoDB Migration

## 🚀 Get Started in 5 Minutes

### Step 1: Backend Setup

```bash
# Navigate to backend folder
cd backend

# Install dependencies (if not done)
npm install

# Create .env file with your MongoDB credentials
# Copy the template below and update with your details
```

**Backend .env Template:**
```env
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/portal?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_key_here_minimum_32_chars
PORT=5000
NODE_ENV=development
```

### Step 2: Frontend Setup

```bash
# Navigate to frontend folder (go back to portal root)
cd ../

# Install dependencies (if not done)
npm install

# .env is already configured with:
# VITE_API_URL=http://localhost:5000
```

### Step 3: Run Both Services

**Terminal 1 - Start Backend:**
```bash
cd backend
npm run dev
# Server should start on http://localhost:5000
```

**Terminal 2 - Start Frontend:**
```bash
npm run dev
# Frontend should start on http://localhost:5173
```

### Step 4: Test It Works

1. Open `http://localhost:5173` in your browser
2. You should see the login page
3. Try registering a new account:
   - Email: `test@example.com`
   - Password: `Test123`
4. Login with those credentials
5. You should be redirected to the dashboard

---

## 📱 Key Features Now Working

- ✅ User Registration & Login with JWT
- ✅ Password Reset via OTP
- ✅ Student Dashboard (view marks and attendance)
- ✅ Teacher Dashboard (manage subjects and marks)
- ✅ Admin Dashboard (user management)
- ✅ Attendance Tracking
- ✅ Event Management
- ✅ Marks Management with Bulk Import

---

## 🔌 API Testing (Optional)

Test the API using curl or Postman:

```bash
# Register
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "student"
  }'

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Get all students (requires token)
curl -X GET http://localhost:5000/api/students \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Cannot connect to MongoDB"
```
Error: MongoDB connection error
```
**Solution:** 
- Check MONGO_URI in `.env` is correct
- Make sure your MongoDB cluster is accessible
- Whitelist your IP in MongoDB Atlas

### Issue 2: "CORS error" or "Failed to fetch"
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution:**
- Make sure backend is running on port 5000
- Check VITE_API_URL in frontend .env is `http://localhost:5000`
- Backend already has CORS enabled

### Issue 3: "Invalid token" on every request
```
Error: Token is not valid
```
**Solution:**
- Make sure JWT_SECRET in backend .env matches what was used to create the token
- Clear browser localStorage and re-login
- Try with a different secret if already deployed

### Issue 4: "Port already in use"
```
Error: listen EADDRINUSE :::5000
```
**Solution:**
```bash
# Kill the process on port 5000
# On Windows:
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# On Mac/Linux:
lsof -i :5000
kill -9 <PID>
```

---

## 📝 File Structure Reference

```
d:\college project\portal\
├── backend/                    # Express server
│   ├── src/
│   │   ├── index.js           # Main server file
│   │   ├── config/
│   │   │   └── db.js          # MongoDB connection
│   │   ├── middleware/
│   │   │   └── auth.js        # JWT verification
│   │   ├── models/            # MongoDB schemas
│   │   │   ├── User.js
│   │   │   ├── Student.js
│   │   │   ├── Subject.js      # NEW
│   │   │   ├── Marks.js        # NEW
│   │   │   └── Enrollment.js   # NEW
│   │   └── routes/            # API endpoints
│   │       ├── auth.js        # EXTENDED with OTP
│   │       ├── students.js
│   │       ├── attendance.js
│   │       ├── events.js
│   │       ├── subjects.js     # NEW
│   │       ├── marks.js        # NEW
│   │       └── enrollments.js  # NEW
│   ├── .env                   # Environment variables
│   └── package.json
│
└── src/                        # React frontend
    ├── pages/
    │   ├── Auth.tsx           # UPDATED
    │   ├── StudentDashboard.tsx # UPDATED
    │   ├── TeacherDashboard.tsx # UPDATED
    │   ├── IAMarks.tsx         # UPDATED
    │   └── AdminDashboard.tsx  # UPDATED
    ├── contexts/
    │   └── AuthContext.tsx     # UPDATED (JWT based)
    ├── services/
    │   └── api.ts             # NEW - API service layer
    └── ...
```

---

## 🔐 Security Tips

1. **JWT Secret**: Use a strong, random string (32+ characters)
2. **MongoDB**: Use connection string with password
3. **CORS**: Restrict to specific domains in production
4. **Passwords**: Always hashed with bcrypt
5. **Environment Variables**: Never commit `.env` files

---

## 📚 API Documentation

### Authentication Endpoints

```
POST /api/auth/register
Body: { name, email, password, role }
Returns: { token }

POST /api/auth/login
Body: { email, password }
Returns: { token }

POST /api/auth/send-otp
Body: { email }
Returns: { msg }

POST /api/auth/verify-otp
Body: { email, otp }
Returns: { token }

POST /api/auth/reset-password
Body: { email, newPassword }
Returns: { msg }
```

All other endpoints require `Authorization: Bearer <token>` header

---

## 🚀 Next Steps

1. **Test thoroughly** - Try all user flows (register, login, dashboard)
2. **Data migration** - If migrating from Supabase, write migration scripts
3. **Email setup** - Configure nodemailer for OTP emails
4. **Deploy** - Set up production environment
5. **Monitoring** - Add logging and error tracking

---

## 💡 Tips & Tricks

- **View logs**: Both frontend and backend show detailed logs in terminal
- **Debug mode**: Browser DevTools shows network requests and console errors
- **Reset data**: Delete MongoDB collections and re-populate from frontend
- **Hot reload**: Both backend and frontend auto-reload on file changes

---

## 📞 Quick Help

**Check backend is running:**
```bash
curl http://localhost:5000/
# Should return: "Portal Backend Running"
```

**Check frontend is running:**
Open `http://localhost:5173/` in browser

**View JWT token contents:**
```javascript
// In browser console
const token = localStorage.getItem('authToken');
console.log(JSON.parse(atob(token.split('.')[1])));
```

---

Good luck! If you get stuck, check the detailed guides:
- `MIGRATION_GUIDE.md` - Complete migration reference
- `CONVERSION_COMPLETE.md` - Full feature list and troubleshooting

Happy coding! 🎉
