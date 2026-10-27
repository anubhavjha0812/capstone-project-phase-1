import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { heartScraper } from '../controllers/pdf.controller.js';
import { diabetesScraper } from '../controllers/pdf.controller.js';
import { verifyJWT } from '../middlewares/auth.middleware.js';

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // Unique name so two uploads of "report.pdf" at once don't overwrite each other
        cb(null, `${Date.now()}-${path.basename(file.originalname)}`);
    },
});

const upload = multer({ storage });

// Report reading is only for logged-in users (verifyJWT runs before the upload is saved)
router.post('/heart-scraper', verifyJWT, upload.single('pdfFile'), heartScraper);

// Route for diabetes prediction
router.post('/diabetes-scraper', verifyJWT, upload.single('pdfFile'), diabetesScraper);

export default router;
