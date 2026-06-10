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
        const compressionLevel = req.body.level || 'recommended';
        let combinedData = [];
        let masterHeaders = null;
        let stats = { originalRows: 0, removedDuplicates: 0, removedEmpty: 0 };

        for (const file of req.files) {
            const workbook = xlsx.readFile(file.path);
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const headers = getHeaders(sheet);
            if (!masterHeaders) masterHeaders = headers;
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

// PDF Merge
app.post('/api/pdf/merge', upload.array('files'), async (req, res) => {
    try {
        const mergedPdf = await PDFDocument.create();
        for (const file of req.files) {
            const pdf = await PDFDocument.load(fs.readFileSync(file.path));
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach(p => mergedPdf.addPage(p));
            fs.unlinkSync(file.path);
        }
        const fileName = `merged_${Date.now()}.pdf`;
        const filePath = path.join(__dirname, 'outputs', fileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        fs.writeFileSync(filePath, await mergedPdf.save());
        res.json({ downloadUrl: `/api/download/${fileName}` });
    } catch (e) { res.status(500).json({ error: 'Merge Error' }); }
});

// PDF Split
app.post('/api/pdf/split', upload.array('files'), async (req, res) => {
    try {
        const file = req.files[0];
        const pdf = await PDFDocument.load(fs.readFileSync(file.path));
        const zipFileName = `split_${Date.now()}.zip`;
        const zipPath = path.join(__dirname, 'outputs', zipFileName);
        if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        archive.pipe(output);
        for (let i = 0; i < pdf.getPageCount(); i++) {
            const single = await PDFDocument.create();
            const [page] = await single.copyPages(pdf, [i]);
            single.addPage(page);
            archive.append(Buffer.from(await single.save()), { name: `page_${i + 1}.pdf` });
        }
        await archive.finalize();
        fs.unlinkSync(file.path);
        output.on('close', () => res.json({ downloadUrl: `/api/download/${zipFileName}` }));
    } catch (e) { res.status(500).json({ error: 'Split Error' }); }
});

// PDF Protect (Encryption)
app.post('/api/pdf/protect', upload.array('files'), async (req, res) => {
    try {
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

app.get('/api/download/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'outputs', req.params.filename);
    if (fs.existsSync(filePath)) res.download(filePath, () => fs.unlinkSync(filePath));
    else res.status(404).send('Not Found');
});

app.get('/{*path}', (req, res) => res.sendFile(path.join(__dirname, '../client/dist/index.html')));

app.listen(port, () => console.log(`Server running on port ${port}`));
