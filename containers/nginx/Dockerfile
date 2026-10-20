FROM nginx:1.28-alpine

RUN apk add --no-cache openssl
COPY nginx.conf /etc/nginx/nginx.conf
# Scripts in /docker-entrypoint.d/ run before nginx starts.
COPY generate-cert.sh /docker-entrypoint.d/40-generate-cert.sh
RUN chmod +x /docker-entrypoint.d/40-generate-cert.sh
