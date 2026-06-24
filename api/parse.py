from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse
import pymupdf4llm
import tempfile
import os

app = FastAPI()

@app.post("/api/parse")
async def parse_pdf(file: UploadFile = File(...)):
    try:
        # Save uploaded file to a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_pdf:
            content = await file.read()
            temp_pdf.write(content)
            temp_pdf_path = temp_pdf.name
        
        # Use PyMuPDF4LLM to extract markdown
        md_text = pymupdf4llm.to_markdown(temp_pdf_path)
        
        # Clean up
        if os.path.exists(temp_pdf_path):
            try:
                os.remove(temp_pdf_path)
            except Exception:
                pass
        
        return {"markdown": md_text}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})
