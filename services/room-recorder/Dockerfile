# The room recorder (docs/RECORDER.md): Node and Playwright's Chromium, in Microsoft's Playwright image (it has the browser's system
# libraries and fonts). The version matches the playwright package in package.json.
FROM mcr.microsoft.com/playwright:v1.56.1-noble
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY server.mjs sign.mjs ./
USER pwuser
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.mjs"]
