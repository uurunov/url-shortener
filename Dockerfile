# Используем официальный Node-образ
FROM node:18-alpine

# Создаём директорию внутри контейнера
WORKDIR /url-shortener

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем dependencies
RUN npm install

# Копируем файлы (server.js и т.д.) на директорию мы создали наверху
COPY . .

# Порт, который будет слушать наш express
EXPOSE 3000

# Команда для запуска сервера
CMD ["npm", "start"]