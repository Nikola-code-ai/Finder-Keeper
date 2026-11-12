"""One-off set-up of an Aurora PostgreSQL express cluster for Finder-Keeper (run by infra/aws/deploy.sh).

Connects with IAM tokens: first as the cluster's admin user to create a least-privilege application role,
its database and the pgvector extension, then as that role to create the schema.

    AWS_REGION=us-east-2 DB_HOST=<cluster endpoint> python -m app.aws_bootstrap
"""
import os
import re

import boto3
import certifi
import psycopg

ADMIN_USER = os.environ.get("DB_ADMIN_USER", "postgres")
APP_USER = os.environ.get("DB_APP_USER", "finder_keeper")
APP_DB = os.environ.get("DB_NAME", "finder_keeper")
HOST = os.environ["DB_HOST"]
REGION = os.environ["AWS_REGION"]


def connect(user, dbname):
    token = boto3.client("rds", region_name=REGION).generate_db_auth_token(DBHostname=HOST, Port=5432, DBUsername=user)
    return psycopg.connect(host=HOST, port=5432, user=user, dbname=dbname, password=token,
                           sslmode="verify-full", sslrootcert=certifi.where(), connect_timeout=60, autocommit=True)


def main():
    for name in (APP_USER, APP_DB):
        if not re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", name):
            raise SystemExit(f"Unsafe identifier: {name}")
    with connect(ADMIN_USER, "postgres") as admin:
        if not admin.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (APP_USER,)).fetchone():
            admin.execute(f"CREATE ROLE {APP_USER} LOGIN")
        admin.execute(f"GRANT rds_iam TO {APP_USER}")
        if not admin.execute("SELECT 1 FROM pg_database WHERE datname = %s", (APP_DB,)).fetchone():
            admin.execute(f"GRANT {APP_USER} TO {ADMIN_USER}")
            admin.execute(f"CREATE DATABASE {APP_DB} OWNER {APP_USER}")
    with connect(ADMIN_USER, APP_DB) as admin:
        admin.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # The application modules read their settings at import time.
    os.environ.update({
        "DATABASE_URL": f"postgresql://{APP_USER}@{HOST}:5432/{APP_DB}?sslmode=verify-full",
        "DB_IAM_AUTH": "true",
    })
    from .database import init_db
    init_db()
    print(f"Schema ready in {APP_DB} for IAM role {APP_USER}.")


if __name__ == "__main__":
    main()
