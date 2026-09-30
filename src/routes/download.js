import express from 'express'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const router = express.Router()

// Convert __dirname untuk ES Modules
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Folder file export
const EXPORT_FOLDER = path.join(__dirname, '../../public/export')

router.get('/download/chrome/:filename', (req, res) => {
  const filename = req.params.filename
  const filePath = path.join(EXPORT_FOLDER, filename)

  console.log('Request download file:', filename);
  

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File tidak ditemukan' })
  }

  res.download(filePath, filename, err => {
    if (err) {
      console.error('Gagal mengirim file:', err)
      res.status(500).json({ message: 'Gagal mengirim file' })
    }
  })
})

export default router
