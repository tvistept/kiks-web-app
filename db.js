const { Sequelize } = require('sequelize');

// Создаем экземпляр Sequelize, передавая параметры подключения к базе данных
const sequelize = new Sequelize({
  database: 'kiks_app', // Название базы данных
  username: 'root', // Имя пользователя базы данных
  password: 'root', // Пароль пользователя базы данных
  host: 'localhost', // Хост базы данных (например, localhost)
  port: 5432, // Порт базы данных (по умолчанию для PostgreSQL 5432)
  dialect: 'postgres', // Диалект базы данных (postgres, mysql, sqlite, mssql)
  logging: false, // Отключаем логирование SQL-запросов в консоль (можно включить, если нужно)
});

// Экспортируем экземпляр Sequelize для использования в других частях приложения
module.exports = sequelize;