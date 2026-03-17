# 🔨 Worker Finder Backend v3.0.0
## Advanced AI-Powered Marketplace API

[![Version](https://img.shields.io/badge/version-3.0.0-blue.svg)](/)
[![Node](https://img.shields.io/badge/node-%3E%3D16-green.svg)](/)
[![MySQL](https://img.shields.io/badge/mysql-8%2B-orange.svg)](/)
[![Razorpay](https://img.shields.io/badge/payments-Razorpay-blue.svg)](/)

---

## 🚀 What's New in v3.0.0

| Feature | Status |
|---------|--------|
| 🤖 AI Worker Matching | ✅ Active |
| 💳 Razorpay Payment Gateway | ✅ Integrated |
| ⚡ Socket.io Real-time Messaging | ✅ Active |
| 🧠 AI Price Suggestion Engine | ✅ Active |
| 🔍 Fraud Detection System | ✅ Active |
| 📊 Advanced Admin Analytics | ✅ Active |
| 🔔 Smart Notifications | ✅ Active |
| 🏆 Performance Tiers (Bronze→Diamond) | ✅ Active |
| 🗄️ In-Memory Caching (node-cache) | ✅ Active |
| 🔐 Account Lockout (brute force protection) | ✅ Active |
| 📱 OTP via Email + SMS (Twilio) | ✅ Active |
| 🏗️ 15+ Database Tables | ✅ Created |
| 🔒 JWT Refresh Token Rotation | ✅ Active |

---

## ⚡ Quick Start

```bash
# 1. Configure environment
cp .env.example .env   # Edit with your credentials

# 2. Install dependencies
npm install

# 3. Initialize database (creates all 15 tables)
npm run init-db

# 4. Start server
npm run dev            # Development (with hot reload)
npm start              # Production
```

**Server:** `http://localhost:5000`  
**Health:** `http://localhost:5000/health`  
**API Base:** `http://localhost:5000/api`

---

## 📋 Environment Variables

```env
# REQUIRED
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=worker_finder_db
JWT_SECRET=your_super_secret_key_min_32_chars
EMAIL_USER=your@gmail.com
EMAIL_PASSWORD=your_app_password

# RAZORPAY (get from dashboard.razorpay.com)
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=your_key_secret
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# OPTIONAL
TWILIO_ACCOUNT_SID=ACxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890
CLOUDINARY_CLOUD_NAME=your_cloud
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
```

---

## 📡 API Endpoints

### 🔐 Authentication (`/api/auth`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/register` | Register (worker/seeker) |
| POST | `/verify-otp` | Verify OTP |
| POST | `/resend-otp` | Resend OTP |
| POST | `/login` | Login |
| POST | `/refresh` | Refresh access token |
| POST | `/forgot-password` | Request password reset OTP |
| POST | `/reset-password` | Reset password with OTP |
| GET | `/me` | Get current user (auth) |
| PUT | `/change-password` | Change password (auth) |
| POST | `/logout` | Logout (auth) |

### 👷 Workers (`/api/workers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search` | Search workers with filters |
| GET | `/:workerId` | Get worker public profile |
| PUT | `/profile` | Update profile (worker auth) |
| POST | `/profile-photo` | Upload profile photo |
| POST | `/verification-proof` | Upload ID proof |
| GET | `/dashboard/stats` | Worker dashboard |
| PUT | `/availability` | Toggle availability |

### 🏠 Seekers (`/api/seekers`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/:seekerId` | Get seeker profile |
| PUT | `/profile` | Update profile (seeker auth) |
| POST | `/profile-photo` | Upload photo |
| GET | `/dashboard/stats` | Seeker dashboard |
| GET | `/dashboard/jobs` | Job history |

### 💼 Jobs (`/api/jobs`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all jobs |
| POST | `/` | Create job (seeker auth) |
| GET | `/my-jobs` | My jobs (auth) |
| GET | `/:id` | Get job details |
| POST | `/:id/apply` | Apply for job (worker auth) |
| POST | `/accept-application` | Accept application (seeker) |
| GET | `/:id/applications` | View applications (seeker) |
| PATCH | `/:id/status` | Update job status |
| PATCH | `/:id/cancel` | Cancel job |

### 💳 Payments (`/api/payments`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/create-order` | Create Razorpay order |
| POST | `/verify` | Verify payment signature |
| POST | `/webhook` | Razorpay webhook handler |
| POST | `/refund` | Initiate refund |
| GET | `/history` | Payment history |
| GET | `/fee-preview` | Preview fees |
| GET | `/:id` | Payment details |

### 🤖 AI (`/api/ai`)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/match-workers` | AI-ranked worker list |
| GET | `/price-suggestion` | Smart price estimate |
| GET | `/classify-search` | Search intent analysis |
| POST | `/enhance-description` | Improve job description |
| GET | `/worker-performance/:id?` | Performance analysis |
| GET | `/dashboard-insights` | AI dashboard insights |
| POST | `/notification-preview` | Preview notification |
| POST | `/fraud-check` | Fraud risk (admin) |

### ⭐ Reviews (`/api/reviews`)
| POST | `/` | Create review |
| GET | `/:userId` | Get user reviews |
| POST | `/:id/helpful` | Mark helpful |

### 💬 Messages (`/api/messages`)
| POST | `/` | Send message |
| GET | `/conversations` | Conversation list |
| GET | `/:userId` | Conversation with user |
| GET | `/unread/count` | Unread count |

### ⚠️ Disputes (`/api/disputes`)
| POST | `/` | Create dispute |
| GET | `/` | My disputes |
| GET | `/:id` | Dispute details |
| PATCH | `/:id/status` | Update status |

### 🎁 Referrals (`/api/referrals`)
| GET | `/info` | My referral info |
| GET | `/all` | All referrals (admin) |
| POST | `/validate` | Validate referral code |

### 📁 Categories (`/api/categories`)
| GET | `/` | All categories |
| POST | `/` | Create (admin) |

### 👑 Admin (`/api/admin`)
| GET | `/dashboard` | Full dashboard stats |
| GET | `/users` | All users with filters |
| PATCH | `/users/:id/status` | Activate/deactivate |
| GET | `/analytics` | Daily analytics |
| GET | `/disputes` | All disputes |
| PATCH | `/disputes/:id/resolve` | Resolve dispute |
| POST | `/notify-all` | Mass notification |
| GET | `/revenue` | Revenue breakdown |
| POST | `/cache` | Cache management |

---

## 🤖 AI Features Explained

### 1. Smart Worker Matching
AI scores workers 0-100 based on:
- ⭐ Rating (30pts) + Experience (25pts)
- ✅ Completion rate (20pts) + Proximity (15pts)
- 📍 Availability (5pts) + Profile completeness (5pts)

### 2. Price Suggestion Engine
Auto-suggests job pricing based on:
- Category base rates (15 categories)
- Location tier (Tier 1/2/3 cities)
- Experience multiplier
- Urgency factor (up to 1.5x)

### 3. Fraud Detection
Monitors:
- Multiple registrations from same IP
- Rapid failed login attempts
- Suspicious payment patterns
- Review manipulation

### 4. Performance Tiers
Workers earn tiers based on rating + completion:
- 🥉 Bronze (default)
- 🥈 Silver (3.5+ rating, 70%+ completion)
- 🥇 Gold (4.0+ rating, 80%+ completion)
- 💎 Platinum (4.5+ rating, 90%+ completion)
- 💠 Diamond (4.8+ rating, 95%+ completion)

---

## 💳 Razorpay Integration

### Payment Flow
1. Seeker calls `POST /api/payments/create-order`
2. Frontend loads Razorpay checkout with `order_id`
3. User pays → Razorpay returns 3 tokens
4. Frontend calls `POST /api/payments/verify` with tokens
5. Backend verifies signature, updates DB, sends receipts

### Mock Mode
If `RAZORPAY_KEY_ID` is not configured, the API runs in mock mode for development — all payment endpoints respond with mock data.

---

## ⚡ Real-time (Socket.io)

Connect: `ws://localhost:5000` with `auth: { token: "YOUR_JWT" }`

### Events (listen)
- `message:received` - New chat message
- `notification:new` - New notification
- `job:assigned` - Job assigned to you
- `job:status_updated` - Job status changed
- `payment:received` - Payment credited
- `typing:indicator` - Typing status

### Events (emit)
- `message:send` - Send message
- `typing:start/stop` - Typing indicator
- `location:update` - Worker location
- `job:subscribe` - Subscribe to job updates

---

## 🗄️ Database Tables (15 total)

```
users               → Auth, OTP, tokens, account lock
worker_profiles     → Skills, certs, ratings, tier
seeker_profiles     → Preferences, spending stats
categories          → 15 service categories
jobs                → Full lifecycle, AI pricing
job_applications    → Worker applications
reviews             → Ratings, photos, sentiment
messages            → Chat with media
disputes            → Evidence, resolution
referrals           → Referral tracking
payments            → Razorpay full record
notifications       → In-app notifications
subscriptions       → Plans (basic/premium)
analytics_events    → User behavior
audit_logs          → Admin action trail
```

---

## 🔐 Security Features

- ✅ JWT access tokens (24h) + Refresh tokens (7d)
- ✅ Bcrypt password hashing (12 rounds)
- ✅ Account lockout after 5 failed attempts
- ✅ Rate limiting per route type
- ✅ XSS protection
- ✅ Helmet security headers
- ✅ Parameterized SQL (injection-safe)
- ✅ Input validation on all endpoints
- ✅ CORS whitelist
- ✅ Razorpay signature verification

---

## 🧪 Testing with Postman

Import `POSTMAN_COLLECTION_ADVANCED.json` and:
1. Register user → copy `access_token`
2. Set `Bearer {{token}}` in collection Authorization
3. Test endpoints in order shown above

**Admin credentials:** `admin@workerfinder.com` / `Admin@123456`

---

## 📞 Support

For issues: Check `logs/` directory for detailed error logs.
