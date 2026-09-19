terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State is local for now. It holds the static IP and resource ids and nothing
  # secret, but if you lose it Terraform no longer knows what it manages. Because
  # Lightsail resources are all visible and editable in the console, recovery is a
  # matter of `terraform import` rather than starting over. Moving to a remote
  # backend (S3 with a manually created bucket, or Terraform Cloud's free tier) is
  # worth doing once this stops being a single-person experiment.
}
