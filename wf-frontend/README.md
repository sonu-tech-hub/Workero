# Worker Finder Frontend v3.0

Full-featured React 18 frontend for the Worker Finder Advanced backend.

## Quick Start

```bash
cp .env.example .env       # Set REACT_APP_API_URL
npm install
npm start                  # http://localhost:3000
```

## Features Implemented

- **Auth**: Register, Login, OTP (6-box, paste support, countdown), Forgot/Reset Password, Change Password, Token refresh queue
- **Worker**: Dashboard (AI tier, badges, earnings chart), Profile edit (GPS, skills/certs/languages chips, photo + verification doc upload), Availability toggle
- **Seeker**: Dashboard (AI insights, spending chart, favorite workers), Profile edit (GPS, preferred categories, photo)
- **Worker Search**: Filters, AI-match ranking, GPS proximity, pagination
- **Jobs**: Create (AI price suggestion, description quality, commission preview), Browse, Detail (full lifecycle: apply → accept → start → complete → pay → review), My Jobs
- **Messages**: Conversation list, chat thread, media upload, auto-scroll, unread badge
- **Reviews**: Two-way post-job review (5 rating fields, photos, star selector)
- **Disputes**: List, Create (evidence photos), Detail
- **Referrals**: Code display/copy, stats, history
- **Payments**: Razorpay order + verify (mock fallback), history
- **Admin**: Stats, User management (toggle status), Analytics, Dispute resolution, Revenue, Cache flush, Mass notifications
- **Categories**: All categories, popular, link to worker search

## Environment Variables

| Variable | Default |
|---|---|
| `REACT_APP_API_URL` | `http://localhost:5000/api` |
| `REACT_APP_SOCKET_URL` | `http://localhost:5000` |
| `REACT_APP_RAZORPAY_KEY_ID` | (from backend .env) |
