const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const muhammara = require('muhammara');
const sharp = require('sharp');

const app = express();
const port = process.env.PORT || 5005;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client/dist')));

const upload = multer({ dest: 'uploads/' });

// Utility to get headers
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
        if (!validateFiles(req, res)) return;
        const compressionLevel = req.body.level || 'recommended';
        let combinedData = [];
        let masterHeaders = null;
        let stats = { originalRows: 0, removedDuplicates: 0, removedEmpty: 0 };

        const sheetName = req.body.sheetName || null;
        for (const file of req.files) {
            const workbook = xlsx.readFile(file.path);
            const name = sheetName && workbook.SheetNames.includes(sheetName) ? sheetName : workbook.SheetNames[0];
            const sheet = workbook.Sheets[name];
            const headers = getHeaders(sheet);
            if (!masterHeaders) { masterHeaders = headers; }
            else if (JSON.stringify(headers) !== JSON.stringify(masterHeaders)) {
                req.files.forEach(f => { try { fs.unlinkSync(f.path); } catch(e) {} });
                return res.status(400).json({ error: `Header mismatch in file: ${file.originalname}` });
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

        const newWorkbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(newWorkbook, xlsx.utils.json_to_sheet(combinedData), 'Data');
        const fileName = `excel_${Date.now()}.xlsx`;
        const filePath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        xlsx.writeFile(newWorkbook, filePath, { compression: true });
        res.json({ downloadUrl: `/api/download/${fileName}`, stats });
    } catch (e) { res.status(500).json({ error: 'Excel Error' }); }
});

const validateFiles = (req, res, min = 1) => {
  if (!req.files || req.files.length === 0) { res.status(400).json({ error: 'No files uploaded.' }); return false; }
  if (req.files.length < min) { res.status(400).json({ error: `Need at least ${min} file(s).` }); return false; }
  return true;
};

const ensureOutputs = () => { if (!fs.existsSync('outputs')) fs.mkdirSync('outputs'); };

// Get Excel sheet names
app.post('/api/files/sheets', upload.single('file'), (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
        const workbook = xlsx.readFile(req.file.path);
        fs.unlinkSync(req.file.path);
        res.json({ sheets: workbook.SheetNames });
    } catch (e) { res.status(500).json({ error: 'Failed to read sheets' }); }
});

// PDF Merge
app.post('/api/pdf/merge', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res, 2)) return;
        const mergedPdf = await PDFDocument.create();
        for (const file of req.files) {
            const pdf = await PDFDocument.load(fs.readFileSync(file.path));
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(p => mergedPdf.addPage(p));
            fs.unlinkSync(file.path);
        }
        const fileName = `merged_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'outputs', fileName);
        ensureOutputs();
        fs.writeFileSync(filePath, await mergedPdf.save());
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Merge Error' }); }
});

// PDF Split
app.post('/api/pdf/split', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const file = req.files[0];
        const pdf = await PDFDocument.load(fs.readFileSync(file.path));
        const zipFileName = `split_${Date.now()}.zip`;
        const zipPath = path.join(__dirname, 'outputs', zipFileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        const output = fs.createWriteStream(zipPath);
        const { ZipArchive } = require('archiver');
        const archive = new ZipArchive();
        archive.pipe(output);
        for (let i = 0; i < pdf.getPageCount(); i++) {
            const single = await PDFDocument.create();
            const [page] = await single.copyPages(pdf, [i]);
            single.addPage(page);
            archive.append(Buffer.from(await single.save()), { name: `page_${i + 1}.pdf` });
        }
        output.on('close', () => {
            fs.unlinkSync(file.path);
            res.json({ downloadUrl: `/api/download/${zipFileName}` });
        });
        await archive.finalize();
    } catch (e) { res.status(500).json({ error: 'Split Error' }); }
});

// PDF Protect (Encryption)
app.post('/api/pdf/protect', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const password = req.body.password;
        if (!password) return res.status(400).json({ error: 'Password required' });
        const inputPath = req.files[0].path;
        const fileName = `protected_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

        muhammara.recrypt(inputPath, outputPath, {
            userPassword: password,
            ownerPassword: password,
            userProtectionFlag: 4 // printing
        });

        fs.unlinkSync(inputPath);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Protection Error' }); }
});

