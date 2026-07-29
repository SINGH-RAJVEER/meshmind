{ pkgs, lib, config, ... }:

let
  postgresPackage = pkgs.postgresql_18.withPackages (extensions: [
    extensions.pgvector
  ]);

  localDatabaseEnv =
    "POSTGRES_HOST=localhost POSTGRES_PORT=5432 POSTGRES_DB=meshmind POSTGRES_USER=postgres POSTGRES_PASSWORD=postgres";
in
{
  dotenv.enable = true;

  packages = with pkgs; [
    bun
    nodejs_24
    just
    git
    curl
    postgresPackage
    nixd
    nil
  ];

  env = {
    PGDATA = lib.mkForce (config.env.DEVENV_STATE + "/postgres-18");
    POSTGRES_HOST = lib.mkDefault "localhost";
    POSTGRES_PORT = lib.mkDefault "5432";
    POSTGRES_DB = lib.mkDefault "meshmind";
    POSTGRES_USER = lib.mkDefault "postgres";
    POSTGRES_PASSWORD = lib.mkDefault "postgres";

    PORT = lib.mkDefault "8000";
    BACKEND_URL = lib.mkDefault "http://localhost:8000";
    FRONTEND_URL = lib.mkDefault "http://localhost:5173";
    VITE_API_URL = lib.mkDefault "http://localhost:8000";
  };

  services.postgres = {
    enable = true;
    package = postgresPackage;
    port = 5432;
    listen_addresses = "127.0.0.1";

    hbaConf = ''
      local all all trust
      host all all 127.0.0.1/32 trust
      host all all ::1/128 trust
    '';

    initialDatabases = [
      {
        name = "meshmind";
        user = "postgres";
        initialSQL = ''
          CREATE EXTENSION IF NOT EXISTS vector;
        '';
      }
    ];
  };

  processes = {
    db-migrate = {
      exec = "${localDatabaseEnv} bun run --filter=@meshmind/database db:migrate";

      process-compose = {
        depends_on.postgres.condition = "process_healthy";
      };
    };

    api = {
      exec = "${localDatabaseEnv} PORT=8000 BACKEND_URL=http://localhost:8000 FRONTEND_URL=http://localhost:5173 bun run --filter=@meshmind/api dev";

      process-compose = {
        depends_on."db-migrate".condition = "process_completed_successfully";

        readiness_probe = {
          http_get = {
            host = "127.0.0.1";
            port = 8000;
            path = "/health";
          };

          initial_delay_seconds = 2;
          period_seconds = 5;
          timeout_seconds = 2;
          success_threshold = 1;
          failure_threshold = 12;
        };
      };
    };

    web = {
      exec = "cd apps/web && VITE_API_URL=http://localhost:8000 bun run dev -- --host 127.0.0.1 --port 5173";

      process-compose = {
        depends_on.api.condition = "process_healthy";

        readiness_probe = {
          http_get = {
            host = "127.0.0.1";
            port = 5173;
            path = "/";
          };

          initial_delay_seconds = 2;
          period_seconds = 5;
          timeout_seconds = 2;
          success_threshold = 1;
          failure_threshold = 12;
        };
      };
    };
  };
}
