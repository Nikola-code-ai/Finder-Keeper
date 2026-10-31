output "deployment" {
  description = "Non-secret values consumed by scripts/deploy-gcp.sh."
  value = {
    project_id              = var.project_id
    region                  = var.region
    prefix                  = var.prefix
    project_number          = data.google_project.current.number
    artifact_repository     = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.images.repository_id}"
    bucket                  = google_storage_bucket.library.name
    sql_connection          = google_sql_database_instance.library.connection_name
    database_secret         = google_secret_manager_secret.database_url.secret_id
    database_secret_version = google_secret_manager_secret_version.database_url.version
    task_queue              = google_cloud_tasks_queue.imports.id
    service_accounts        = { for key, account in google_service_account.runtime : key => account.email }
    firebase_api_key        = try(data.google_firebase_web_app_config.library[0].api_key, "")
    firebase_auth_domain    = try(data.google_firebase_web_app_config.library[0].auth_domain, "")
    firebase_app_id         = try(google_firebase_web_app.library[0].app_id, "")
  }
}
