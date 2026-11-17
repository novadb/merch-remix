# Nova Merchandising — Remix 3 demo. No build step: Node runs the TypeScript sources (`remix/node-tsx`), and the asset
# server compiles the browser modules on request.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY tsconfig.json server.ts ./
COPY app ./app
COPY public ./public
USER node
EXPOSE 3000
# NOVA_DELIVERY_URL/USER/PASSWORD, DEMO_BRANCH and SHOPIFY_* come from the environment (the platform's secrets)
CMD ["npm", "run", "start"]
