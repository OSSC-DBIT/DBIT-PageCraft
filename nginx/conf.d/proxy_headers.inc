# Headers forwarded to the Node app.
# X-Forwarded-For is REPLACED (not appended) with the resolved client address so
# a visitor cannot spoof their IP for rate limiting; the app runs with
# TRUST_PROXY=1 and trusts exactly this one hop.
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $remote_addr;
proxy_set_header X-Forwarded-Proto $forwarded_proto;
proxy_set_header X-Forwarded-Host  $host;
proxy_read_timeout    60s;
proxy_connect_timeout 10s;
