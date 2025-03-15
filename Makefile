setup:
	mise install
	npm ci

start:
	docker compose up -d

clean:
	docker compose down