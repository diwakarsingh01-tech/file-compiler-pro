# File Compiler Pro

A robust, full-stack web application to merge multiple Excel and CSV files with identical headers into a single consolidated report.

## 🚀 Features
- **Smart Merging:** Combines `.xlsx` and `.csv` files effortlessly.
- **Header Validation:** Ensures data integrity by checking column consistency.
- **Privacy First:** Automatic cleanup—files are deleted from the server immediately after download.
- **Corporate UI:** Clean, high-contrast interface designed for professional use.

## 🛠️ Tech Stack
- **Frontend:** React, Vite, Lucide Icons
- **Backend:** Node.js, Express, Multer, SheetJS (XLSX)

## 📦 Setup & Deployment
1. **Local Run:** 
   - Backend: `cd server && npm install && node index.js`
   - Frontend: `cd client && npm install && npm run dev`
2. **Deployment:** Optimized for one-click deployment on platforms like Render or Heroku.

## 🔒 Security
No data is stored. Uploaded files are processed in memory and deleted instantly after the merge and download process is complete.
