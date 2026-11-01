# Separate service: no faucet key, encrypted message backup or collector data mounts.
FROM node:24.19.0-bookworm-slim
WORKDIR /app
COPY relay-backup/package*.json ./relay-backup/
RUN npm ci --prefix relay-backup --omit=dev --ignore-scripts
COPY relay-backup/auth.mjs ./relay-backup/auth.mjs
COPY service ./service
COPY *.mjs ./
COPY names/*.mjs ./names/
COPY names/service/constants.mjs ./names/service/constants.mjs
COPY src/governance/comments.mjs ./src/governance/comments.mjs
COPY data/dao-directory.json ./data/dao-directory.json
COPY docs/deployments/nns-mainnet.json ./docs/deployments/nns-mainnet.json
COPY discussions/*.mjs ./discussions/
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8790 DISCUSSIONS_DB=/data/discussions.sqlite
EXPOSE 8790
CMD ["node", "discussions/server.mjs"]
