.PHONY: up down logs migrate backend-shell init-frontend

up:
	docker compose up --build

down:
	docker compose down

logs:
	docker compose logs -f --tail=100

migrate:
	docker compose run --rm backend alembic upgrade head

backend-shell:
	docker compose run --rm backend sh

init-frontend:
	./infra/scripts/init-angular.sh
