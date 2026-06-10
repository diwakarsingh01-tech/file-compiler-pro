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
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded.' });
        }

        let combinedData = [];
        let masterHeaders = null;

        for (const file of req.files) {
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
            combinedData = combinedData.concat(data);
            
            if(fs.existsSync(file.path)) fs.unlinkSync(file.path);
        }

        const newWorkbook = xlsx.utils.book_new();
        const newSheet = xlsx.utils.json_to_sheet(combinedData);
        xlsx.utils.book_append_sheet(newWorkbook, newSheet, 'CombinedData');

        const fileName = `merged_${Date.now()}.xlsx`;
        const outputsDir = path.join(__dirname, 'outputs');
        const filePath = path.join(outputsDir, fileName);

        if (!fs.existsSync(outputsDir)) {
            fs.mkdirSync(outputsDir);
        }

        xlsx.writeFile(newWorkbook, filePath);

        res.json({ 
            message: 'Files merged successfully', 
            downloadUrl: `/api/download/${fileName}`,
            preview: combinedData.slice(0, 5) 
        });

    } catch (error) {
        console.error(error);
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
