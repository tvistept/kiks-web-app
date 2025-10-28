const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const apiRouter = require('./api');
const { tg_token, google_worksheet_id, google_sheet_id, google_worksheet_id_kiks2, tg_token_kiks2 } = require('/app-configs/tokens.js');
const USER1_SHEET_ID = google_worksheet_id_kiks2;
const USER2_SHEET_ID = google_worksheet_id_kiks2;
const SERVICE_SHEET_ID = google_worksheet_id;
const WEB_APP_URL = 'https://tvistept.github.io/kiks-test-react-app/';
const KEY_FILE = '/app-configs/google.json';
const bot = new TelegramBot(tg_token_kiks2, { polling: true });
const sequelize = require('./db');
const { Op } = require('sequelize');
const models = require('./models');
const { User, Booking } = models;
const messages = require('./messages');
const { greating_message, rules_message, about_message } = messages;
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
  origin: ['https://kiks-app.ru', 'https://tvistept.github.io/kiks-test-react-app/', 'https://tvistept.github.io'],
  methods: ['GET', 'POST', 'PUT', 'DELETE']
}));
const http = require('http');
const e = require('express');
http.createServer((req, res) => {
  res.writeHead(301, { "Location": "https://" + req.headers['host'] + req.url });
  res.end();
}).listen(80);

app.use(express.json()); // для парсинга JSON
app.use('/api', apiRouter); // все API-роуты будут начинаться с /api

// Запускаем Express-сервер на другом порту (не 3000)
const API_PORT = 5000; // Или любой свободный порт

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

//единый клиент для всех запросов
const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

// Инициализация клиента при старте приложения
let sheetsClient;
(async function init() {
  sheetsClient = google.sheets({ 
    version: 'v4', 
    auth: await auth.getClient() 
  });
})();

const editMessage = async(chatId, messageId, text, replyMarkup = null) => {
  bot.editMessageText(text, {chat_id: chatId, message_id: messageId, reply_markup: replyMarkup, parse_mode: 'HTML', disable_web_page_preview: true, link_preview_options: {is_disabled: true},} )
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric'
});

function dateFromString(dateString) {
  const [day, month, year] = dateString.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return date;
}

function isWeekend(date) {
    const day = date.getDay(); // 0 - воскресенье, 1 - понедельник, ..., 6 - суббота
    return day === 0 || day === 5 || day === 6; // 0 (воскресенье), 5 (пятница), 6 (суббота)
}

function getRangeObject(input) {
  const [sheetName, cellsPart] = input.split('!');
  const [firstCell, secondCell] = cellsPart.split(':');

  // Извлекаем буквы и цифры из ячеек
  const letter1 = firstCell.match(/[A-Za-z]+/)[0];
  const letter2 = secondCell.match(/[A-Za-z]+/)[0];
  const row = firstCell.match(/\d+/)[0]; // предполагаем, что номер строки одинаков в обоих ячейках

  // Функция для преобразования буквы в индекс (A=0, B=1, ..., Z=25, AA=26, AB=27 и т.д.)
  function letterToIndex(letter) {
      let index = 0;
      letter = letter.toUpperCase();
      for (let i = 0; i < letter.length; i++) {
          index = index * 26 + (letter.charCodeAt(i) - 'A'.charCodeAt(0) + 1);
      }
      return index - 1; // чтобы A было 0, а не 1
  }

  const cellIndex1 = letterToIndex(letter1);
  const cellIndex2 = letterToIndex(letter2);

  const result = {
      sheetName,
      firstCell,
      secondCell,
      cellIndex1,
      cellIndex2,
      row: parseInt(row)
  };
  return result
}

async function appendRow(spreadsheetId, range, values) {
  const resource = { values };
  const response = await sheetsClient.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'RAW', // Можно использовать RAW или USER_ENTERED
    resource,
  });

  console.log(`${response.data.updates.updatedCells} ячеек добавлено.`);
}

