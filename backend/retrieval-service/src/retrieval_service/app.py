from fastapi import FastAPI


app = FastAPI(title="GuguWiki Retrieval Service", version="0.1.0")


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    return {"status": "ok", "service": "retrieval-service"}
