const TelegramBot = require('node-telegram-bot-api');
const { google } = require('googleapis');
const apiRouter = require('./api');
const { tg_token, google_worksheet_id, google_sheet_id, google_worksheet_id_kiks2, tg_token_kiks2 } = require('/app-configs/tokens.js');
const USER1_SHEET_ID = google_sheet_id;
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
  origin: ['https://kiks-app.ru', 'https://tvistept.github.io/kiks-test-react-app/', 'https://tvistept.github.io/kiks-admin-panel/', 'https://tvistept.github.io'],
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
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

let getBookingTime = (time, offsetHours) => {
  const [h] = time.split(":").map(Number);
  const date = new Date();
  date.setHours(h + offsetHours, 0, 0);
  return String(date.getHours()).padStart(2, "0") + ":00:00";
}

function isWeekend(date) {
  const weekendDays = [
    '02.01.2026',
    '03.01.2026',
    '04.01.2026',
    '05.01.2026',
    '06.01.2026',
    '07.01.2026',
    '08.01.2026',
    '09.01.2026',
    '10.01.2026',
    '09.03.2026'
  ];

  const day = date.getDay();
    if (day === 0 || day === 6) {
        return true;
    }

  const dateString = `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
  return weekendDays.includes(dateString);
}

function generateBookingId(chatId, bookDate, bookTime, tableNum) {
  bookDate = bookDate.replaceAll('.','')
  bookTime = bookTime.replaceAll(':','')
  return `${chatId}${bookDate}${bookTime}${tableNum}`
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
  try {
    const values = [value];

    if (unmerge) {
      const response = await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
      console.log(`${response.data.updatedCells} ячеек обновлено.`);

      await unmergeCells(sheetsClient, range, spreadsheetId);
    } else {
      await mergeCells(sheetsClient, range, spreadsheetId);

      const response = await sheetsClient.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: { values },
      });
      console.log(`${response.data.updatedCells} ячеек обновлено.`);
    }
    
    return true;
  } catch (error) {
    console.error('Ошибка в writeToRange:', error);
    throw error;
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
    const timeToColumn = isWeekend(dateFromString(bookDate))
      ? { '12:00': 'C', '13:00': 'D', '14:00': 'E', '15:00': 'F', '16:00': 'G', '17:00': 'H', '18:00': 'I', '19:00': 'J', '20:00': 'K', '21:00': 'L', '22:00': 'M', '23:00': 'N', '00:00': 'O', '01:00': 'P' }
      : { '14:00': 'C', '15:00': 'D', '16:00': 'E', '17:00': 'F', '18:00': 'G', '19:00': 'H', '20:00': 'I', '21:00': 'J', '22:00': 'K', '23:00': 'L', '00:00': 'M', '01:00': 'N' };

    const sheet_id = club === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
    const startColumn = timeToColumn[bookTime];
    const startRow = parseInt(tableNum) + 1;

    if (parseInt(hours) > 1) {
      const nextColumn = String.fromCharCode(startColumn.charCodeAt(0) + (parseInt(hours) - 1));
      await writeToRange(sheet_id, `${bookDate}!${startColumn}${startRow}:${nextColumn}${startRow}`, [userName, userName]);
    } else {
      await writeToCell(sheet_id, `${bookDate}!${startColumn}${startRow}`, userName);
    }
    return true;

  } catch (error) {
    console.error('Ошибка в bookTable:', error);
    throw error;
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

      let spreadsheetId = clubId === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
      const startColumn = timeToColumn[bookTime];
      const startRow = parseInt(tableNum) + 1; // Строка = номер стола + 1

      if (parseInt(hours) > 1 ) {
          const nextColumn = String.fromCharCode(startColumn.charCodeAt(0) + (parseInt(hours) - 1));
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

async function deleteUserBookingRow(bookingId) {
  const spreadsheetId = SERVICE_SHEET_ID;
  const sheetName = 'userBooking';
  const valueToDelete = bookingId;

  // Получаем sheetId
  const spreadsheet = await sheetsClient.spreadsheets.get({ spreadsheetId });
  const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
  const sheetId = sheet.properties.sheetId;

  // Получаем все строки
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });
  const rows = res.data.values;

  // Ищем нужную строку (столбец F, индекс 5)
  let rowIndexToDelete = null;
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][5] === valueToDelete) {
      rowIndexToDelete = i;
      break;
    }
  }

  if (rowIndexToDelete !== null) {
    await sheetsClient.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndexToDelete,
                endIndex: rowIndexToDelete + 1,
              },
            },
          },
        ],
      },
    });
    console.log('Строка удалена');
  } else {
    console.log('Строка не найдена');
  }
}

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    const userToReturn  = await User.findOne({ where: { chat_id: chatId } }); 

    if (userToReturn?.blocked_status == 1) {
        await bot.sendMessage(chatId, 'Упс, что-то пошло не так. Попробуй позже.')
        //Ты заблокирован и не можешь выполнять действия в боте.
        return;
    }

    if (text === '/start') {
        if (!userToReturn?.chat_id) {
            await User.create({ chat_id: chatId, firstName: msg.chat.first_name||msg.chat.username||chatId, user_name: msg.chat.username });
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
                "resize_keyboard": true,
                "selective": false,
                "one_time_keyboard": false,
                "is_persistent": true,
            }
        });
    }
    if (text === '/rules') {
        await bot.sendMessage(chatId, rules_message,  {
            reply_markup: {
                keyboard: [
                    [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
                ],
                "resize_keyboard": true,
                "selective": false,
                "one_time_keyboard": false,
                "is_persistent": true,
            }
        });
    }
    if (text === '/about') {
        await bot.sendMessage(chatId, about_message, {
          parse_mode: 'HTML', 
          no_webpage:true, 
          disable_web_page_preview:true, 
          link_preview_options: {is_disabled: true},
          reply_markup: {
            keyboard: [
                [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
            ],
            "resize_keyboard": true,
            "one_time_keyboard": false,
            "selective": false,
            "is_persistent": true,
          }
        });
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
        await bot.sendMessage(chatId, message, {
          parse_mode: 'HTML', 
          no_webpage:true, 
          disable_web_page_preview:true, 
          link_preview_options: {is_disabled: true},
          reply_markup: {
            keyboard: [
                [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
            ],
            "resize_keyboard": true,
            "one_time_keyboard": false,
            "selective": false,
            "is_persistent": true,
          }
        });
    }
    if (text === '/test') {
      const message = `👋 Привет, друг! Добро пожаловать в Mini App 👇`;
      const options = {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🚀 Открыть Mini App',
                web_app: {
                  url: `${WEB_APP_URL}?user_id=${chatId}` ,
                },
              },
            ],
          ],
        },
      };

      await bot.sendMessage(chatId, message, options); 
    }

    if (msg?.web_app_data?.data) {
        try {
            const data = JSON.parse(msg.web_app_data.data);
            let prefix = parseFloat(data?.hours) > 1 ? 'часа' : 'час';
            let errMessage = ''
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

            let kiksManager = clubId === 'kiks2' ? `<a href="https://t.me/KiksPetra">Киксу</a>` : '<a href="https://t.me/kiks_book">Киксу</a>'
            let kiksKitchen = clubId === 'kiks2' ? `` : '(до 23:00) '

            let infoMessage = `\nОбщая информация:\n• ${data.club}\n• ${formattedDate}\n• ${data.time}\n• ${tableName}\n• ${data.hours} ${prefix}`

            let infoMessageVip = ''
            if (data.table == 7 || data.table == 8) {
                infoMessageVip = `Стоимость бронирования VIP комнаты 1000 день/2000 вечер.\n`
            }

            let infoMessage1 = `У нас есть кухня ${kiksKitchen}и пивной крафтовый бар. Просим не приносить свою еду и напитки.\nОбращаем ваше внимание, что в счет для компаний от 6 человек включен сервисный сбор в размере 10% на кухню и бар.`
            let infoMessage2 = `P.S. Если ты опаздываешь, напиши ${kiksManager}, он держит бронь только 15 минут.`
            let finalMessage = `${data.name}, это успех!${infoMessage}\n\n${infoMessageVip}\n${infoMessage1}\n\n${infoMessage2}`

            //проверка на существование конфликта в базе данных
            try {
               // Копируем исходный объект даты
              const startDate = new Date(data.date);
              const endDate = new Date(data.date);
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(23, 59, 59, 999);

              let existingBookings  = await Booking.findAll({ 
                where: { 
                  club_id: clubId, 
                  table: data.table,
                  booking_date: {[Op.between]: [startDate, endDate]   }, 
                } 
              });

              let formattedBookings = existingBookings.map(booking => ({
                booking_id: booking.booking_id,
                booking_date: new Date(booking.booking_date).toLocaleDateString('en-CA'),
                time: booking.time,
                hours: booking.hours
              }));

              // Преобразует строку даты и времени в Date объект
              function parseDateTime(dateStr, timeStr) {
                  if (timeStr == '00:00:00' || timeStr == '01:00:00') {
                    dateStr = new Date(new Date(dateStr).setDate(new Date(dateStr).getDate() + 1)).toLocaleDateString('en-CA');
                  }
                  return new Date(`${dateStr}T${timeStr}`);
              }

              // Вычисляет конец бронирования (начало + hours)
              function getEndTime(start, hours) {
                  const end = new Date(start);
                  end.setHours(end.getHours() + hours);
                  return end;
              }

              // Проверяет пересечение двух интервалов
              function isOverlap(start1, end1, start2, end2) {
                  return start1 < end2 && start2 < end1;
              }

              function hasConflict(bookings, newBooking) {
                  const newStart = parseDateTime(newBooking.booking_date, newBooking.time);
                  const newEnd = getEndTime(newStart, newBooking.hours);

                  for (const booking of bookings) {
                      const existingStart = parseDateTime(booking.booking_date, booking.time);
                      const existingEnd = getEndTime(existingStart, booking.hours);

                      if (isOverlap(newStart, newEnd, existingStart, existingEnd)) {
                          return true; // Найден конфликт
                      }
                  }
                  return false; // Конфликтов нет
              }

              let newBooking = {
                  booking_date: new Date(data.date).toLocaleDateString('en-CA'),
                  time: data.time,
                  hours: data.hours,
              };

              if (hasConflict(formattedBookings, newBooking)) {
                await bot.sendMessage(chatId, 'Извини, кто-то уже забронировал стол на это время. Попробуй другой слот.',  {
                    reply_markup: {
                        keyboard: [
                            [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
                        ],
                        "resize_keyboard": true,
                        "selective": false,
                        "one_time_keyboard": false,
                        "is_persistent": true,
                    }
                });
                return;
              } 
            } catch (error) {
              console.error(error);
            }

            //проверка на существование брони в другом клубе
            try {
               // Копируем исходный объект даты
              const startDate = new Date(data.date);
              const endDate = new Date(data.date);
              startDate.setHours(0, 0, 0, 0);
              endDate.setHours(23, 59, 59, 999);

              let otherClubId = clubId === 'kiks2' ? 'kiks1' : 'kiks2';
              let clubName = clubId === 'kiks2' ? 'Каменноостровском' : 'Марата';
              let anotherClubName = clubId === 'kiks2' ? 'Марата' : 'Каменноостровском';

              let  anotherClubBooking  = await Booking.findOne({
                where: { 
                  chat_id: chatId,
                  club_id: otherClubId, 
                  time: {[Op.between]: [getBookingTime(data.time, -parseInt(data.hours)), getBookingTime(data.time, parseInt(data.hours))]},
                  booking_date: {[Op.between]: [startDate, endDate]   }, 
                } 
              });

              if (anotherClubBooking) {
                await bot.sendMessage(chatId, `Ты не можешь забронировать стол на ${clubName}, так как у тебя уже есть бронь на ${anotherClubName} в ${data.time} в этот день. Выбери слот на другое время (на пару часов позднее или раньше).`,  {
                    reply_markup: {
                        keyboard: [
                            [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
                        ],
                        "resize_keyboard": true,
                        "selective": false,
                        "one_time_keyboard": false,
                        "is_persistent": true,
                    }
                });
                return;
              } 
            } catch (error) {
              console.error(error);
            }

            //механизм бронирования
            let createdBooking = null;
            try {
                // 1. Создаём бронь
                createdBooking = await Booking.create({
                    chat_id: chatId,
                    user_name: data.name,
                    booking_date: data.date,
                    time: data.time,
                    hours: data.hours,
                    table: data.table,
                    dt_in: new Date().toLocaleString('ru-RU'),
                    club_id: clubId
                });

                if (!createdBooking) throw new Error('Не удалось записать бронь в базу данных');

                // 2. Обновляем пользователя
                await User.update(
                    { firstName: data.name, phone: data.phone },
                    { where: { chat_id: chatId } }
                );

                // 3. Пишем бронь в таблицу клуба
                try {
                  await bookTable(
                      formattedDate,
                      data.time,
                      data.table,
                      data.hours,
                      data.name,
                      clubId
                  );
                } catch (err) {
                  errMessage = err.message
                  throw new Error('Ошибка при записи в таблицу слотов');
                }

                // 4. Всё прошло успешно → отправляем сообщение
                const spreadsheetId = clubId === 'kiks2' ? USER2_SHEET_ID : USER1_SHEET_ID;
                const sheetLink = await getSheetLink(formattedDate, spreadsheetId);

                const BUTTONS_BOOK_READY = {
                    inline_keyboard: [
                        [{ text: 'проверить бронь', url: sheetLink }],
                        [{ text: 'отменить бронь', callback_data: `deleteBron_${data.table}__${formattedDate}__${data.time}__${data.hours}__${clubId}` }]
                    ]
                };

                await bot.sendMessage(chatId, finalMessage, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                    reply_markup: BUTTONS_BOOK_READY
                });

                // 5. Дополнительный лог (не критично)
                try {
                    let bookingId = generateBookingId(chatId, formattedDate, data.time, data.table);
                    await appendRow(SERVICE_SHEET_ID, 'userBooking', [[
                        chatId, data.name, data.name, formattedDate, data.hours,
                        bookingId, data.time, data.phone, clubId, null
                    ]]);
                } catch (err) {
                    console.error('appendRow не выполнен:', err);
                }

            } catch (err) {
                console.error('Ошибка при бронировании:', err);
                // если бронь была создана → удаляем
                if (createdBooking) {
                    try {
                        await Booking.destroy({ where: { booking_id: createdBooking.booking_id } });
                        console.log('Бронь откатилась вручную');
                    } catch (deleteErr) {
                        console.error('Не удалось удалить бронь вручную:', deleteErr);
                    }
                }

                // Сообщение пользователю
                await bot.sendMessage(chatId, '⚠️ Произошла ошибка при создании брони. Попробуй ещё раз или обратись к администратору клуба (@kiks_book или @kiksPetra).',
                    {
                      parse_mode: 'HTML', 
                      no_webpage:true, 
                      disable_web_page_preview:true, 
                      link_preview_options: {is_disabled: true},
                      reply_markup: {
                        keyboard: [
                            [{ text: 'Прикинуть кий к носу', web_app: { url: `${WEB_APP_URL}?user_id=${chatId}` } }],
                        ],
                        "resize_keyboard": true,
                        "one_time_keyboard": false,
                        "selective": false,
                        "is_persistent": true,
                      }
                    });

                // Лог ошибки
                try {
                    await appendRow(SERVICE_SHEET_ID, 'errors_log', [[chatId, String(err.message || err), new Date(), errMessage]]);
                } catch (logErr) {
                    console.error('Ошибка при логировании:', logErr);
                }
                return;
            }


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
      const originalDate = dateFromString(bookDate);

      // Копируем исходный объект даты
      const startDate = new Date(originalDate);
      const endDate = new Date(originalDate);
      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      let booking = await Booking.findOne({
        where: {
          chat_id: chat_id,
          booking_date: {[Op.between]: [startDate, endDate]   },
          time: bookTime,
          table: tableNum,
          club_id: clubId,
        },
      });

      await booking.destroy();

      let bookingId = generateBookingId(chat_id, bookDate, bookTime, tableNum)
      deleteUserBookingRow(bookingId)
      deleteBooking(bookDate, bookTime, tableNum, parseFloat(bookHours), clubId)
      editMessage(chat_id, callbackQuery.message.message_id, `Ты отменил бронь на ${bookDate} с ${bookTime}`)
    }
  } catch (error) {
    let errorDedails = `chat_id: ${chat_id}, startDate: ${startDate}, endDate: ${endDate}, bookTime: ${bookTime}, tableNum: ${tableNum}, bookHours: ${bookHours}, clubId: ${clubId}`
    console.error('Callback error:', `Ошибка удаления брони: ${errorDedails} (${error})`);

    try {
        await appendRow(SERVICE_SHEET_ID, 'errors_log', [[chat_id, `Ошибка при удалении брони: ${errorDedails}`]]);
    } catch (logErr) {
        console.error('Ошибка при логировании:', logErr);
    }

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