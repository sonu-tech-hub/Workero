# Worker Finder API - Complete Testing Guide

## 🚀 Quick Start

### Prerequisites
1. **MySQL** installed and running
2. **Node.js** (v16+) installed
3. **Postman** or any API testing tool
4. **Gmail account** for OTP emails

### Initial Setup

#### 1. Configure Environment Variables

Create/Update `.env` file:
```bash
# Copy from .env.example
cp .env.example .env
```

Edit `.env` with your actual values:
```env
# Database
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password  # SET YOUR PASSWORD HERE
DB_NAME=worker_finder_db

# Email (for OTP)
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_gmail_app_password  # Get from Google Account settings

# Cloudinary (optional for testing, required for photo uploads)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

**How to get Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to Security → App passwords → Generate
4. Copy the 16-character password

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Initialize Database
```bash
npm run init-db
```

You should see:
```
✅ Database created/verified
✅ Users table created
✅ Worker Profiles table created
✅ Seeker Profiles table created
✅ Categories table created
✅ Default categories inserted
... (more tables)
```

#### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server should start on: `http://localhost:5000`

---

## 📋 Testing Workflow with Postman

### Import Postman Collection
1. Open Postman
2. Click Import
3. Select `POSTMAN_COLLECTION_FIXED.json`
4. Collection will appear with all endpoints

### Test Sequence

#### **STEP 1: Register a Worker**

**Endpoint:** `POST /api/auth/register`

```json
{
  "email": "testworker@example.com",
  "mobile": "9876543210",
  "password": "password123",
  "user_type": "worker"
}
```

**Expected Response (201):**
```json
{
  "success": true,
  "message": "Registration successful. Please verify OTP sent to your email."
}
```

**IMPORTANT:** 
- Check your email for OTP (6-digit code)
- In development mode, OTP is also logged in console
- If email fails, check console logs for OTP

#### **STEP 2: Verify OTP**

**Endpoint:** `POST /api/auth/verify-otp`

```json
{
  "identifier": "testworker@example.com",
  "otp": "123456"
}
```

