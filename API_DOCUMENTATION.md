# Road Damage Reporting API — Documentation

Base URL: `http://localhost:5000/api`

All responses follow a consistent format:

**Success:**
```json
{ "success": true, "message": "...", "data": {} }
```

**Error:**
```json
{ "success": false, "message": "Human readable message", "code": "ERROR_CODE" }
```

Authentication uses JWT Bearer tokens:
```
Authorization: Bearer <token>
```

---

## Health

### GET /api/health
No auth required.

**Response:**
```json
{
  "success": true,
  "message": "Road Damage Reporting API is running",
  "timestamp": "2026-08-30T00:00:00.000Z"
}
```

---

## Authentication

### POST /api/auth/register
**Body:**
```json
{ "name": "string", "email": "string", "password": "string (min 8, 1 uppercase, 1 number)", "phone": "string (optional)" }
```
**Response 201:** `{ token, user }`

---

### POST /api/auth/login
**Body:** `{ "email": "string", "password": "string" }`
**Response 200:** `{ token, user }`

---

### GET /api/auth/me
**Auth:** Required
**Response 200:** `{ user }`

---

### POST /api/auth/logout
**Auth:** Required
**Response 200:** Confirms logout (client must discard JWT)

---

## Complaints (Citizen)

### POST /api/complaints
**Auth:** Required | **Content-Type:** multipart/form-data

**Fields:**
| Field | Type | Required |
|---|---|---|
| damageCategory | POTHOLE\|CRACK\|EDGE_FAILURE\|WATERLOGGING\|SURFACE_DAMAGE\|OTHER | Yes |
| latitude | float | Yes |
| longitude | float | Yes |
| description | string (max 1000) | No |
| customDamageType | string | If category=OTHER |
| image | file (jpg/png/webp, max 5MB) | No |

**Backend process:** Authenticate → Validate → Upload to Cloudinary → Reverse geocode → Check duplicate → Assign municipal corporation → Generate ID → Create → Return

**Response 201:**
```json
{
  "data": {
    "complaint": {
      "complaintId": "RDR-2026-000001",
      "status": "REPORTED",
      "isDuplicate": false,
      ...
    }
  }
}
```

---

### POST /api/complaints/check-duplicate
**Auth:** Required
**Body:** `{ "latitude": float, "longitude": float, "damageCategory": string }`
**Response:**
```json
{ "isDuplicate": true, "complaint": { "complaintId": "...", "status": "..." }, "distance": 72 }
```
or `{ "isDuplicate": false }`

---

### GET /api/complaints/my
**Auth:** Required
**Query:** `page=1`, `limit=10`, `status=`, `damageCategory=`
**Response:** `{ complaints: [], pagination: { page, limit, total, pages } }`

---

### GET /api/complaints/:id
**Auth:** Required (citizen can only see own complaints)
**Response:** `{ complaint }`

---

### GET /api/complaints/:id/status-history
**Auth:** Required
**Response:** `{ history: [{ previousStatus, newStatus, changedBy, comment, createdAt }] }`

---

### GET /api/complaints/nearby
**Auth:** Not required (public)
**Query:** `latitude=`, `longitude=`, `radius=1000` (meters, max 50000)
**Response:** `{ complaints: [], count: N }`

---

### GET /api/complaints/map
**Auth:** Not required (public)
**Query:** `status=`, `damageCategory=`
**Response:** `{ complaints: [] }` — safe public fields only, no citizen PII

---

## Admin

All admin routes require `Authorization: Bearer <adminToken>` with role=admin.

### GET /api/admin/dashboard
**Response:**
```json
{
  "totalComplaints": 42,
  "reported": 10, "received": 8, "inProgress": 12, "resolved": 9, "closed": 3,
  "duplicates": 4,
  "totalUsers": 15,
  "categoryStats": [{ "category": "POTHOLE", "count": 18 }],
  "monthlyStats": [{ "month": "2026-08", "count": 12 }],
  "recentComplaints": [...]
}
```

---

### GET /api/admin/analytics
**Query:** `from=2026-01-01`, `to=2026-12-31`
**Response:** `{ totalComplaints, resolutionRate, duplicateCount, statusDistribution, categoryDistribution, monthlyData, municipalDistribution }`

---

### GET /api/admin/complaints
**Query:** `search=`, `status=`, `damageCategory=`, `municipalCorporationId=`, `from=`, `to=`, `page=1`, `limit=10`
**Response:** `{ complaints: [], pagination: {} }`

---

### GET /api/admin/complaints/:id
**Response:** `{ complaint, history }`

---

### PATCH /api/admin/complaints/:id/status
**Body:** `{ "status": "IN_PROGRESS", "comment": "optional" }`
**Valid statuses:** REPORTED | RECEIVED | IN_PROGRESS | RESOLVED | CLOSED
**Side effects:** Creates ComplaintStatusHistory record + sends Notification to citizen

---

### GET /api/admin/map
**Query:** `status=`, `damageCategory=`, `municipalCorporationId=`, `from=`, `to=`
**Response:** `{ complaints: [], count: N }` — includes location coordinates for GIS rendering

---

### GET /api/admin/reports
**Query:** `status=`, `damageCategory=`, `municipalCorporationId=`, `from=`, `to=`
**Response:** `{ summary, complaints, categoryStats, statusStats, monthlyStats }`

---

### GET /api/admin/reports/export
Same query params as /reports — returns CSV file download.

---

### GET /api/admin/duplicates
**Query:** `page=1`, `limit=10`
**Response:** `{ duplicates: [], pagination: {} }`

---

## Notifications

### GET /api/notifications
**Auth:** Required | **Query:** `page=1`, `limit=20`, `unread=true`
**Response:** `{ notifications: [], unreadCount: N, pagination: {} }`

### PATCH /api/notifications/:id/read
**Auth:** Required
**Response:** `{ notification }`

### PATCH /api/notifications/read-all
**Auth:** Required

---

## Municipal Corporations

### GET /api/municipal
**Response:** `{ corporations: [{ name, code, city, state, isDemo }] }`
> ⚠️ NOTE: All boundaries are DEMO DATA only — not official government boundaries.

### GET /api/municipal/:id
**Response:** `{ corporation }` — includes boundary GeoJSON polygon

---

## Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 400 | Validation error |
| 401 | Unauthorized / invalid token |
| 403 | Forbidden (wrong role) |
| 404 | Not found |
| 409 | Conflict (duplicate) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Error Codes

| Code | Meaning |
|---|---|
| NO_TOKEN | No JWT provided |
| INVALID_TOKEN | JWT is malformed |
| TOKEN_EXPIRED | JWT has expired |
| INVALID_CREDENTIALS | Wrong email/password |
| EMAIL_EXISTS | Email already registered |
| VALIDATION_ERROR | Request body failed validation |
| INVALID_COORDS | Latitude/longitude out of range |
| FILE_TOO_LARGE | Upload exceeds 5MB |
| INVALID_FILE | File type not allowed |
| NOT_FOUND | Resource not found |
| FORBIDDEN | Insufficient role |
| DUPLICATE_KEY | Unique constraint violation |
