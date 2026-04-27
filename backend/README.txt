Expense Tracker Backend

Run order:
1. start_backend.bat
2. start_frontend.bat
3. Open http://127.0.0.1:8000/index.html

One-click option:
- start_all.bat

API endpoints:
- GET /api/health
- POST /api/parse-statements

Notes:
- Multiple PDF uploads are supported.
- SBI statements are parsed with a dedicated parser.
- Other banks currently use a generic fallback parser.
- Scanned image-only PDFs will need OCR in a later step.