// PDF Unlock (Decryption)
app.post('/api/pdf/unlock', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const password = req.body.password;
        const inputPath = req.files[0].path;
        const fileName = `unlocked_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

        muhammara.recrypt(inputPath, outputPath, { password: password });

        fs.unlinkSync(inputPath);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Unlock Error. Check password.' }); }
});

// PDF Watermark
app.post('/api/pdf/watermark', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const text = req.body.watermark || 'CONFIDENTIAL';
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
            const { width, height } = page.getSize();
            page.drawText(text, {
                x: width / 4,
                y: height / 2,
                size: 50,
                font: helveticaFont,
                color: rgb(0.7, 0.7, 0.7),
                rotate: { type: 'degrees', angle: 45 },
                opacity: 0.3
            });
        });

        const fileName = `watermarked_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        fs.writeFileSync(outputPath, await pdfDoc.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Watermark Error' }); }
});

// PDF Sign
app.post('/api/pdf/sign', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const signText = req.body.signature || 'Signed';
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        const font = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
        const pages = pdfDoc.getPages();
        const lastPage = pages[pages.length - 1];
        
        lastPage.drawText(signText, {
            x: 50,
            y: 50,
            size: 24,
            font: font,
            color: rgb(0, 0, 0.5)
        });

        const fileName = `signed_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        fs.writeFileSync(outputPath, await pdfDoc.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Signing Error' }); }
});

// PDF Remove/Extract Pages
app.post(['/api/pdf/remove', '/api/pdf/extract'], upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const indices = JSON.parse(req.body.indices || '[]');
        const isExtract = req.path.includes('extract');
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        const newPdf = await PDFDocument.create();
        
        const allIndices = Array.from({ length: pdfDoc.getPageCount() }, (_, i) => i);
        const targetIndices = isExtract ? indices : allIndices.filter(i => !indices.includes(i));
        
        const copiedPages = await newPdf.copyPages(pdfDoc, targetIndices);
        copiedPages.forEach(p => newPdf.addPage(p));

        const fileName = `${isExtract ? 'extracted' : 'removed'}_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        fs.writeFileSync(outputPath, await newPdf.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Page Error' }); }
});

// PDF Rotate
app.post('/api/pdf/rotate', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const degree = parseInt(req.body.degree) || 90;
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        pdfDoc.getPages().forEach(p => p.setRotation({ type: 'degrees', angle: (p.getRotation().angle + degree) % 360 }));
        const fileName = `rotated_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        fs.writeFileSync(outputPath, await pdfDoc.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Rotate Error' }); }
});

// PDF Edit
app.post('/api/pdf/edit', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const modifications = JSON.parse(req.body.modifications || '[]');
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        const pages = pdfDoc.getPages();
        for (const mod of modifications) {
            const page = pages[mod.pageIndex];
            if (page && mod.type === 'text') {
                page.drawText(mod.text, { x: mod.x, y: mod.y, size: 14, color: rgb(0,0,0) });
            }
        }
        const fileName = `edited_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        fs.writeFileSync(outputPath, await pdfDoc.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Edit Error' }); }
});