async function writeToCell(spreadsheetId, range, value) {
  const values = [ [value] ];
  const resource = { values };
  const response = await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED', // или 'RAW'
    resource,
  });

  console.log(`${response.data.updatedCells} ячеек обновлено.`);
}

async function mergeCells(sheets, range, spreadsheetId) {
  const { sheetName, cellIndex1, cellIndex2, row } = getRangeObject(range);
//   const spreadsheetId = USER_SHEET_ID;

  // Получаем sheetId по имени листа
  const sheetRes = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = sheetRes.data.sheets.find(s => s.properties.title === sheetName);
  const sheetIdToMerge = sheet.properties.sheetId;

  // Формируем запрос на объединение A2:B2 (строка 2 = индекс 1, столбцы A=0, B=1)
  const request = {
    spreadsheetId,
    resource: {
      requests: [
        {
          mergeCells: {
            range: {
              sheetId:sheetIdToMerge,
              startRowIndex: row-1,    // строка 2 (индексация с 0)
              endRowIndex: row,      // до строки 3 (не включая)
              startColumnIndex: cellIndex1, // столбец A (индексация с 0)
              endColumnIndex: cellIndex2+1    // до столбца C (не включая)
            },
            mergeType: 'MERGE_ALL'
          }
        }
      ]
    }
  };

  // Выполняем запрос
  await sheets.spreadsheets.batchUpdate(request);
  console.log(`Ячейки успешно объединены на листе ${sheetName}.`);
}

async function writeToRange(spreadsheetId, range, value, unmerge = false) {
  const values = [ value ];
  const resource = { values };
  const response = await sheetsClient.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED', // или 'RAW'
    resource,
  });

  console.log(`${response.data.updatedCells} ячеек обновлено.`);
  if (unmerge) {
    unmergeCells(sheetsClient, range, spreadsheetId);
  } else {
    mergeCells(sheetsClient, range, spreadsheetId);
  }
}

