import os

from app.main import app


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.getenv("BACKEND_PORT", "8001")),
        debug=app.config.get("DEBUG", False),
    )
