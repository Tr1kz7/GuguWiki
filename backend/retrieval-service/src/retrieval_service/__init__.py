def main() -> None:
    import uvicorn

    from retrieval_service.config import Settings

    settings = Settings()
    uvicorn.run("retrieval_service.app:app", host=settings.host, port=settings.port)
