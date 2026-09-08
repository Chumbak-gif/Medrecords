"""
Uvicorn startup script.

Usage:
    python run.py               # production-like (no reload) — uses src.main (clean architecture)
    python run.py --dev         # development mode with auto-reload
    python run.py --legacy      # use legacy app.main module

Or use uvicorn directly:
    uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
"""
import argparse
import uvicorn


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the MEDRecords API server")
    parser.add_argument(
        "--dev",
        action="store_true",
        help="Enable auto-reload for development",
    )
    parser.add_argument(
        "--legacy",
        action="store_true",
        help="Use the legacy app.main module instead of src.main",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Bind host (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Bind port (default: 8000)")
    args = parser.parse_args()

    app_module = "app.main:app" if args.legacy else "src.main:app"

    uvicorn.run(
        app_module,
        host=args.host,
        port=args.port,
        reload=args.dev,
        log_level="info",
    )


if __name__ == "__main__":
    main()
