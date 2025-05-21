# Use Node.js as an example; adjust if using another runtime
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "start"]
