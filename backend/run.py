import os

from app.main import app


if __name__ == "__main__":
    port = int(os.getenv("PORT", os.getenv("BACKEND_PORT", "8001")))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug,
    )
