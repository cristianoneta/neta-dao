FROM node:24-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY service ./service
RUN mkdir /data && chown node:node /data
USER node
ENV HOST=0.0.0.0 PORT=8787 FAUCET_DB=/data/faucet.sqlite
EXPOSE 8787
CMD ["node", "service/server.mjs"]
