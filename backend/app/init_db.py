from .config import settings
from .database import init_db

if __name__ == "__main__":
    settings.validate_runtime()
    init_db()
    print("Finder-Keeper database is ready.")
