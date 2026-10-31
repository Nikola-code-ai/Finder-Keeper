locals {
  services = toset([
    "aiplatform.googleapis.com", "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com", "cloudtasks.googleapis.com", "firebase.googleapis.com",
    "iam.googleapis.com", "iamcredentials.googleapis.com", "identitytoolkit.googleapis.com",
    "run.googleapis.com", "secretmanager.googleapis.com", "sqladmin.googleapis.com",
    "storage.googleapis.com",
  ])
  identities = toset(["frontend", "api", "worker", "tasks"])
}

resource "google_project_service" "enabled" {
  for_each           = local.services
  service            = each.key
  disable_on_destroy = false
}

data "google_project" "current" {}

resource "google_artifact_registry_repository" "images" {
  location      = var.region
  repository_id = var.prefix
  description   = "Finder-Keeper application containers"
  format        = "DOCKER"
  depends_on    = [google_project_service.enabled]
}

resource "google_service_account" "runtime" {
  for_each     = local.identities
  account_id   = "${var.prefix}-${each.key}"
  display_name = "Finder-Keeper ${each.key}"
  depends_on   = [google_project_service.enabled]
}

resource "google_storage_bucket" "library" {
  name                        = "${var.project_id}-${var.prefix}-library"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  # Originals are retained until the owner deletes them through the application.
  # A lifecycle rule must never silently expire the user's actual library.
  soft_delete_policy {
    retention_duration_seconds = 604800
  }
  lifecycle {
    prevent_destroy = true
  }
  depends_on = [google_project_service.enabled]
}

resource "google_storage_bucket_iam_member" "library_runtime" {
  for_each = toset(["api", "worker"])
  bucket   = google_storage_bucket.library.name
  role     = "roles/storage.objectUser"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_sql_database_instance" "library" {
  name                = "${var.prefix}-postgres"
  region              = var.region
  database_version    = "POSTGRES_16"
  deletion_protection = true
  settings {
    tier              = var.database_tier
    edition           = "ENTERPRISE"
    availability_type = "ZONAL"
    disk_size         = 10
    disk_type         = "PD_SSD"
    disk_autoresize   = false
    # Public IP is reachable only through the authenticated Cloud SQL connector;
    # no authorized_networks are configured.
    ip_configuration {
      ipv4_enabled = true
      ssl_mode     = "ENCRYPTED_ONLY"
    }
    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7
      backup_retention_settings {
        retained_backups = 7
      }
    }
    deletion_protection_enabled = true
  }
  lifecycle {
    prevent_destroy = true
  }
  depends_on = [google_project_service.enabled]
}

resource "google_sql_database" "library" {
  name     = "finder_keeper"
  instance = google_sql_database_instance.library.name
}

resource "random_password" "database" {
  length  = 40
  special = false
}

resource "google_sql_user" "application" {
  name     = "finder_keeper"
  instance = google_sql_database_instance.library.name
  password = random_password.database.result
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.prefix}-database-url"
  replication {
    auto {}
  }
  depends_on = [google_project_service.enabled]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql+psycopg://finder_keeper:${random_password.database.result}@/finder_keeper?host=/cloudsql/${google_sql_database_instance.library.connection_name}"
}

resource "google_secret_manager_secret_iam_member" "database_runtime" {
  for_each  = toset(["api", "worker"])
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "cloud_sql_runtime" {
  for_each = toset(["api", "worker"])
  project  = var.project_id
  role     = "roles/cloudsql.client"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_project_iam_member" "vertex_runtime" {
  for_each = toset(["api", "worker"])
  project  = var.project_id
  role     = "roles/aiplatform.user"
  member   = "serviceAccount:${google_service_account.runtime[each.key].email}"
}

resource "google_cloud_tasks_queue" "imports" {
  name     = "${var.prefix}-imports"
  location = var.region
  rate_limits {
    max_concurrent_dispatches = 2
    max_dispatches_per_second = 1
  }
  retry_config {
    max_attempts       = 5
    max_retry_duration = "0s"
    min_backoff        = "10s"
    max_backoff        = "300s"
    max_doublings      = 5
  }
  depends_on = [google_project_service.enabled]
}

resource "google_cloud_tasks_queue_iam_member" "api_enqueue" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_tasks_queue.imports.name
  role     = "roles/cloudtasks.enqueuer"
  member   = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_service_account_iam_member" "api_task_identity" {
  service_account_id = google_service_account.runtime["tasks"].name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.runtime["api"].email}"
}

resource "google_project_service_identity" "cloud_tasks" {
  provider   = google-beta
  project    = var.project_id
  service    = "cloudtasks.googleapis.com"
  depends_on = [google_project_service.enabled]
}

resource "google_service_account_iam_member" "task_token_creator" {
  service_account_id = google_service_account.runtime["tasks"].name
  role               = "roles/iam.serviceAccountTokenCreator"
  member             = "serviceAccount:${google_project_service_identity.cloud_tasks.email}"
}

resource "google_firebase_project" "library" {
  count      = var.enable_firebase_auth ? 1 : 0
  provider   = google-beta
  project    = var.project_id
  depends_on = [google_project_service.enabled]
}

resource "google_identity_platform_config" "library" {
  count   = var.enable_firebase_auth ? 1 : 0
  project = var.project_id
  sign_in {
    allow_duplicate_emails = false
    anonymous {
      enabled = false
    }
    email {
      enabled           = true
      password_required = true
    }
  }
  authorized_domains = distinct(concat([
    "${var.project_id}.firebaseapp.com", "${var.project_id}.web.app",
  ], var.auth_authorized_domains))
  depends_on = [google_firebase_project.library]
}

resource "google_firebase_web_app" "library" {
  count        = var.enable_firebase_auth ? 1 : 0
  provider     = google-beta
  project      = var.project_id
  display_name = "Finder-Keeper"
  depends_on   = [google_firebase_project.library]
}

data "google_firebase_web_app_config" "library" {
  count      = var.enable_firebase_auth ? 1 : 0
  provider   = google-beta
  web_app_id = google_firebase_web_app.library[0].app_id
}
