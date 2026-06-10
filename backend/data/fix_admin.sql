
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='usuarios' AND column_name='is_admin'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN is_admin BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Actualizar/crear admin con hash correcto de Admin2026!
INSERT INTO usuarios (nombre, apellido, email, password_hash, es_trabajador, es_cliente, is_admin, verificado, email_verificado, activo)
VALUES (
  'Admin', 'Sistema', 'admin@oficiosya.com',
  '$2a$12$J6ukB1PvIhMH/53Ep0Mdx.NCpvX8ml0khFOpylPHjlVm74qSpdk0.',
  FALSE, FALSE, TRUE, TRUE, TRUE, TRUE
)
ON CONFLICT (email) DO UPDATE SET
  password_hash    = '$2a$12$J6ukB1PvIhMH/53Ep0Mdx.NCpvX8ml0khFOpylPHjlVm74qSpdk0.',
  is_admin         = TRUE,
  verificado       = TRUE,
  email_verificado = TRUE,
  activo           = TRUE,
  bloqueado        = FALSE,
  suspendido       = FALSE;

SELECT id, nombre, email, is_admin, activo FROM usuarios WHERE email = 'admin@oficiosya.com';

-- Si el resultado muestra is_admin = true, el admin está listo
