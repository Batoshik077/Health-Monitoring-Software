.PHONY: install dev backend frontend test build

install:            ## установить зависимости бэкенда и фронтенда
	cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
	cd frontend && npm install

backend:            ## бэкенд на http://localhost:8000
	cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

frontend:           ## фронтенд на http://localhost:5173
	cd frontend && npm run dev

dev:                ## бэкенд и фронтенд вместе
	$(MAKE) -j2 backend frontend

test:               ## тесты бэкенда
	cd backend && .venv/bin/python -m pytest -q

build:              ## проверка типов и сборка фронтенда
	cd frontend && npm run build
