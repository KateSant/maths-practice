output "static_ip" {
  description = "Point the DNS A record for your domain at this address."
  value       = aws_lightsail_static_ip.app.ip_address
}

output "ssh_command" {
  description = "How to reach the instance for the bootstrap step."
  value       = "ssh -i <path-to-private-key> ubuntu@${aws_lightsail_static_ip.app.ip_address}"
}

output "deploy_target" {
  description = "Repository variable SITE_ADDRESS, then the https:// prefix, for the deploy workflow's smoke test."
  value       = var.domain_name
}

output "next_steps" {
  description = "What to do after apply."
  value       = <<-EOT
    1. Create a DNS A record: ${var.domain_name} -> ${aws_lightsail_static_ip.app.ip_address}
       Wait for it to resolve before the first deploy, or Caddy cannot get a certificate.

    2. Bootstrap the host:
         ssh -i <private-key> ubuntu@${aws_lightsail_static_ip.app.ip_address} 'bash -s' < scripts/bootstrap-host.sh

    3. GitHub repository settings:
         variable SITE_ADDRESS = https://${var.domain_name}
         secret   DEPLOY_HOST  = ${aws_lightsail_static_ip.app.ip_address}
         secret   DEPLOY_USER  = ubuntu
         secret   DEPLOY_SSH_KEY  = the private key matching the Lightsail key pair
         secret   DEPLOY_HOST_KEY = output of: ssh-keyscan -H ${aws_lightsail_static_ip.app.ip_address}

    4. Push to main. The deploy job's guard turns on once SITE_ADDRESS is set.
  EOT
}
