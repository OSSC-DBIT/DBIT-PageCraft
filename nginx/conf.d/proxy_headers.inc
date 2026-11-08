# Headers forwarded to the Node app. The app reads X-Forwarded-* when
# TRUST_PROXY=1 (set by docker-compose.yml) for client IPs and https detection.
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header X-Forwarded-Host  $host;
proxy_read_timeout    60s;
proxy_connect_timeout 10s;
