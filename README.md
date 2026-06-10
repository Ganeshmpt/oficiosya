# OficiosYA — Backend API REST
Universidad Técnica de Ambato — Grupo A 2026

---

## Credenciales admin por defecto
- Email: admin@oficiosya.com
- Password: Admin2026!

---

## Pasos para arrancar

### 1. Base de datos (pgAdmin)
- Crear BD: `oficiosya_db`
- Abrir Query Tool → cargar `backend/data/schema.sql` → F5

### 2. Variables de entorno
```bash
cd backend
cp .env.example .env
# Editar .env con tu DB_PASSWORD y credenciales de Cloudinary
```

### 3. Backend
```bash
cd backend
npm install
npm run dev
```

Deberías ver:
```
✅ Conectado a PostgreSQL: oficiosya_db
📧 Servicio de email listo.
🚀 OficiosYA API corriendo en http://localhost:3000
```

### 4. Frontend
- Abrir VS Code
- Clic derecho sobre `frontend/index.html` → Open with Live Server
- Se abre en http://localhost:5500

---

## Si ya tenías la BD creada (actualizar admin)
Ejecuta esto en pgAdmin Query Tool:
```sql
UPDATE usuarios SET
  password_hash = '$2a$12$J6ukB1PvIhMH/53Ep0Mdx.NCpvX8ml0khFOpylPHjlVm74qSpdk0.',
  is_admin = TRUE,
  activo = TRUE
WHERE email = 'admin@oficiosya.com';
```
