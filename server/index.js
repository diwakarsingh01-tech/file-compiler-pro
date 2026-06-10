const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { PDFDocument, rgb } = require('pdf-lib');

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

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

// --- API ENDPOINTS ---

// Excel Merge
app.post('/api/upload', upload.array('files'), (req, res) => {
    try {
        const compressionLevel = req.body.level || 'recommended';
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });

        let combinedData = [];
        let masterHeaders = null;
        let stats = { originalRows: 0, removedDuplicates: 0, removedEmpty: 0 };

        for (const file of req.files) {
            const workbook = xlsx.readFile(file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const headers = getHeaders(sheet);
            
            if (!masterHeaders) masterHeaders = headers;
            else if (JSON.stringify(headers) !== JSON.stringify(masterHeaders)) {
                req.files.forEach(f => fs.unlinkSync(f.path));
                return res.status(400).json({ error: `Header mismatch in ${file.originalname}` });
            }

            const data = xlsx.utils.sheet_to_json(sheet);
            stats.originalRows += data.length;

            let processedData = data;
            if (compressionLevel !== 'low') {
                processedData = data.filter(row => {
                    const isEmpty = !Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '');
                    if (isEmpty) stats.removedEmpty++;
                    return !isEmpty;
                }).map(row => {
                    const trimmedRow = {};
                    for (const key in row) trimmedRow[key] = typeof row[key] === 'string' ? row[key].trim() : row[key];
                    return trimmedRow;
                });
            }
            combinedData = combinedData.concat(processedData);
            fs.unlinkSync(file.path);
        }

        if (compressionLevel === 'extreme') {
            const initialCount = combinedData.length;
            combinedData = Array.from(new Set(combinedData.map(JSON.stringify))).map(JSON.parse);
            stats.removedDuplicates = initialCount - combinedData.length;
        }

        stats.finalRows = combinedData.length;
        const newWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWorkbook, xlsx.utils.json_to_sheet(combinedData), 'CombinedData');
        const fileName = `excel_merged_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, 'outputs', fileName);

        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        xlsx.writeFile(newWorkbook, filePath, { compression: true });

        res.json({ downloadUrl: `/api/download/${fileName}`, stats });
    } catch (error) {
        res.status(500).json({ error: 'Excel processing error' });
    }
});

// PDF Merge
app.post('/api/pdf/merge', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No files uploaded.' });
        const mergedPdf = await PDFDocument.create();
        let totalPages = 0;

        for (const file of req.files) {
            const pdf = await PDFDocument.load(fs.readFileSync(file.path));
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
            totalPages += pdf.getPageCount();
            fs.unlinkSync(file.path);
        }

        const fileName = `pdf_merged_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        fs.writeFileSync(filePath, await mergedPdf.save());
        res.json({ downloadUrl: `/api/download/${fileName}`, stats: { pages: totalPages } });
    } catch (error) {
        res.status(500).json({ error: 'PDF merge error' });
    }
});

// PDF Split
app.post('/api/pdf/split', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No file uploaded.' });
        const file = req.files[0];
        const pdf = await PDFDocument.load(fs.readFileSync(file.path));
        const totalPages = pdf.getPageCount();
        const zipFileName = `pdf_split_${Date.now()}.zip`;
        const zipPath = path.join(__dirname, 'outputs', zipFileName);

        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);

        for (let i = 0; i < totalPages; i++) {
            const singlePdf = await PDFDocument.create();
            const [copiedPage] = await singlePdf.copyPages(pdf, [i]);
            singlePdf.addPage(copiedPage);
            archive.append(Buffer.from(await singlePdf.save()), { name: `page_${i + 1}.pdf` });
        }
        await archive.finalize();
        fs.unlinkSync(file.path);
        output.on('close', () => res.json({ downloadUrl: `/api/download/${zipFileName}`, stats: { pages: totalPages } }));
    } catch (error) {
        res.status(500).json({ error: 'PDF split error' });
    }
});

// PDF Edit (Simplistic Backend Logic for Text Overlays)
app.post('/api/pdf/edit', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No file uploaded.' });
        const file = req.files[0];
        const modifications = JSON.parse(req.body.modifications || '[]');
        const pdfDoc = await PDFDocument.load(fs.readFileSync(file.path));
        const pages = pdfDoc.getPages();

        for (const mod of modifications) {
            const page = pages[mod.pageIndex];
            if (page && mod.type === 'text') {
                page.drawText(mod.text, { x: mod.x, y: mod.y, size: mod.size || 12, color: rgb(0,0,0) });
            }
        }

        const fileName = `pdf_edited_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        fs.writeFileSync(filePath, await pdfDoc.save());
        fs.unlinkSync(file.path);
        res.json({ downloadUrl: `/api/download/${fileName}`, stats: { pages: pages.length } });
    } catch (error) {
        res.status(500).json({ error: 'PDF edit error' });
    }
});

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'outputs', req.params.filename);
    if (fs.existsSync(filePath)) res.download(filePath, () => fs.unlinkSync(filePath));
    else res.status(404).send('File not found');
});

app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

app.listen(port, () => console.log(`Server running on port ${port}`));
