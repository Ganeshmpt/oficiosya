const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Storage para fotos de perfil
const storagePerfil = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'oficiosya/perfiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  },
});

// Storage para documentos de verificación
const storageVerificacion = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'oficiosya/verificaciones',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
    resource_type: 'auto',
  },
});

// Storage para imágenes de solicitudes
const storageSolicitud = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'oficiosya/solicitudes',
    allowed_formats: ['jpg', 'jpeg', 'png'],
    transformation: [{ width: 800, quality: 'auto' }],
  },
});

const uploadPerfil       = multer({ storage: storagePerfil,       limits: { fileSize: 5 * 1024 * 1024 } });
const uploadVerificacion = multer({ storage: storageVerificacion, limits: { fileSize: 10 * 1024 * 1024 } });
const uploadSolicitud    = multer({ storage: storageSolicitud,     limits: { fileSize: 5 * 1024 * 1024 } });

module.exports = { cloudinary, uploadPerfil, uploadVerificacion, uploadSolicitud };
