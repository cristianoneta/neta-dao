# Build from repository root: docker build -f faucet/Dockerfile -t neta-junox-faucet .
FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY faucet/package*.json ./faucet/
COPY relay-backup/package*.json ./relay-backup/
RUN npm ci --prefix faucet --omit=dev --ignore-scripts && npm ci --prefix relay-backup --omit=dev --ignore-scripts
COPY faucet/service ./faucet/service
COPY faucet/src/transfer-fee.mjs ./faucet/src/transfer-fee.mjs
COPY relay-backup/*.mjs ./relay-backup/
COPY service ./service
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8787 FAUCET_DB=/data/faucet.sqlite
EXPOSE 8787
CMD ["node", "faucet/service/server.mjs"]
