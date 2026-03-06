import multer from 'multer'
import path from 'path'

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Log when multer determines destination
    try { console.log('multer.destination called for file:', file.originalname); } catch (e) {}
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now()
    const ext = path.extname(file.originalname)
    const name = path.basename(file.originalname, ext)
    const outName = `${timestamp}-${name}${ext}`
    try { console.log('multer.filename generated:', outName); } catch (e) {}
    cb(null, outName)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only image files are allowed'), false)
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
})

export default upload
