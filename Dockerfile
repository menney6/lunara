FROM node:24-slim

WORKDIR /app

# Install dependencies first so source edits don't bust the layer cache.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NODE_ENV must stay unset here or `npm ci` above would have skipped
# devDependencies, which the build needs (typescript, tailwind).
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

CMD ["npm", "start"]