// PDF Compress
app.post('/api/pdf/compress', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const pdfDoc = await PDFDocument.load(fs.readFileSync(req.files[0].path));
        const fileName = `compressed_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        ensureOutputs();
        fs.writeFileSync(outputPath, await pdfDoc.save());
        fs.unlinkSync(req.files[0].path);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Compress Error' }); }
});

// Convert: Excel/CSV to PDF
app.post('/api/pdf/convert-to', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const combinedData = [];
        for (const file of req.files) {
            const workbook = xlsx.readFile(file.path);
            const data = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
            combinedData.push(...data);
            fs.unlinkSync(file.path);
        }
        const pdfDoc = await PDFDocument.create();
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        let page = pdfDoc.addPage([612, 792]);
        let y = 750;
        const headers = combinedData.length > 0 ? Object.keys(combinedData[0]) : [];
        for (const row of combinedData) {
            if (y < 50) { page = pdfDoc.addPage([612, 792]); y = 750; }
            const line = headers.map(h => row[h] ?? '').join(' | ');
            page.drawText(line.substring(0, 100), { x: 50, y, size: 8, font });
            y -= 14;
        }
        const fileName = `converted_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        ensureOutputs();
        fs.writeFileSync(outputPath, await pdfDoc.save());
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Conversion Error' }); }
});

// Convert: PDF to Excel
app.post('/api/pdf/convert-from', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        // Extract text from PDF and create Excel
        const rows = [];
        for (const file of req.files) {
            const pdfDoc = await PDFDocument.load(fs.readFileSync(file.path));
            const pages = pdfDoc.getPages();
            pages.forEach((page, i) => rows.push({ page: i + 1, text: '(PDF text extraction placeholder)' }));
            fs.unlinkSync(file.path);
        }
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, xlsx.utils.json_to_sheet(rows), 'Data');
        const fileName = `extracted_${Date.now()}.xlsx`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        ensureOutputs();
        xlsx.writeFile(workbook, outputPath);
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Extraction Error' }); }
});

// Image to PDF
app.post('/api/pdf/images', upload.array('files'), async (req, res) => {
    try {
        if (!validateFiles(req, res)) return;
        const pdfDoc = await PDFDocument.create();
        for (const file of req.files) {
            const imgBuffer = fs.readFileSync(file.path);
            let image;
            if (file.mimetype === 'image/png') {
                image = await pdfDoc.embedPng(imgBuffer);
            } else {
                const pngBuf = await sharp(imgBuffer).png().toBuffer();
                image = await pdfDoc.embedPng(pngBuf);
            }
            const page = pdfDoc.addPage([image.width, image.height]);
            page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
            fs.unlinkSync(file.path);
        }
        const fileName = `images_${Date.now()}.pdf`;
        const outputPath = path.join(__dirname, 'outputs', fileName);
        ensureOutputs();
        fs.writeFileSync(outputPath, await pdfDoc.save());
        res.json({ downloadUrl: `/api/download/${fileName}`, pages: req.files.length });
    } catch (e) { res.status(500).json({ error: 'Image to PDF Error' }); }
});

// Batch download as ZIP
app.post('/api/batch/download', express.json(), async (req, res) => {
    try {
        const urls = req.body.urls;
        if (!urls || !urls.length) return res.status(400).json({ error: 'No files specified' });
        const zipFileName = `batch_${Date.now()}.zip`;
        const zipPath = path.join(__dirname, 'outputs', zipFileName);
        ensureOutputs();
        const output = fs.createWriteStream(zipPath);
        const { ZipArchive } = require('archiver');
        const archive = new ZipArchive();
        archive.pipe(output);
        for (const url of urls) {
            const name = url.split('/').pop();
            const filePath = path.join(__dirname, 'outputs', name);
            if (fs.existsSync(filePath)) {
                archive.append(fs.createReadStream(filePath), { name });
            }
        }
        output.on('close', () => res.json({ downloadUrl: `/api/download/${zipFileName}` }));
        archive.finalize();
    } catch (e) { res.status(500).json({ error: 'Batch Error' }); }
});

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'outputs', req.params.filename);
    if (fs.existsSync(filePath)) res.download(filePath, () => fs.unlinkSync(filePath));
    else res.status(404).send('Not Found');
});

app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

app.listen(port, () => console.log(`Server running on port ${port}`));
