const TelegramBot = require('node-telegram-bot-api');
const tg_token = '7579297753:AAGygIX_wPxh2VcJaWe3PSpz12ri3jrCFwM';
const WEB_APP_URL = 'https://a457-95-161-223-226.ngrok-free.app';
// const tokens = require('./tokens');
// const { WEB_APP_URL, tg_token } = tokens;
const bot = new TelegramBot(tg_token, { polling: true });
// const { appendData, getData, writeBookingData } = require('./googleSheets');

// messages.js



// Импортируем сообщения
const messages = require('./messages');
const { greating_message, rules_message, about_message } = messages;

// ID вашей Google таблицы и диапазон
const SPREADSHEET_ID = '1BFLBqnfbybW2YScyarfVjn1GYmPLr0wlcmqCLMq2Rs8';
const RANGE = 'bookings!A1:E1';

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === '/start') {
        await bot.sendMessage(chatId, greating_message, {
            reply_markup: {
                keyboard: [
                    [{ text: 'Прикинуть кий к носу', web_app: { url: WEB_APP_URL } }],
                ],
                "resize_keyboard": true
            }
        });
    }

    if (text === '/rules') {
        await bot.sendMessage(chatId, rules_message);
    }

    if (text === '/about') {
        await bot.sendMessage(chatId, about_message, { parse_mode: 'HTML' });
        // Отправка данных в Google Sheets
        const data = {
            chat_id: chatId,
            user_id: msg.chat.username,
            user_name: "Иван Иванов",
            booking_date: "2025-03-21",
            time: "14:00",
            hours: "2",
            table: "5",
            dt_in: new Date().toLocaleString('ru-RU'),
        };
        const values = [[data.chat_id, data.user_id, data.user_name, data.booking_date, data.time, data.hours, data.table, data.dt_in]];
        // await appendData(SPREADSHEET_ID, RANGE, values);
        // await writeBookingData(SPREADSHEET_ID, data.booking_date, data);
    }

    if (text === '/get_data') {

        // Получаем данные из таблицы
        // const GET_DATA_RANGE = 'bookings!A2:G';
        // const data = await getData(SPREADSHEET_ID, GET_DATA_RANGE);
        // Форматируем данные для отправки
        let message = 'Данные из таблицы:\n\n';
        data.forEach((row, index) => {
            message += `Запись ${index + 1}:\n`;
            message += `• Имя: ${row[2]}\n`;
            message += `• Дата: ${row[3]}\n`;
            message += `• Время: ${row[4]}\n`;
            message += `• Стол: ${row[6]}\n`;
            message += `• Часы: ${row[5]}\n\n`;
        });

        // Отправляем данные пользователю
        await bot.sendMessage(chatId, message);
        
    }

    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg.web_app_data.data);
            let prefix = parseFloat(data?.hours) > 1 ? 'часа' : 'час';
            let infoMessage = `\nОбщая информация:\n• ${data.date}\n• ${data.time}\n• стол №${data.table}\n• ${data.hours} ${prefix}`
            let infoMessage1 = `Внутри мы сделали веджи-кухню и пивной крафтовый бар. Просим, не приносить свою еду и напитки.`
            let infoMessage2 = `P.S. Если ты опаздываешь, напиши <a href="https://t.me/kiks_book">Киксу</a>, он держит бронь только 15 минут.`
            let finalMessage = `${data.name}, это успех! Можешь проверить бронь в приложении.${infoMessage}\n\n${infoMessage1}\n\n${infoMessage2}`
            await bot.sendMessage(chatId, finalMessage, { parse_mode: 'HTML' });

        } catch (error) {
            console.error(error);
        }
    }
});