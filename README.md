# Statement Expense Tracker

A local expense tracker that combines a static frontend dashboard with a FastAPI backend for parsing bank statement PDFs.

## Project Structure

```text
statement-expense-tracker/
|-- frontend/
|   |-- index.html
|   |-- charts.html
|   |-- script.js
|   |-- charts.js
|   `-- styles.css
|-- backend/
|   |-- main.py
|   |-- requirements.txt
|   `-- README.txt
|-- start_frontend.bat
|-- start_backend.bat
|-- start_all.bat
`-- README.md
```

## Features

- Upload one or more bank statement PDFs from the browser
- Parse transactions through a local FastAPI backend
- Filter transactions by search, type, and category
- View live totals for visible rows
- Open a separate charts page based on the filtered dataset
- Use a dedicated SBI parser with a generic fallback for other banks

## Tech Stack

- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Python, FastAPI, Uvicorn, PyPDF

## Local Setup

### 1. Install backend dependencies

```powershell
cd backend
pip install -r requirements.txt
```

### 2. Start the project

Option A: start both services

```powershell
.\start_all.bat
```

Option B: start them separately

```powershell
.\start_backend.bat
.\start_frontend.bat
```

### 3. Open the app

Open:

```text
http://127.0.0.1:8000/index.html
```

The backend runs at:

```text
http://127.0.0.1:8001
```

## API Endpoints

- `GET /api/health`
- `GET /api/parser-summary`
- `POST /api/parse-statements`

## Notes

- The frontend expects the backend at `http://127.0.0.1:8001`.
- Multiple PDF uploads are supported.
- Scanned image-only PDFs are not OCR-processed yet.
- Sample PDFs are ignored by git and are not committed to the repository.
