import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import cloudinary from "../config/cloudinary.js";
 
// Cloudinary storage config
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "shopsphere_products", // folder in Cloudinary
    allowed_formats: ["jpg", "png", "jpeg", "webp", "gif"],
  },
});

// File filter (only images)
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

// Multer upload middleware
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

export default upload;
