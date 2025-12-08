const { DataTypes } = require('sequelize');
const sequelize = require('./db');

const User = sequelize.define('User', {
  // Определяем поля модели
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  chat_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.INTEGER,
    unique: true,
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  blocked_status: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  // Дополнительные настройки модели
  tableName: 'users', // Название таблицы в базе данных
  timestamps: true, // Добавляет поля createdAt и updatedAt
});

const Booking = sequelize.define('Booking', {
  // Определяем поля модели
  booking_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  chat_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  user_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  booking_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  time: {
    type: DataTypes.TIME,
    allowNull: false,
  },
  hours: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  table: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  club_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  // Дополнительные настройки модели
  tableName: 'bookings', // Название таблицы в базе данных
  timestamps: true, // Добавляет поля createdAt и updatedAt
});

const Dayoffs = sequelize.define('Booking', {
  // Определяем поля модели
  off_id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  off_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  club_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  off_reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },  
}, {
  // Дополнительные настройки модели
  tableName: 'dayoffs', // Название таблицы в базе данных
  timestamps: false, // Добавляет поля createdAt и updatedAt
});

module.exports = {User, Booking, Dayoffs};