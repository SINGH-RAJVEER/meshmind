set shell := ["bash", "-lc"]
set dotenv-load
set export

alias i := install
alias tc := type-check

@default:
    just --list

install:
    bun install

dev:
    devenv up

build:
    bun run build

lint:
    bun run lint

format:
    bun run format

type-check:
    bun run type-check

clean:
    bun run clean

api-dev:
    cd apps/api && bun run dev

api-build:
    cd apps/api && bun run build

api-start:
    cd apps/api && bun run start

web-dev:
    cd apps/web && bun run dev

web-build:
    cd apps/web && bun run build

web-preview:
    cd apps/web && bun run preview

types-build:
    cd packages/types && bun run build

types-dev:
    cd packages/types && bun run dev

db-build:
    cd packages/database && bun run build

db-dev:
    cd packages/database && bun run dev

db-generate:
    bun run --filter=@meshmind/database db:generate

db-migrate:
    bun run --filter=@meshmind/database db:migrate

db-push:
    bun run --filter=@meshmind/database db:push

db-studio:
    bun run --filter=@meshmind/database db:studio
