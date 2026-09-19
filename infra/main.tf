provider "aws" {
  region = var.region
}

# Registers your own public key rather than letting Lightsail generate a pair.
# A generated pair would put its private half into Terraform state, which lives in
# S3; supplying only the public key keeps the private half on your machine alone.
resource "aws_lightsail_key_pair" "app" {
  name       = var.instance_name
  public_key = var.ssh_public_key
}

# A single instance runs Caddy, the API, and SQLite. No load balancer (the Lightsail
# one alone costs more than the instance), no managed database, and nothing
# serverless, so there are no cold starts to reason about.
resource "aws_lightsail_instance" "app" {
  name              = var.instance_name
  availability_zone = var.availability_zone
  blueprint_id      = var.blueprint_id
  bundle_id         = var.bundle_id
  key_pair_name     = aws_lightsail_key_pair.app.name
  ip_address_type   = "ipv4"

  # Daily snapshot of the whole instance, which is what protects the SQLite file.
  add_on {
    type          = "AutoSnapshot"
    snapshot_time = var.snapshot_time
    status        = "Enabled"
  }

  tags = {
    Project = "realmaths"
  }
}

resource "aws_lightsail_static_ip" "app" {
  name = "${var.instance_name}-ip"
}

# Without this attachment the address is released when the instance stops, so the
# DNS record and the TLS certificate would both break. It also has to stay attached
# permanently: an unattached Lightsail static IP is billed by the hour.
resource "aws_lightsail_static_ip_attachment" "app" {
  static_ip_name = aws_lightsail_static_ip.app.name
  instance_name  = aws_lightsail_instance.app.name
}

resource "aws_lightsail_instance_public_ports" "app" {
  instance_name = aws_lightsail_instance.app.name

  port_info {
    protocol  = "tcp"
    from_port = 80
    to_port   = 80
    cidrs     = ["0.0.0.0/0"]
  }

  # Caddy needs 443 reachable for both HTTPS and the ACME challenge.
  port_info {
    protocol  = "tcp"
    from_port = 443
    to_port   = 443
    cidrs     = ["0.0.0.0/0"]
  }

  port_info {
    protocol  = "tcp"
    from_port = 22
    to_port   = 22
    cidrs     = var.ssh_cidr
  }

  # Explicit, because the provider has a long-standing bug where this resource is
  # applied before the instance exists, which makes the apply fail part way through.
  depends_on = [aws_lightsail_instance.app]
}
