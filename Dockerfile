# Preview y pilotos locales. NO implica certificación para producción ni procesamiento de pagos reales.
FROM node:24-alpine
WORKDIR /app
COPY package.json ./
COPY server ./server
COPY web ./web
RUN mkdir -p /app/data && chown -R node:node /app/data
ENV PORT=3300 HOST=0.0.0.0 NODE_ENV=production DB_FILE=/app/data/atry-turnos.sqlite
USER node
VOLUME ["/app/data"]
EXPOSE 3300
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3300/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.js"]