async function getSheetLink(sheetName, spreadsheetId) {
//   const spreadsheetId = USER_SHEET_ID;
  // Получаем список листов и их свойства
  const res = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets.find(s => s.properties.title === sheetName);

  if (!sheet) {
    throw new Error(`Лист "${sheetName}" не найден.`);
  }

  const gid = sheet.properties.sheetId;
  const link = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${gid}`;
  return link;
}

async function unmergeCells(sheets, range, spreadsheetId) {
  const { sheetName, cellIndex1, cellIndex2, row } = getRangeObject(range);
  

  // Получаем sheetId по имени листа
  const sheetRes = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = sheetRes.data.sheets.find(s => s.properties.title === sheetName);
  const sheetIdToUnmerge = sheet.properties.sheetId;

  // Формируем запрос на объединение A2:B2 (строка 2 = индекс 1, столбцы A=0, B=1)
  const request = {
    spreadsheetId,
    resource: {
      requests: [
        {
          unmergeCells: {
            range: {
              sheetId:sheetIdToUnmerge,
              startRowIndex: row-1,    // строка 2 (индексация с 0)
              endRowIndex: row,      // до строки 3 (не включая)
              startColumnIndex: cellIndex1, // столбец A (индексация с 0)
              endColumnIndex: cellIndex2+1    // до столбца C (не включая)
            },
          }
        }
      ]
    }
  };

  // Выполняем запрос
  await sheets.spreadsheets.batchUpdate(request);
  console.log(`Ячейки успешно разъединены на листе ${sheetName}.`);
}

async function bookTable(bookDate, bookTime, tableNum, hours, userName, club) { 
    try {
      // Определяем колонку для времени
      let timeToColumn = {}
      isWeekend(dateFromString(bookDate)) ? timeToColumn = {
          '12:00': 'C',
          '13:00': 'D',
          '14:00': 'E',
          '15:00': 'F',
          '16:00': 'G',
          '17:00': 'H',
          '18:00': 'I',
          '19:00': 'J',
          '20:00': 'K',
          '21:00': 'L',
          '22:00': 'M',
          '23:00': 'N',
          '00:00': 'O',
          '01:00': 'P',
      } : timeToColumn = {
          '14:00': 'C',
          '15:00': 'D',
          '16:00': 'E',
          '17:00': 'F',
          '18:00': 'G',
          '19:00': 'H',
          '20:00': 'I',
          '21:00': 'J',
          '22:00': 'K',
          '23:00': 'L',
          '00:00': 'M',
          '01:00': 'N'
      };

      if (club === 'kiks2') {
        timeToColumn = {
          '14:00': 'C',
          '15:00': 'D',
          '16:00': 'E',
          '17:00': 'F',
          '18:00': 'G',
          '19:00': 'H',
          '20:00': 'I',
          '21:00': 'J',
          '22:00': 'K',
          '23:00': 'L',
          '00:00': 'M',
          '01:00': 'N'
        };
      }

      if (club == 'kiks1') {
        return true
      }
      
      let sheet_id = club === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
      const startColumn = timeToColumn[bookTime];
      const startRow = parseInt(tableNum) + 1
      // const startRow = club === 'kiks2' ? parseInt(tableNum) + 1 : parseInt(tableNum); // Строка = номер стола + 1 если старый кикс, + 2 если новый кикс

      

      if (parseInt(hours) === 2) {
          const nextColumn = String.fromCharCode(startColumn.charCodeAt(0) + 1);
          await writeToRange(sheet_id, `${bookDate}!${startColumn}${startRow}:${nextColumn}${startRow}`, [userName, userName]);
      } else {
        await writeToCell(sheet_id, `${bookDate}!${startColumn}${startRow}`, userName);
      }
      return true
    } catch (error) {
      console.log(error)
      return false
    }
    
}

async function deleteBooking(bookDate, bookTime, tableNum, hours, clubId) { 
    try {
      // Определяем колонку для времени
      let timeToColumn = {}
      isWeekend(dateFromString(bookDate)) ? timeToColumn = {
          '12:00': 'C',
          '13:00': 'D',
          '14:00': 'E',
          '15:00': 'F',
          '16:00': 'G',
          '17:00': 'H',
          '18:00': 'I',
          '19:00': 'J',
          '20:00': 'K',
          '21:00': 'L',
          '22:00': 'M',
          '23:00': 'N',
          '00:00': 'O',
          '01:00': 'P',
      } : timeToColumn = {
          '14:00': 'C',
          '15:00': 'D',
          '16:00': 'E',
          '17:00': 'F',
          '18:00': 'G',
          '19:00': 'H',
          '20:00': 'I',
          '21:00': 'J',
          '22:00': 'K',
          '23:00': 'L',
          '00:00': 'M',
          '01:00': 'N'
      };

      if (clubId === 'kiks2') {
        timeToColumn = {
          '14:00': 'C',
          '15:00': 'D',
          '16:00': 'E',
          '17:00': 'F',
          '18:00': 'G',
          '19:00': 'H',
          '20:00': 'I',
          '21:00': 'J',
          '22:00': 'K',
          '23:00': 'L',
          '00:00': 'M',
          '01:00': 'N'
        };
      }

      let spreadsheetId = clubId === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
      const startColumn = timeToColumn[bookTime];
      const startRow = parseInt(tableNum) + 1; // Строка = номер стола + 1

      if (parseInt(hours) === 2) {
          const nextColumn = String.fromCharCode(startColumn.charCodeAt(0) + 1);
          await writeToRange(spreadsheetId, `${bookDate}!${startColumn}${startRow}:${nextColumn}${startRow}`, ['', ''], true);
      } else {
        await writeToCell(spreadsheetId, `${bookDate}!${startColumn}${startRow}`, '');
      }
      return true
    } catch (error) {
      console.log(error)
      return false
    }
}

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
        // await bot.sendMessage(chatId, about_message, { parse_mode: 'HTML' });
        await bot.sendMessage(chatId, about_message, {parse_mode: 'HTML', no_webpage:true, disable_web_page_preview:true, link_preview_options: {is_disabled: true}});
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
            const dateString = data.date;
            const [year, month, day] = dateString.split('-');
            const formattedDate = `${day}.${month}.${year}`;
            let clubId = data.club === 'Каменноостровский 26-28' ? 'kiks2' : 'kiks1';
            let tableName;
            if (data.table == 7 ) {
                tableName = 'DARK ROOM'
            } else if (data.table == 8) {
                tableName = 'WOOD ROOM'
            } else {
                tableName = `стол № ${data.table}`
            }

            let infoMessage = `\nОбщая информация:\n• ${data.club}\n• ${formattedDate}\n• ${data.time}\n• ${tableName}\n• ${data.hours} ${prefix}`
            let infoMessage1 = `Внутри мы сделали кухню и пивной крафтовый бар. Просим, не приносить свою еду и напитки.`
            let infoMessage2 = `P.S. Если ты опаздываешь, напиши <a href="https://t.me/kiks_book">Киксу</a>, он держит бронь только 15 минут.`
            let finalMessage = `${data.name}, это успех! Можешь проверить бронь командой /my_bookings.${infoMessage}\n\n${infoMessage1}\n\n${infoMessage2}`
            await Booking.create({chat_id: chatId, user_name: data.name, booking_date: data.date, time: data.time, hours: data.hours, table: data.table, dt_in: new Date().toLocaleString('ru-RU'), club_id: clubId});
            await User.update(
                { firstName:  data.name, phone: data.phone }, // Новые значения для обновления
                {
                    where: {
                        chat_id: chatId, // Условие: chat_id = chatId
                    },
                }
            )

            let spreadsheetId = clubId === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
            let sheetLink = await getSheetLink(formattedDate, spreadsheetId)
            const BUTTONS_BOOK_READY = {
              "inline_keyboard": [
                [
                  {text: 'проверить бронь', url:sheetLink},
                ],
                [
                  {text: 'отменить бронь', callback_data: `deleteBron_${data.table}__${formattedDate}__${data.time}__${data.hours}__${clubId}`},
                ],
              ]
            }
            
            await bot.sendMessage(chatId, finalMessage, {parse_mode: 'HTML', no_webpage:true, disable_web_page_preview:true, link_preview_options: {is_disabled: true}, reply_markup: BUTTONS_BOOK_READY});
            await bookTable(formattedDate, data.time, data.table, data.hours, data.name, clubId);

        } catch (error) {
            console.error(error);
        }
    }
});

bot.on('callback_query', async (callbackQuery) => {
  try {
    let chat_id = callbackQuery.message.chat.id
    let messageText = callbackQuery.data

    if (messageText.includes('deleteBron')) {
      let tableNumDateTime = messageText.replace('deleteBron_','')
      let tableNum = tableNumDateTime.split('__')[0]
      let bookDate = tableNumDateTime.split('__')[1]
      let bookTime = tableNumDateTime.split('__')[2]
      let bookHours = tableNumDateTime.split('__')[3]
      let clubId = tableNumDateTime.split('__')[4]
      // let bookingId = generateBookingId(chat_id, bookDate, bookTime, tableNum)

      await Booking.destroy({
        where: {
          chat_id: chat_id,
          booking_date: bookDate,
          time: bookTime,
          table: tableNum,
          club_id: clubId,
        },
      });
      
      deleteBooking(bookDate, bookTime, tableNum, parseFloat(bookHours), chat_id, clubId)
      // deleteUserBookingRow(bookingId)
      editMessage(chat_id, callbackQuery.message.message_id, `Ты отменил бронь на ${bookDate} с ${bookTime}`)
    }
  } catch (error) {
    console.error('Callback error:', error);
    try {
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Произошла ошибка, попробуйте позже',
        show_alert: true
      });
    } catch (e) {
      console.error('Failed to send error to user:', e);
    }
  } finally {
    // Принудительно освобождаем ресурсы
    if (callbackQuery.message) {
      callbackQuery.message = null;
    }
  }
});