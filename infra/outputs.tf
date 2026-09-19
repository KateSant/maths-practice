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
    1. Point DNS at the instance. Wait for it to resolve before the first deploy,
       or Caddy cannot complete the ACME challenge and you get no certificate:
         ${var.domain_name}  A  ${aws_lightsail_static_ip.app.ip_address}

    2. Bootstrap the host once (installs Docker, writes /srv/realmaths/.env).
       SITE_ADDRESS must be set inside the remote command, not on the local side
       of the pipe: a plain VAR=value prefix applies to ssh itself, so the script
       would never see it.
         ssh -i ~/.ssh/realmaths-deploy ubuntu@${aws_lightsail_static_ip.app.ip_address} \
           "SITE_ADDRESS=https://${var.domain_name} bash -s" < scripts/bootstrap-host.sh

    3. Pin the host key so the deploy cannot be redirected:
         ssh-keyscan -H ${aws_lightsail_static_ip.app.ip_address}
       and save it as the DEPLOY_HOST_KEY secret.

    4. Push to main. The Terraform and deploy jobs un-skip themselves once the
       SITE_DOMAIN repository variable is set.
  EOT
}
