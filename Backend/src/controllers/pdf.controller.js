import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';
import { runPython } from '../utils/runPython.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.resolve(__dirname, '../DataScrapingScripts');

function deleteFile(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error('Error deleting PDF file:', err);
        }
    });
}

// Runs a scraping script on the uploaded PDF and returns the extracted JSON
const scrapePdf = (scriptName) =>
    asyncHandler(async (req, res) => {
        if (!req.file) {
            throw new ApiError(400, 'No PDF file uploaded');
        }

        const pdfPath = req.file.path;

        try {
            const result = await runPython(path.join(scriptsDir, scriptName), [pdfPath]);

            let extractedData;
            try {
                extractedData = JSON.parse(result.lastLine);
            } catch {
                extractedData = null;
            }

            if (result.code !== 0 || !extractedData) {
                console.error(
                    `[${scriptName}] failed (code ${result.code})\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
                );
                throw new ApiError(500, 'Error processing PDF');
            }

            return res.json(extractedData);
        } finally {
            // Delete the PDF file after processing
            deleteFile(pdfPath);
        }
    });

// Function to handle Heart Disease Report scraping
export const heartScraper = scrapePdf('scrapHeart.py');

// Function to handle Diabetes Report scraping
export const diabetesScraper = scrapePdf('scrapDiabetes.py');
