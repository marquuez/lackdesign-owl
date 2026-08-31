FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache su-exec

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY server ./server
COPY index.html anbieter.html admin.html ./
COPY styles.css intake.css main.js anbieter.js admin.js ./
COPY assets ./assets
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=8080
ENV LACKDESIGN_UPLOAD_DIR=/data/uploads

EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.js"]
