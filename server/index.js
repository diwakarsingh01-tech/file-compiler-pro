const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());

// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../client/dist')));

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Utility to get headers from a worksheet
const getHeaders = (sheet) => {
    if (!sheet['!ref']) return [];
    const range = xlsx.utils.decode_range(sheet['!ref']);
    const headers = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell = sheet[xlsx.utils.encode_cell({ r: range.s.r, c: C })];
        headers.push(cell ? cell.v : null);
    }
    return headers;
};

app.post('/api/upload', upload.array('files'), (req, res) => {
    try {
        const compressionLevel = req.body.level || 'recommended'; // low, recommended, extreme
        
        if (!req.files || req.files.length === 0) {
            console.log('Upload attempt with no files.');
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        console.log(`Processing ${req.files.length} files with level: ${compressionLevel}`);
        let combinedData = [];
        let masterHeaders = null;
        let stats = {
            originalRows: 0,
            cleanedRows: 0,
            removedDuplicates: 0,
            removedEmpty: 0
        };

        for (const file of req.files) {
            console.log(`Reading file: ${file.originalname}`);
            const workbook = xlsx.readFile(file.path);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const headers = getHeaders(sheet);
            
            if (!masterHeaders) {
                masterHeaders = headers;
            } else {
                if (JSON.stringify(headers) !== JSON.stringify(masterHeaders)) {
                    req.files.forEach(f => { if(fs.existsSync(f.path)) fs.unlinkSync(f.path) });
                    return res.status(400).json({ 
                        error: `Header mismatch in file: ${file.originalname}` 
                    });
                }
            }

            const data = xlsx.utils.sheet_to_json(sheet);
            stats.originalRows += data.length;

            let processedData = data;

            if (compressionLevel === 'recommended' || compressionLevel === 'extreme') {
                // Filter out empty rows and trim strings
                processedData = data.filter(row => {
                    const values = Object.values(row);
                    const isEmpty = !values.some(val => val !== null && val !== undefined && String(val).trim() !== '');
                    if (isEmpty) stats.removedEmpty++;
                    return !isEmpty;
                }).map(row => {
                    const trimmedRow = {};
                    for (const key in row) {
                        if (typeof row[key] === 'string') {
                            trimmedRow[key] = row[key].trim();
                        } else {
                            trimmedRow[key] = row[key];
                        }
                    }
                    return trimmedRow;
                });
            }

            combinedData = combinedData.concat(processedData);
            if(fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }

        let finalData = combinedData;
        if (compressionLevel === 'extreme') {
            const initialCount = combinedData.length;
            finalData = Array.from(new Set(combinedData.map(JSON.stringify))).map(JSON.parse);
            stats.removedDuplicates = initialCount - finalData.length;
        }

        stats.finalRows = finalData.length;

        const newWorkbook = xlsx.utils.book_new();
        const newSheet = xlsx.utils.json_to_sheet(finalData);
        xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'CombinedData');

        const fileName = `${compressionLevel}_merged_${Date.now()}.xlsx`;
        const outputsDir = path.join(__dirname, 'outputs');
        const filePath = path.join(outputsDir, fileName);

        if (!fs.existsSync(outputsDir)) {
            fs.mkdirSync(outputsDir);
        }

        xlsx.writeFile(newWorkbook, filePath, { compression: true });
        console.log(`Optimized merged file created: ${fileName}`, stats);

        res.json({ 
            message: 'Files processed successfully', 
            downloadUrl: `/api/download/${fileName}`,
            preview: finalData.slice(0, 5),
            stats: stats
        });

    } catch (error) {
        console.error('Processing error:', error);
        res.status(500).json({ error: 'An error occurred during processing.' });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'outputs', req.params.filename);
    if (fs.existsSync(filePath)) {
        res.download(filePath, (err) => {
            if (!err) {
                // AUTO-CLEANUP: Delete the file after download is complete
                fs.unlink(filePath, (unlinkErr) => {
                    if (unlinkErr) console.error('Cleanup error:', unlinkErr);
                });
            }
        });
    } else {
        res.status(404).json({ error: 'File not found.' });
    }
});

// Handle React routing, return all requests to React app
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
