const { google } = require('googleapis');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

// Загрузите credentials.json
const CREDENTIALS_PATH = path.join(__dirname, 'credentials.json');
const TOKEN_PATH = path.join(__dirname, 'token.json');

// Загрузите credentials
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
const { client_secret, client_id, redirect_uris } = credentials.installed;
const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

// Авторизация и получение токена
async function authorize() {
    if (fs.existsSync(TOKEN_PATH)) {
        const token = JSON.parse(fs.readFileSync(TOKEN_PATH));
        oAuth2Client.setCredentials(token);
        return oAuth2Client;
    } else {
        return getNewToken(oAuth2Client);
    }
}

async function getNewToken(oAuth2Client) {
    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    console.log('Authorize this app by visiting this url:', authUrl);
    const rl = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve, reject) => {
        rl.question('Enter the code from that page here: ', (code) => {
            rl.close();
            oAuth2Client.getToken(code, (err, token) => {
                if (err) return reject(err);
                oAuth2Client.setCredentials(token);
                fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
                resolve(oAuth2Client);
            });
        });
    });
}

// Функция для добавления данных в Google Sheets
async function appendData(spreadsheetId, range, values) {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const resource = {
        values,
    };
    return sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        resource,
    });
}

// Функция для получения данных из Google Sheets
async function getData(spreadsheetId, range) {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
    });
    return response.data.values;
}

// Функция для изменения формата ячеек (цвет фона)
async function formatCells(spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, color) {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    const requests = [{
        repeatCell: {
            range: {
                sheetId,
                startRowIndex,
                endRowIndex,
                startColumnIndex,
                endColumnIndex,
            },
            cell: {
                userEnteredFormat: {
                    backgroundColor: {
                        red: color.red / 255,
                        green: color.green / 255,
                        blue: color.blue / 255,
                    },
                },
            },
            fields: 'userEnteredFormat.backgroundColor',
        },
    }];

    return sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests,
        },
    });
}

// Новая функция для записи данных бронирования
async function writeBookingData(spreadsheetId, sheetName, data) {
    const auth = await authorize();
    const sheets = google.sheets({ version: 'v4', auth });

    // Определяем колонку для времени
    const timeToColumn = {
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
    };

    const startColumn = timeToColumn[data.time];
    const startRow = parseInt(data.table) - 1; // Строка = номер стола - 1
    console.log(startColumn, startRow, data.user_name, sheetName)
    console.log(`${sheetName}!${startColumn}${startRow}`)
    // Записываем имя пользователя в ячейку для выбранного времени
    sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!${startColumn}${startRow}`,
        valueInputOption: 'RAW',
        resource: {
            values: [[data.user_name]],
        },
    });

    // Если hours = 2, записываем имя пользователя в соседнюю ячейку
    if (parseInt(data.hours) === 2) {
        const nextColumn = String.fromCharCode(startColumn.charCodeAt(0) + 1);
        sheets.spreadsheets.values.update({
            auth,
            spreadsheetId,
            range: `${sheetName}!${nextColumn}${startRow}`,
            valueInputOption: 'RAW',
            resource: {
                values: [[data.user_name]],
            },
        });
    }

    // Получаем sheetId для форматирования
    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
    const sheetId = sheet.properties.sheetId;

    // Преобразуем цвет #ec85af в RGB
    const color = {
        red: parseInt('ec', 16),
        green: parseInt('85', 16),
        blue: parseInt('af', 16),
    };

    // Форматируем ячейки
    const startColumnIndex = startColumn.charCodeAt(0) - 'A'.charCodeAt(0);
    const endColumnIndex = startColumnIndex + (parseInt(data.hours) === 2 ? 2 : 1);
    const startRowIndex = startRow - 1;
    const endRowIndex = startRow;

    await formatCells(spreadsheetId, sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex, color);
    // return
}

module.exports = { appendData, getData, writeBookingData };