-- ─────────────────────────────────────────────
-- TABLA: categorias
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(100) NOT NULL,
    descripcion VARCHAR(255),
    icono       VARCHAR(100),
    activa      BOOLEAN DEFAULT TRUE,
    createdat   TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: usuarios
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100),
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    telefono        VARCHAR(20),
    foto_url        VARCHAR(500),
    foto_public_id  VARCHAR(255),
    zona            VARCHAR(100),
    es_trabajador   BOOLEAN DEFAULT FALSE,
    es_cliente      BOOLEAN DEFAULT TRUE,
    verificado      BOOLEAN DEFAULT FALSE,
    activo          BOOLEAN DEFAULT TRUE,
    suspendido      BOOLEAN DEFAULT FALSE,
    bloqueado       BOOLEAN DEFAULT FALSE,
    reset_token         VARCHAR(255),
    reset_token_expiry  TIMESTAMP,
    email_token         VARCHAR(255),
    email_verificado    BOOLEAN DEFAULT FALSE,
    createdat       TIMESTAMP DEFAULT NOW(),
    updatedat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: perfiles_trabajador
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS perfiles_trabajador (
    id                  SERIAL PRIMARY KEY,
    usuario_id          INT NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE CASCADE,
    categoria_id        INT REFERENCES categorias(id),
    titulo              VARCHAR(200),
    descripcion         TEXT,
    anos_experiencia    INT DEFAULT 0,
    precio_desde        DECIMAL(10,2),
    disponible          BOOLEAN DEFAULT TRUE,
    rating_promedio     DECIMAL(3,2) DEFAULT 0,
    total_servicios     INT DEFAULT 0,
    createdat           TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: imagenes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS imagenes (
    id              SERIAL PRIMARY KEY,
    entidad_tipo    VARCHAR(50) NOT NULL,
    entidad_id      INT NOT NULL,
    url             VARCHAR(500) NOT NULL,
    public_id       VARCHAR(255) NOT NULL,
    descripcion     VARCHAR(255),
    createdat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: verificaciones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verificaciones (
    id              SERIAL PRIMARY KEY,
    usuario_id      INT NOT NULL REFERENCES usuarios(id),
    doc_url         VARCHAR(500),
    doc_public_id   VARCHAR(255),
    estado          VARCHAR(20) DEFAULT 'pendiente',
    motivo_rechazo  TEXT,
    revisado_por    INT REFERENCES usuarios(id),
    createdat       TIMESTAMP DEFAULT NOW(),
    updatedat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: solicitudes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
    id              SERIAL PRIMARY KEY,
    cliente_id      INT NOT NULL REFERENCES usuarios(id),
    categoria_id    INT REFERENCES categorias(id),
    titulo          VARCHAR(200) NOT NULL,
    descripcion     TEXT,
    zona            VARCHAR(100),
    presupuesto     DECIMAL(10,2),
    fecha_preferida DATE,
    urgencia        VARCHAR(20) DEFAULT 'normal',
    estado          VARCHAR(30) DEFAULT 'abierta',
    createdat       TIMESTAMP DEFAULT NOW(),
    updatedat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: postulaciones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS postulaciones (
    id              SERIAL PRIMARY KEY,
    solicitud_id    INT NOT NULL REFERENCES solicitudes(id),
    trabajador_id   INT NOT NULL REFERENCES usuarios(id),
    mensaje         TEXT,
    precio_oferta   DECIMAL(10,2),
    disponibilidad  VARCHAR(50),
    estado          VARCHAR(20) DEFAULT 'pendiente',
    createdat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: servicios
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS servicios (
    id              SERIAL PRIMARY KEY,
    solicitud_id    INT REFERENCES solicitudes(id),
    postulacion_id  INT REFERENCES postulaciones(id),
    trabajador_id   INT NOT NULL REFERENCES usuarios(id),
    cliente_id      INT NOT NULL REFERENCES usuarios(id),
    estado          VARCHAR(30) DEFAULT 'confirmado',
    precio_final    DECIMAL(10,2),
    fecha_inicio    TIMESTAMP,
    fecha_fin       TIMESTAMP,
    createdat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: calificaciones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calificaciones (
    id              SERIAL PRIMARY KEY,
    servicio_id     INT NOT NULL REFERENCES servicios(id),
    calificador_id  INT NOT NULL REFERENCES usuarios(id),
    calificado_id   INT NOT NULL REFERENCES usuarios(id),
    puntaje         INT NOT NULL CHECK (puntaje BETWEEN 1 AND 5),
    comentario      TEXT,
    tipo            VARCHAR(30),
    createdat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- TABLA: reportes
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reportes (
    id              SERIAL PRIMARY KEY,
    reportador_id   INT NOT NULL REFERENCES usuarios(id),
    reportado_id    INT NOT NULL REFERENCES usuarios(id),
    motivo          VARCHAR(100),
    descripcion     TEXT,
    estado          VARCHAR(20) DEFAULT 'pendiente',
    accion_tomada   VARCHAR(100),
    createdat       TIMESTAMP DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- DATOS INICIALES — Categorías
-- ─────────────────────────────────────────────
INSERT INTO categorias (nombre, descripcion, icono) VALUES
    ('Plomería',     'Instalaciones y reparaciones de tuberías y grifería',  'wrench'),
    ('Electricidad', 'Instalaciones eléctricas domiciliarias y comerciales', 'zap'),
    ('Carpintería',  'Muebles a medida y restauración de madera',            'home'),
    ('Pintura',      'Trabajos de pintura interior y exterior',              'brush'),
    ('Albañilería',  'Construcción, remodelación y acabados',                'layers'),
    ('Cerrajería',   'Cerraduras, seguridad y accesos',                      'key'),
    ('Jardinería',   'Diseño y mantenimiento de áreas verdes',               'leaf')
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────
-- USUARIO ADMIN POR DEFECTO
-- password: Admin2026!
-- ─────────────────────────────────────────────
INSERT INTO usuarios (nombre, apellido, email, password_hash, es_trabajador, es_cliente, verificado, email_verificado)
VALUES ('Admin', 'Sistema', 'admin@oficiosya.com',
        '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
        FALSE, FALSE, TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;

-- ✅ Base de datos lista
SELECT 'Base de datos oficiosya_db lista ✅' AS estado;
