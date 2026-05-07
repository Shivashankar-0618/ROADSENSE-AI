# 🛣️ RoadSense AI — Smart City Road Management Platform

A full-stack, production-ready smart city platform for AI-powered pothole detection,
real-time traffic monitoring, complaint management, and smart route optimization.

---

## 📁 Project Structure

```
roadsense-ai/
├── server/          # Node.js + Express backend
└── client/          # React.js + Vite frontend
```

---

## 🚀 Quick Setup

### 1. Clone & Install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure Environment Variables

**Server** — edit `server/.env`:

| Variable | Description |
|---|---|
| `PORT` | Server port (e.g. `5000`) |
| `NODE_ENV` | `development` or `production` |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Random secret string for JWT signing |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `7d`) |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK credentials |
| `FIREBASE_PRIVATE_KEY` | Firebase private key (keep `\n` escaping) |
| `FIREBASE_CLIENT_EMAIL` | Firebase service account email |
| `FIREBASE_STORAGE_BUCKET` | Firebase storage bucket name |
| `GOOGLE_MAPS_API_KEY` | Google Maps JS API key |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary secret |
| `EMAIL_HOST` | SMTP host (e.g. `smtp.gmail.com`) |
| `EMAIL_PORT` | SMTP port (e.g. `587`) |
| `EMAIL_USER` | SMTP username |
| `EMAIL_PASS` | SMTP password / app password |
| `CLIENT_URL` | Frontend URL (e.g. `http://localhost:5173`) |

**Client** — edit `client/.env`:

| Variable | Description |
|---|---|
| `VITE_API_URL` | Backend API base URL (e.g. `/api`) |
| `VITE_GOOGLE_MAPS_API_KEY` | Google Maps JS API key |
| `VITE_FIREBASE_API_KEY` | Firebase web SDK API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Firebase auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Firebase project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase app ID |
| `VITE_SOCKET_URL` | Socket.IO server URL |

### 3. Start Development

```bash
# Terminal 1 — Start backend
cd server
npm run dev

# Terminal 2 — Start frontend
cd client
npm run dev
```

Frontend: http://localhost:5173
Backend:  http://localhost:5000
Health:   http://localhost:5000/api/health

---

## 🔐 User Roles

| Role | Dashboard Route | Permissions |
|---|---|---|
| `user` | `/dashboard` | Report potholes, live map, smart route |
| `gram_admin` | `/gram-admin` | Manage & verify complaints, update status |
| `traffic_admin` | `/traffic-admin` | Monitor traffic, broadcast alerts |
| `super_admin` | `/super-admin` | Full platform control, analytics, user management |

To create a `super_admin`, manually set the role in MongoDB:
```js
db.users.updateOne({ email: "you@example.com" }, { $set: { role: "super_admin" } })
```

---

## 🔗 API Endpoints

### Auth
```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/send-otp
POST   /api/auth/forgot-password
POST   /api/auth/reset-password/:token
GET    /api/auth/me
POST   /api/auth/logout
PATCH  /api/auth/update-fcm-token
```

### Complaints
```
POST   /api/complaints              # Submit with images (multipart)
GET    /api/complaints/my           # User's own complaints
GET    /api/complaints/nearby       # ?longitude=&latitude=&radius=
GET    /api/complaints              # Admin: all complaints
GET    /api/complaints/:id          # Single complaint detail
PATCH  /api/complaints/:id/status   # Update status
PATCH  /api/complaints/:id/assign   # Assign to admin
PATCH  /api/complaints/:id/priority # Set priority
POST   /api/complaints/:id/upvote   # Upvote
DELETE /api/complaints/:id          # Super admin delete
```

### Traffic
```
GET    /api/traffic/live            # Live data by region/location
GET    /api/traffic/heatmap         # Heatmap points
POST   /api/traffic                 # Traffic admin: add data point
GET    /api/traffic/analytics       # Aggregated analytics
```

### Alerts
```
GET    /api/alerts                  # Active alerts near location
POST   /api/alerts                  # Create + broadcast
PATCH  /api/alerts/:id/deactivate   # Deactivate
DELETE /api/alerts/:id              # Delete
```

### Analytics (Admin)
```
GET    /api/analytics/overview      # Platform KPIs (super admin)
GET    /api/analytics/complaints    # Complaint charts (gram admin+)
GET    /api/analytics/users         # User analytics (super admin)
```

### Users (Super Admin)
```
GET    /api/users                   # List all users
GET    /api/users/:id               # Single user
PATCH  /api/users/:id/role          # Change role
PATCH  /api/users/:id/toggle-active # Activate/deactivate
GET    /api/users/list/gram-admins  # List gram admins
```

---

## ⚡ Real-time Events (Socket.IO)

| Event | Direction | Description |
|---|---|---|
| `join_region` | Client→Server | Join a region room |
| `new_complaint` | Server→Client | New pothole reported |
| `complaint_status_update` | Server→Client | Status changed |
| `new_alert` | Server→Client | New alert broadcast |
| `traffic_update` | Server→Client | Live traffic data point |

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, Recharts |
| State | Zustand |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| Auth | JWT (Bearer token) |
| Real-time | Socket.IO |
| Push Notifications | Firebase Admin SDK (FCM) |
| Image Upload | Cloudinary |
| Maps | Google Maps JS API |
| Email | Nodemailer |

---

## 📜 License

MIT — Built for smart city infrastructure.
