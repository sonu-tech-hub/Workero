#!/bin/bash
# ============================================================
# Worker Finder Advanced Backend v3.0.0
# Quick setup guide
# ============================================================

echo "
╔══════════════════════════════════════════════════╗
║     🔨 WORKER FINDER ADVANCED BACKEND v3.0.0     ║
╚══════════════════════════════════════════════════╝

📦 WHAT'S INCLUDED:
   ✅ AI Worker Matching & Smart Pricing
   ✅ Razorpay Payment Gateway (+ mock mode for dev)
   ✅ Real-time Socket.io Chat
   ✅ Fraud Detection System
   ✅ Performance Tiers (Bronze → Diamond)
   ✅ 15+ Database Tables
   ✅ Advanced Admin Panel API
   ✅ In-Memory Caching
   ✅ Account Security (lockout, refresh token rotation)
   ✅ Complete Postman Collection
   ✅ All bugs from v1 fixed

🚀 QUICK START:
1. Edit .env with your credentials (DB, email)
2. Run: npm install
3. Run: npm run init-db
4. Run: npm run dev

🌐 URLS:
   API:    http://localhost:5000/api
   Health: http://localhost:5000/health

🔑 ADMIN ACCOUNT (created by init-db):
   Email:    admin@workerfinder.com
   Password: Admin@123456

📁 KEY FILES:
   README_ADVANCED.md         → Full documentation
   POSTMAN_COLLECTION_ADVANCED.json → Import to Postman
   .env                       → Your configuration
   src/config/initDatabase.js → DB setup (run once)
   src/services/aiService.js  → AI algorithms
   src/services/paymentService.js → Razorpay integration
   src/services/socketService.js  → Real-time

💳 RAZORPAY SETUP:
   1. Create account at dashboard.razorpay.com
   2. Get Test API keys (Key ID + Key Secret)
   3. Add to .env: RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET
   4. Until configured, API runs in MOCK mode (safe for dev)

📡 SOCKET.IO CONNECTION:
   import { io } from 'socket.io-client';
   const socket = io('http://localhost:5000', {
     auth: { token: 'YOUR_JWT_TOKEN' }
   });
   socket.on('notification:new', (data) => console.log(data));
   socket.on('message:received', (msg) => console.log(msg));

✅ Fixed bugs from v1:
   - OTP expiry validation fixed
   - Duplicate OTP requests handled
   - Token refresh properly implemented
   - Worker search SQL with distance fixed
   - File upload error handling improved
   - Account lock on brute force added
   - All Postman 4xx/5xx errors resolved

Fixed: $(date)
Version: 3.0.0
"
