variable "project_id" {
  description = "An existing, billing-enabled GCP project chosen by the owner. No project is created."
  type        = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{4,28}[a-z0-9]$", var.project_id))
    error_message = "Use an actual GCP project ID."
  }
}

variable "acknowledge_paid_cloud_resources" {
  description = "This optional foundation exceeds the current $20/month budget at its default database tier. Leave false for local development."
  type        = bool
  default     = false
  validation {
    condition     = var.acknowledge_paid_cloud_resources
    error_message = "Paid cloud resources are disabled. Use the local application; review the budget and set acknowledge_paid_cloud_resources=true only for a deliberately approved future deployment."
  }
}

variable "region" {
  type    = string
  default = "us-central1"
}

variable "prefix" {
  type    = string
  default = "finder-keeper"
  validation {
    condition     = can(regex("^[a-z][a-z0-9-]{2,18}$", var.prefix))
    error_message = "Use a lowercase prefix of 3 to 19 characters."
  }
}

variable "database_tier" {
  description = "Small personal library default. Shared-core instances have no Cloud SQL SLA."
  type        = string
  default     = "db-g1-small"
}

variable "enable_firebase_auth" {
  description = "Enable for a fresh project. Import existing Firebase resources before enabling on an existing Firebase project."
  type        = bool
  default     = true
}

variable "auth_authorized_domains" {
  description = "Additional frontend/custom domains permitted by Firebase Authentication."
  type        = list(string)
  default     = []
}
