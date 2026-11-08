# Shared proxy rules for DBIT PageCraft (included by default.conf / tls.conf)

# Health endpoint: no access log noise from the Docker healthcheck.
location = /api/health {
    access_log off;
    proxy_pass http://pagecraft_app;
    include /etc/nginx/conf.d/proxy_headers.inc;
}

# JSON API: never cached, rate limited.
location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://pagecraft_app;
    include /etc/nginx/conf.d/proxy_headers.inc;
    add_header Cache-Control "no-store" always;
}

# Everything else: the static PWA served by the Node app.
location / {
    proxy_pass http://pagecraft_app;
    include /etc/nginx/conf.d/proxy_headers.inc;
}
