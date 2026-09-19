terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State lives in S3 because the pipeline runs Terraform on an ephemeral runner.
  # With local state, every run would believe it was creating the infrastructure for
  # the first time, and either fail or duplicate it.
  #
  # bucket and region are deliberately absent: a backend block cannot reference
  # variables or read a tfvars file, so both are supplied at init time with
  # -backend-config. See the Terraform job in .github/workflows/deploy.yml.
  backend "s3" {
    key     = "realmaths/terraform.tfstate"
    encrypt = true
    # S3-native locking, so no DynamoDB lock table is needed. Requires Terraform 1.10+.
    # If you ever run an older Terraform, delete this line and add a dynamodb_table.
    use_lockfile = true
  }
}