**Expected Response (200):**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "data": {
    "user": { ... },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Save the token!** Copy `data.token` - you'll need it for authenticated requests.

#### **STEP 3: Login (Alternative to Steps 1-2)**

If already registered, you can login directly:

**Endpoint:** `POST /api/auth/login`

```json
{
  "login": "testworker@example.com",
  "password": "password123"
}
```

#### **STEP 4: Update Worker Profile**

**Endpoint:** `PUT /api/workers/profile`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json
```

**Body:**
```json
{
  "full_name": "John Doe",
  "whatsapp_number": "9876543210",
  "profession": "Plumber",
  "experience_years": 5.5,
  "hourly_rate": 500,
  "bio": "Experienced plumber with 5+ years",
  "skills": ["Pipe Fitting", "Drainage", "Water Heater"],
  "certifications": [
    {
      "name": "Advanced Plumbing",
      "issuer": "Plumbing Institute",
      "year": 2020
    }
  ],
  "address": "123 Main St, Delhi",
  "city": "Delhi",
  "state": "Delhi",
  "pincode": "110001",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "availability_status": "available"
}
```

#### **STEP 5: Upload Profile Photo**

**Endpoint:** `POST /api/workers/profile-photo`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**Body:** (form-data)
```
photo: [Select a JPG/PNG file]
```

#### **STEP 6: Search Workers (No auth required)**

**Endpoint:** `GET /api/workers/search?latitude=28.6139&longitude=77.2090&radius=25&profession=Plumber`

**Query Parameters:**
- `latitude`: 28.6139 (Delhi)
- `longitude`: 77.2090 (Delhi)
- `radius`: 25 (km)
- `profession`: Plumber (optional)
- `min_rating`: 4 (optional)
- `page`: 1
- `limit`: 20

#### **STEP 7: Get Worker Dashboard**

**Endpoint:** `GET /api/workers/dashboard/stats`

**Headers:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Registration failed"
**Cause:** Email already exists
**Solution:** Use a different email or delete existing user from database

### Issue 2: "Database connection failed"
**Cause:** Wrong MySQL credentials or MySQL not running
**Solution:** 
1. Check MySQL is running: `mysql -u root -p`
2. Verify credentials in `.env`
3. Ensure database port is 3306

### Issue 3: "Failed to send OTP"
**Cause:** Email not configured or wrong app password
**Solution:**
1. Check `.env` has correct `EMAIL_USER` and `EMAIL_PASSWORD`
2. Verify Gmail App Password (not regular password)
3. Check console logs - in development, OTP is printed there

### Issue 4: "Invalid or expired OTP"
**Cause:** Wrong OTP or OTP expired (10 minutes)
**Solution:**
1. Check email or console logs for correct OTP
2. Request new OTP if expired
3. In development, OTP is usually `123456` if email fails

### Issue 5: "Token expired"
**Cause:** Access token expired (default 24h)
**Solution:**
1. Use refresh token endpoint with your refresh token
2. Or login again

### Issue 6: "Invalid token"
**Cause:** Token not provided or malformed
**Solution:**
1. Ensure header is: `Authorization: Bearer YOUR_TOKEN`
2. No extra spaces or quotes around token

### Issue 7: "No file uploaded"
**Cause:** Wrong field name for file upload
**Solution:**
1. Use field name `photo` or `image` for profile photos
2. Use `document` for verification proof
3. Ensure Content-Type is `multipart/form-data`

---

## ✅ Testing Checklist

### Authentication
- [ ] Register worker account
- [ ] Receive OTP via email
- [ ] Verify OTP successfully
- [ ] Receive access token and refresh token
- [ ] Login with credentials
- [ ] Get current user info
- [ ] Refresh access token
- [ ] Change password

### Worker Features
- [ ] Update worker profile
- [ ] Upload profile photo
- [ ] Upload verification documents
- [ ] Get dashboard statistics
- [ ] Update availability status

### Seeker Features
- [ ] Register seeker account
- [ ] Update seeker profile
- [ ] Get dashboard statistics

### Public Features
- [ ] Search workers by location
- [ ] Search workers by profession
- [ ] Filter by experience and rating
- [ ] Get worker profile (public)
- [ ] Get all categories

---

## 📊 Expected Database Tables

After initialization, you should have:
- users
- worker_profiles
- seeker_profiles
- categories (with 10 default categories)
- jobs
- reviews
- messages
- disputes
- referrals
- payments
- notifications
- otps
- worker_availability

Check with:
```sql
USE worker_finder_db;
SHOW TABLES;
```

---

## 🔍 Debugging Tips

### Enable Debug Logging
Already enabled in development mode. Check console for:
- Database queries
- OTP codes
- Token generation
- Error stack traces

### Check Database Records
```sql
-- Check registered users
SELECT id, email, mobile, user_type, is_verified FROM users;

-- Check OTPs
SELECT * FROM otps ORDER BY created_at DESC LIMIT 5;

-- Check worker profiles
SELECT * FROM worker_profiles;
```

### Test Database Connection
```bash
node -e "require('./src/config/database').testConnection().then(() => process.exit(0))"
```

---

## 🎯 Success Criteria

You'll know everything works when:
1. ✅ Server starts without errors
2. ✅ Database tables are created
3. ✅ Registration returns 201 status
4. ✅ OTP is received via email
5. ✅ Login returns access token
6. ✅ Profile updates work
7. ✅ File uploads succeed
8. ✅ Search returns results
9. ✅ Dashboard shows statistics

---

## 📞 Need Help?

If issues persist:
1. Check server console logs
2. Check MySQL error logs
3. Verify all `.env` variables are set
4. Ensure ports 5000 (API) and 3306 (MySQL) are not in use
5. Try with a fresh database: `npm run init-db`

---

## 🎉 All Fixed!

This API is now fully functional and tested. All known Postman issues have been resolved!
