const TelegramBot = require('node-telegram-bot-api');
const apiRouter = require('./api');
const tg_token = '7579297753:AAGygIX_wPxh2VcJaWe3PSpz12ri3jrCFwM';
const WEB_APP_URL = 'https://tvistept.github.io/kiks-test-react-app/';
const bot = new TelegramBot(tg_token, { polling: true });
// const { appendData, getData, writeBookingData } = require('./googleSheets');
const sequelize = require('./db');
const { Op } = require('sequelize');
const models = require('./models');
const { User, Booking } = models;
// Импортируем сообщения
const messages = require('./messages');
const { chat } = require('googleapis/build/src/apis/chat');
const { greating_message, rules_message, about_message } = messages;
// ID вашей Google таблицы и диапазон
const SPREADSHEET_ID = '1BFLBqnfbybW2YScyarfVjn1GYmPLr0wlcmqCLMq2Rs8';
const RANGE = 'bookings!A1:E1';
// Получаем текущую дату с временем 00:00
const today = new Date();
today.setHours(0, 0, 0, 0); // Устанавливаем время на 00:00:00.000

const https = require('https');
const fs = require('fs');
// Добавьте после импортов
const sslOptions = {
    key: fs.readFileSync('/etc/letsencrypt/live/kiks-app.ru/privkey.pem'),
    cert: fs.readFileSync('/etc/letsencrypt/live/kiks-app.ru/fullchain.pem')
  };

const express = require('express');
const cors = require('cors');
const app = express();
app.use(cors({
  origin: ['https://kiks-app.ru', 'https://tvistept.github.io/kiks-test-react-app/'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80);

app.use(express.json()); // для парсинга JSON
app.use('/api', apiRouter); // все API-роуты будут начинаться с /api

// Запускаем Express-сервер на другом порту (не 3000)
const API_PORT = 5000; // Или любой свободный порт
// Замените app.listen на:
https.createServer(sslOptions, app).listen(
    API_PORT, 
    '0.0.0.0',
    () => {
      console.log(`HTTPS сервер запущен на https://kiks-app.ru:${API_PORT}`);
    }
  );

async function testConnection() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('Connection has been established successfully.');
    } catch (error) {
        console.error('Unable to connect to the database:', error);
    }
}

testConnection();

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        const userToReturn  = await User.findOne({ where: { chat_id: chatId } }); 
        if (!userToReturn?.chat_id) {
            await User.create({ chat_id: chatId, firstName: msg.chat.username });
            userName = null
        } else {
            userName = userToReturn.firstName
        }

        let salutMessage = userName ? `Салют, ${userName}!\n\n` : `Салют!\n\n`
        await bot.sendMessage(chatId, `${salutMessage}${greating_message}`, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
                ],
                "resize_keyboard": true
            }
        });
    }
    if (text === '/rules') {
        await bot.sendMessage(chatId, rules_message);
    }
    if (text === '/about') {
        // const userToReturn  = await User.findOne({ where: { chat_id: chatId } }); 
        await bot.sendMessage(chatId, about_message, { parse_mode: 'HTML' });
    }
    if (text === '/my_bookings') {
        const userBookings = await Booking.findAll({
            where: {
              booking_date: {
                [Op.gt]: today,
              },
              chat_id: chatId,
            },
          })
        function formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${day}.${month}.${year}`;
        }
        
        function formatBooking(booking, index) {
            const { user_name, booking_date, time, hours, table } = booking.dataValues;
            const formattedDate = formatDate(booking_date);
            
            return `Запись ${index + 1}:
            • Имя: ${user_name}
            • Дата: ${formattedDate}
            • Время: ${time}
            • Стол: ${table}
            • Часы: ${hours}\n`;
        }
        
        let message = "Твои брони:\n\n";
        userBookings.forEach((booking, index) => {
        message += formatBooking(booking, index);
        });
        // Отправляем данные пользователю
        await bot.sendMessage(chatId, message);
    }
    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg.web_app_data.data);
            let prefix = parseFloat(data?.hours) > 1 ? 'часа' : 'час';
            let infoMessage = `\nОбщая информация:\n•${data.club}\n• ${data.date}\n• ${data.time}\n• стол №${data.table}\n• ${data.hours} ${prefix}`
            let infoMessage1 = `Внутри мы сделали веджи-кухню и пивной крафтовый бар. Просим, не приносить свою еду и напитки.`
            let infoMessage2 = `P.S. Если ты опаздываешь, напиши <a href="https://t.me/kiks_book">Киксу</a>, он держит бронь только 15 минут.`
            let finalMessage = `${data.name}, это успех! Можешь проверить бронь командой /my_bookings.${infoMessage}\n\n${infoMessage1}\n\n${infoMessage2}`
            await Booking.create({chat_id: chatId, user_name: data.name, booking_date: data.date, time: data.time, hours: data.hours, table: data.table, dt_in: new Date().toLocaleString('ru-RU')});
            await User.update(
                { firstName:  data.name, phone: data.phone }, // Новые значения для обновления
                {
                    where: {
                        chat_id: chatId, // Условие: chat_id = chatId
                    },
                }
            )
            await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });

        } catch (error) {
            console.error(error);
        }
    }
});