variable "region" {
  description = <<-EOT
    AWS region to deploy into. Check Lightsail availability first: it is only
    offered in a subset of regions.
  EOT
  type        = string
}

variable "availability_zone" {
  description = "Availability zone inside the region, e.g. eu-west-2a. Must be one that Lightsail supports."
  type        = string
}

variable "domain_name" {
  description = <<-EOT
    Public hostname the app is served on, e.g. realmaths.example.com. Caddy uses it
    to obtain the TLS certificate, so it must resolve to the static IP before the
    first boot or certificate issuance will fail.

    No domain yet? 1-2-3-4.sslip.io resolves to the address 1.2.3.4, so you can use
    that as a stand-in while still getting real HTTPS.
  EOT
  type        = string
}

variable "key_pair_name" {
  description = <<-EOT
    Name of an existing Lightsail SSH key pair. These are created in the Lightsail
    console, not with the EC2 aws_key_pair resource - Lightsail key pairs are a
    separate concept and a Lightsail instance will not accept an EC2 one.
  EOT
  type        = string
}

variable "ssh_cidr" {
  description = <<-EOT
    CIDRs allowed to reach port 22. Find your address with `curl -4 ifconfig.me`
    and pass it as ["203.0.113.4/32"]. Do not use 0.0.0.0/0 here: SSH is the
    deployment path, so an open port 22 is the front door to the whole box.
  EOT
  type        = list(string)
}

variable "instance_name" {
  description = "Name for the Lightsail instance."
  type        = string
  default     = "realmaths"
}

variable "bundle_id" {
  description = <<-EOT
    Instance size. Now that the database is SQLite rather than Postgres on the same
    box, ~1 GB is enough for the JVM, Caddy and SQLite together; this is a step down
    from the 2 GB I suggested when Postgres shared the instance.

    Verify current ids and prices for your region with:
      aws lightsail get-bundles --region <region> \
        --query 'bundles[].{id:bundleId,ram:ramSizeInGb,cpu:cpuCount,price:price}'
  EOT
  type        = string
  default     = "micro_3_0" # roughly 1 GB RAM / 2 vCPU / 40 GB SSD
}

variable "blueprint_id" {
  description = <<-EOT
    Operating system image. Verify for your region with:
      aws lightsail get-blueprints --region <region> \
        --query 'blueprints[?type==`os`].blueprintId'
  EOT
  type        = string
  default     = "ubuntu_24_04"
}

variable "snapshot_time" {
  description = <<-EOT
    UTC time of the daily automatic snapshot, as HH:MM.

    This is the whole backup story. The SQLite database is a file on this instance,
    and Lightsail instances cannot assume an IAM role, so they cannot be given
    write access to S3. Snapshots are the supported mechanism.
  EOT
  type        = string
  default     = "03:00"
}
