# Code Style and Conventions
- Follow standard Python (PEP 8) for backend.
- Use `asyncio` for asynchronous operations.
- Logging is centralized in `src/core/config.py` and used via `logging.getLogger(__name__)`.
- Component instantiation is handled by `ParceraComponentFactory` in `src/core/factory.py`.
- Frontend uses React with TypeScript and Vite.
