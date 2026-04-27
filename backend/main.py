from __future__ import annotations

import re
from io import BytesIO
from typing import Any

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pypdf import PdfReader

app = FastAPI(title="Expense Tracker Parser API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATE_RE = re.compile(r"^\d{2}/\d{2}/\d{4}\s+\d{2}/\d{2}/\d{4}$")
GENERIC_DATE_RE = re.compile(r"\b(\d{2}[/-]\d{2}[/-]\d{2,4}|\d{4}[/-]\d{2}[/-]\d{2})\b")
AMOUNT_RE = re.compile(r"-?\d[\d,]*\.\d{2}")


class ParseResponse(BaseModel):
    files: list[dict[str, Any]]
    transactions: list[dict[str, Any]]
    total_transactions: int


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/parser-summary")
def parser_summary() -> dict[str, Any]:
    return {
        "supported_banks": ["sbi", "generic"],
        "features": ["multiple_files", "bank_detection", "normalized_transactions"],
    }


@app.post("/api/parse-statements", response_model=ParseResponse)
async def parse_statements(files: list[UploadFile] = File(...)) -> ParseResponse:
    parsed_files: list[dict[str, Any]] = []
    merged_transactions: list[dict[str, Any]] = []

    for upload in files:
        payload = await upload.read()
        file_result = parse_pdf_bytes(payload, upload.filename or "statement.pdf")
        parsed_files.append(file_result)
        merged_transactions.extend(file_result["transactions"])

    merged_transactions.sort(key=lambda row: (row.get("date", ""), row.get("description", "")), reverse=True)
    return ParseResponse(files=parsed_files, transactions=merged_transactions, total_transactions=len(merged_transactions))



def parse_pdf_bytes(payload: bytes, filename: str) -> dict[str, Any]:
    reader = PdfReader(BytesIO(payload))
    raw_pages = [(page.extract_text() or "") for page in reader.pages]
    raw_text = "\n\n".join(raw_pages)
    lines = normalize_lines(raw_pages)

    bank = detect_bank(raw_text)
    transactions = parse_sbi_lines(lines) if bank == "sbi" else parse_generic_lines(lines)

    return {
        "filename": filename,
        "bank": bank,
        "pages": len(reader.pages),
        "characters_extracted": len(raw_text),
        "transactions": transactions,
        "preview": "\n".join(lines[:250]),
    }



def normalize_lines(pages: list[str]) -> list[str]:
    lines: list[str] = []
    for page_text in pages:
        for raw in page_text.splitlines():
            line = re.sub(r"\s+", " ", raw).strip()
            if not line:
                continue
            if re.match(r"^\d+Page no\.?$", line):
                continue
            lines.append(line)
    return lines



def detect_bank(raw_text: str) -> str:
    upper = raw_text.upper()
    if "STATE BANK OF INDIA" in upper or "SBI" in upper:
        return "sbi"
    return "generic"



def parse_sbi_lines(lines: list[str]) -> list[dict[str, Any]]:
    transactions: list[dict[str, Any]] = []
    i = 0

    while i < len(lines):
        if not DATE_RE.match(lines[i]):
            i += 1
            continue

        posting_date, value_date = lines[i].split()[:2]
        i += 1

        detail_lines: list[str] = []
        while i < len(lines) and not DATE_RE.match(lines[i]):
            candidate = lines[i]
            if candidate != "Balance":
                detail_lines.append(candidate)
            i += 1

        amount_index = next((idx for idx, value in enumerate(detail_lines) if looks_like_amount_line(value)), -1)
        if amount_index == -1:
            continue

        type_line = detail_lines[0] if detail_lines else "Transaction"
        description_lines = detail_lines[1:amount_index]
        parsed_amount = parse_sbi_amount_line(detail_lines[amount_index])
        if not parsed_amount:
            continue

        description = clean_description(description_lines) or type_line.title()
        transactions.append(
            {
                "date": normalize_date(posting_date),
                "value_date": normalize_date(value_date),
                "description": description,
                "category": guess_category(f"{type_line} {description}"),
                "type": parsed_amount["type"],
                "amount": parsed_amount["amount"],
                "balance": parsed_amount["balance"],
                "source": type_line,
            }
        )

    return dedupe_rows(transactions)



def looks_like_amount_line(line: str) -> bool:
    tokens = re.sub(r"\s+", " ", line).strip().split(" ")
    return len(tokens) == 4 and all(token == "-" or bool(AMOUNT_RE.fullmatch(token)) for token in tokens)



def parse_sbi_amount_line(line: str) -> dict[str, Any] | None:
    tokens = re.sub(r"\s+", " ", line).strip().split(" ")
    if len(tokens) != 4:
        return None

    _, debit_token, credit_token, balance_token = tokens
    balance = parse_amount(balance_token)

    if debit_token != "-":
        return {"type": "debit", "amount": parse_amount(debit_token), "balance": balance}
    if credit_token != "-":
        return {"type": "credit", "amount": parse_amount(credit_token), "balance": balance}
    return None



def clean_description(lines: list[str]) -> str:
    filtered: list[str] = []
    for line in lines:
        if re.match(r"^\d{10,}\s+AT\s+\d+", line):
            continue
        if re.match(r"^[A-Z ]{8,}$", line):
            continue
        filtered.append(line)
    return re.sub(r"\s+", " ", " ".join(filtered)).strip(" -")



def parse_generic_lines(lines: list[str]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    pending_date = ""

    for line in lines:
        date_match = GENERIC_DATE_RE.search(line)
        amounts = AMOUNT_RE.findall(line)

        if date_match:
            pending_date = normalize_date(date_match.group(1))

        if not pending_date or not amounts:
            continue

        amount_value = parse_amount(amounts[-1])
        description = line
        if date_match:
            description = description.replace(date_match.group(0), "")
        description = description.replace(amounts[-1], "").strip(" -")

        if not description:
            continue

        transaction_type = "credit" if re.search(r"\b(cr|credit|deposit|salary|refund|received)\b", line, re.I) else "debit"
        rows.append(
            {
                "date": pending_date,
                "description": description,
                "category": guess_category(description),
                "type": transaction_type,
                "amount": amount_value,
                "source": "generic",
            }
        )

    return dedupe_rows(rows)



def dedupe_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[tuple[Any, ...]] = set()
    deduped: list[dict[str, Any]] = []
    for row in rows:
        key = (row.get("date"), row.get("description"), row.get("type"), row.get("amount"))
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return deduped



def normalize_date(value: str) -> str:
    cleaned = value.replace("/", "-")
    if re.fullmatch(r"\d{4}-\d{2}-\d{2}", cleaned):
        return cleaned

    parts = cleaned.split("-")
    if len(parts) != 3:
        return value

    day, month, year = parts
    if len(year) == 2:
        year = f"20{year}"
    return f"{year}-{month.zfill(2)}-{day.zfill(2)}"



def parse_amount(token: str) -> float:
    return float(token.replace(",", ""))



def guess_category(text: str) -> str:
    lower = text.lower()
    rules = [
        ("Income", ["salary", "credit interest", "deposit", "refund", "imps/inward", "upi/cr"]),
        ("Food", ["swiggy", "zomato", "restaurant", "dinn", "food", "cafe"]),
        ("Transport", ["fuel", "uber", "ola", "metro", "cab", "auto", "train", "airport", "atm wdl"]),
        ("Groceries", ["supermarket", "grocery", "mart", "greenfie"]),
        ("Bills", ["electricity", "broadband", "recharge", "water", "insurance", "sbicard"]),
        ("Transfer", ["upi/dr", "upi/cr", "wdl tfr", "dep tfr", "imps", "neft"]),
        ("Cash", ["atm", "cash"]),
        ("Shopping", ["amazon", "flipkart", "paytm", "bharatpe"]),
    ]
    for category, keywords in rules:
        if any(keyword in lower for keyword in keywords):
            return category
    return "Uncategorized"
