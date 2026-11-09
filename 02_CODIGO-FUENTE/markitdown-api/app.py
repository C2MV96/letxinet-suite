from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse
import os
import shutil
import tempfile
import pymupdf4llm

app = FastAPI(title="MarkItDown API", description="Convierte PDFs a Markdown usando PyMuPDF4LLM (motor de Microsoft MarkItDown)")


def parse_pages_spec(spec: str, total_pages: int):
    """Parse pages spec like '1-3', 'first5', 'last3', '1,3,5', 'all'."""
    if not spec or spec == 'all':
        return None  # all pages
    if spec.startswith('first'):
        n = int(spec[5:]) if spec[5:].isdigit() else 5
        return list(range(0, min(n, total_pages)))
    if spec.startswith('last'):
        n = int(spec[4:]) if spec[4:].isdigit() else 3
        return list(range(max(0, total_pages - n), total_pages))
    if ',' in spec:
        nums = []
        for s in spec.split(','):
            try:
                p = int(s.strip())
                if 1 <= p <= total_pages:
                    nums.append(p - 1)
            except ValueError:
                pass
        return nums
    if '-' in spec:
        parts = spec.split('-')
        if len(parts) == 2 and parts[0].isdigit() and parts[1].isdigit():
            a, b = int(parts[0]), int(parts[1])
            return list(range(max(1, a) - 1, min(total_pages, b)))
    if spec.isdigit():
        p = int(spec)
        return [p - 1] if 1 <= p <= total_pages else []
    return None  # fallback to all pages


@app.post("/convert")
async def convert_file(file: UploadFile = File(...), pages: str = Form("all")):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos PDF")
    
    temp_path = None
    try:
        # Save uploaded file to a temporary file
        fd, temp_path = tempfile.mkstemp(suffix=".pdf")
        with os.fdopen(fd, "wb") as temp_file:
            shutil.copyfileobj(file.file, temp_file)
        
        # Determine total pages for parsing the spec
        import pymupdf
        doc = pymupdf.open(temp_path)
        total_pages = doc.page_count
        doc.close()
        
        # Parse the pages spec
        page_list = parse_pages_spec(pages, total_pages)
        
        # Convert using PyMuPDF4LLM (with optional page filtering)
        kwargs = {}
        if page_list is not None:
            kwargs['pages'] = page_list
        
        markdown_text = pymupdf4llm.to_markdown(temp_path, **kwargs)
        
        # Cleanup
        os.remove(temp_path)
        temp_path = None
        
        return {
            "success": True,
            "markdown": markdown_text,
            "chars": len(markdown_text),
            "lines": markdown_text.count("\n"),
            "pages_requested": pages,
            "total_pages": total_pages,
        }
        
    except Exception as e:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
def read_root():
    return {
        "status": "online",
        "engine": "PyMuPDF4LLM",
        "message": "Envia POST /convert con form-data 'file' (PDF) y opcional 'pages' para obtener Markdown estructurado",
        "supported_pages_formats": "all, 1-5, first5, last3, 1,3,5, 7",
    }
