# สถานะโปรเจกต์: ระบบแจ้งซ่อมโฟล์คลิฟท์ผ่าน LINE (LIFF)

> อัปเดตล่าสุด: 23 กันยายน 2026
> อ้างอิง spec เต็ม: `.kiro/specs/forklift-repair/{requirements,design,tasks}.md`

## สรุปภาพรวม

**Task 1-14: เสร็จสมบูรณ์ครบถ้วน** ✅
**Task 15-17: ยังไม่ทำ** — รอคำสั่งผู้ใช้ (Containerization, Kubernetes, integration test สุดท้าย)

Stack: Next.js 16 (App Router, Turbopack) + React 19 + TypeScript, Prisma 6.19.3, PostgreSQL 16, MUI v9, @tanstack/react-query, @line/liff, เก็บรูปบน PVC (filesystem, ไม่ใช้ S3/MinIO)

---

## งานที่เสร็จแล้ว (Task 1-14)

### Backend — 28 API endpoints

- **Task 1-2**: โครงสร้างโปรเจกต์ Next.js, docker-compose (postgres), health check (`/api/health/live`, `/ready`), error response format กลาง
- **Task 3**: Prisma schema ครบ (User, Customer, Asset, AssetQrToken, Ticket, TicketAttachment, TicketHistory) + migration + seed
- **Task 4**: Auth ครบ (login/refresh/logout/me), JWT httpOnly cookie, RBAC ผ่าน `requireRole()`, `src/proxy.ts` ป้องกัน `/admin/*`
- **Task 5**: จัดการผู้ใช้หลังบ้าน (`/api/users`) เฉพาะ ADMIN
- **Task 6**: จัดการลูกค้า+รถ (Customer/Asset) CRUD + deactivate
- **Task 7**: ระบบ QR token (gen/rotate/revoke) + สร้างรูป QR (PNG/PDF)
- **Task 8**: เชื่อมต่อ LINE (verify token, profile, friendship check) + mock สำหรับ test
- **Task 9**: จัดการรูปภาพบน PVC (เขียน/อ่านไฟล์, validate mime/ขนาด, stream พร้อมตรวจสิทธิ์)
- **Task 10**: Endpoint ฝั่ง LIFF (`/api/liff/assets/[token]`, `/api/liff/tickets`) + rate limit
- **Task 11**: Ticket state machine ครบ (assign, status transition, attachments, history) + บังคับสิทธิ์ตาม role
- **Task 12**: รายงาน (summary, top assets/customers, avg resolution time)

### Frontend ฝั่งลูกค้า — LIFF (Task 13)

4 หน้า: entry (`/liff`) → add-friend (ถ้ายังไม่เป็นเพื่อน) → report (กรอกฟอร์มแจ้งซ่อม) → success (แสดงเลขที่ใบแจ้งซ่อม)

### Frontend หลังบ้าน — Admin (Task 14)

8 หน้า: login, dashboard, customers, assets (พร้อม QR), tickets (list+detail+state machine actions), users, reports — ครบ RBAC ตาม role (ADMIN/MANAGER/TECHNICIAN)

### ผลการทดสอบ

- `npm run lint` ผ่าน
- `npm run build` ผ่าน
- `npm run test` — 60 unit tests ผ่านหมด
- ทดสอบ E2E ผ่าน curl กับ dev server + PostgreSQL จริงทุก endpoint/flow (login, RBAC, state machine, QR, รายงาน, LIFF flow)
- DB กลับสู่ seed สะอาดเสมอหลังทดสอบ (users=2, customers=1, assets=1, tickets=0)

---

## งานที่ยังไม่ทำ (Task 15-17)

รอคำสั่งผู้ใช้เพิ่มก่อนดำเนินการ:

- **Task 15**: Containerization — Dockerfile (multi-stage, standalone output), `.dockerignore`, แยก env/secret
- **Task 16**: Kubernetes manifests — Deployment, Service, probes, PVC (uploads + postgres), ConfigMap/Secret, migration Job, Ingress+TLS
- **Task 17**: ทดสอบรวมและตรวจ flow หลัก — integration/E2E test สุดท้าย, ทดสอบ LIFF จริงบนมือถือผ่าน LINE app

---

## วิธีรันโปรเจกต์ตอนนี้

```bash
docker compose up -d      # เปิด PostgreSQL
npm run dev                # เปิด Next.js dev server (http://localhost:3000)
```

เข้าหลังบ้าน: `http://localhost:3000/admin/login`

- Admin: `admin` / `ChangeMe123!`
- ช่าง: `tech1` / `ChangeMe123!`

Test commands:

- `npm run test` — unit test (ไม่ต้องใช้ DB จริง)
- `npm run test:integration` — ใช้ DB จริง (ต้อง `docker compose up postgres` ก่อน)
- `npm run lint`, `npm run build`

## ข้อจำกัดที่ทราบอยู่แล้ว

- `NEXT_PUBLIC_LIFF_ID` ใน `.env` ยังเป็นค่าว่าง — ต้องได้ LIFF ID จริงจาก LINE Developers Console ก่อนทดสอบ flow LIFF ผ่าน LINE app จริงบนมือถือได้
- Rate limiting เป็นแบบ in-memory (เหมาะกับ single-replica) — ถ้า deploy หลาย replica (K8s) ต้องเปลี่ยนเป็น shared store (เช่น Redis) ตอนทำ task 16
- ไม่มี LINE push notification กลับลูกค้า (ตามข้อตกลง — ช่างรับทราบ/เซ็นบิลหน้างานเอง)

## บทเรียนสำคัญที่เจอระหว่าง implement (เผื่อแก้ต่อในอนาคต)

- Prisma 7 ต้องใช้ driver adapter + `prisma.config.ts` → ใช้ 6.19.3 แทนเพื่อความง่าย
- Zod v4 `.uuid()` เช็ค RFC version/variant nibble จริง → ต้องใช้ `crypto.randomUUID()` ไม่ใช่ fixed UUID ปลอมใน seed/test
- Next.js 16: `middleware.ts` ย้ายเป็น `src/proxy.ts` (export function ชื่อ `proxy`, ต้องอยู่ระดับเดียวกับ `src/app`)
- pdf-lib ไม่รองรับภาษาไทยในตัว ต้อง embed font Noto Sans Thai ผ่าน `@pdf-lib/fontkit`
- MUI v9: `Typography` ไม่รับ `fontWeight` ตรงๆ, `Stack` ไม่รับ `justifyContent`/`alignItems` ตรงๆ → ใช้ `sx={{...}}` เสมอ
- MUI theme object (มี function ข้างใน) ส่งจาก Server Component ไป Client Component ไม่ได้ → ต้องสร้าง theme ในไฟล์ `"use client"` เท่านั้น (ดู `src/lib/ThemeRegistry.tsx`)
- Turbopack: dynamic `path.join()` ต้องมี `/* turbopackIgnore: true */` comment
