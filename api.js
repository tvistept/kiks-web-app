// routes/api.js
const express = require('express');
const router = express.Router();
const models = require('./models');
const { Op } = require('sequelize');
const { User, Booking, Dayoffs } = models;
const today = new Date();
today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня (00:00:00)

const getDateFromString = (dateString) => {
  const [day, month, year] = dateString.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return date;
}

// Получить все брони с текущей даты
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.findAll(
      {
        where: {
          booking_date: {
            [Op.gte]: today // Greater than or equal (>=) текущей даты
          }
        },
      } 
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/bookings/:id - Удаление бронирования
router.delete('/bookings/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const userChatId = req.query.chat_id; // Предполагаем, что chat_id передаётся в запросе

    // 1. Находим бронь в базе
    const booking = await Booking.findOne({
      where: { booking_id: bookingId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Бронирование не найдено' });
    }

    console.log(`пользователь из базы: ${booking.chat_id}, пользователь из запроса: ${userChatId}`);
    // 2. Проверяем, что пользователь удаляет свою бронь (или это админ)
    if (booking.chat_id != userChatId) {
      return res.status(403).json({ error: 'Нельзя удалить чужое бронирование' });
    }

    // 3. Удаляем бронь
    await booking.destroy();
    console.log(`Бронь ${bookingId} удалена пользователем ${userChatId}`);

    res.status(200).json({ message: 'Бронирование удалено' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/get-user', async (req, res) => {
  try {
    const { chat_id } = req.query; // Получаем chatId из query-параметров (?chatId=123)
    
    if (!chat_id) {
      return res.status(400).json({ error: 'chatId is required' });
    }
    
    const user = await User.findOne({ where: { chat_id: chat_id } });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//KIKS ADMIN API
// Получить все брони с текущей даты по chat_id
router.get('/get-bookings-by-chat-id', async (req, res) => {
  try {
    const { chat_id } = req.query;
    const bookings = await Booking.findAll(
      {
        where: {
          booking_date: {
            [Op.gte]: today // Greater than or equal (>=) текущей даты
          }, 
          chat_id: chat_id
        },
        order: [['booking_date', 'ASC']]
      } 
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить все брони с по клубу и по дате
router.get('/get-bookings-by-date', async (req, res) => {
  try {
    const { club_id, booking_date } = req.query;
    let formatted_booking_date = getDateFromString(booking_date);
    const startDate = new Date(formatted_booking_date);
    const endDate = new Date(formatted_booking_date);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    let bookings;

    if (club_id == 'all') {
      bookings = await Booking.findAll(
        {
          where: {
            booking_date: {[Op.between]: [startDate, endDate]  }, 
          },
          order: [
            ['club_id', 'ASC'],
            ['time', 'ASC'],
            ['table', 'ASC']
          ]
        } 
      );
    } else {
      bookings = await Booking.findAll(
      {
        where: {
          booking_date: {[Op.between]: [startDate, endDate]   }, 
          club_id: club_id
        },
        order: [
          ['time', 'ASC'],
          ['table', 'ASC']
        ]
      } 
    );
    }
    
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Получить все нерабочие дни с текущей даты
router.get('/get-dayoffs', async (req, res) => {
  try {
    const dayoffs = await Dayoffs.findAll(
      {
        where: {
          off_date: {
            [Op.gte]: today // Greater than or equal (>=) текущей даты
          }
        },
      } 
    );
    res.json(dayoffs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Создание нерабочего дня
router.post('/create-dayoff', async (req, res) => {
  try {
    const { club_id, off_date, off_reason } = req.body;

    // 1. Валидация обязательных полей
    if (!club_id || !off_date || !off_reason) {
      return res.status(400).json({
        error: 'Не указаны обязательные поля: клуб, дата, причина'
      });
    }

    // 2. Проверка формата даты (опционально, но рекомендуется)
    // const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    // if (!dateRegex.test(off_date)) {
    //   return res.status(400).json({
    //     error: 'off_date must be in YYYY-MM-DD format'
    //   });
    // }

    // 3. Создание записи в БД
    const newDayoff = await Dayoffs.create({
      club_id,
      off_date,
      off_reason
    });

    // 4. Ответ с созданной записью
    res.status(201).json({
      message: 'Нерабочий день успешно создан',
      data: newDayoff
    });

  } catch (err) {
    console.error('Ошибка при создании нерабочего дня:', err);

    // Обработка уникальных ошибок Sequelize
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: err.errors?.map(e => e.message)
      });
    }

    res.status(500).json({
      error: 'Ошибка при создании нерабочего дня',
      details: err.message
    });
  }
});

// Обновление blocked_status пользователя
router.patch('/update-blocked-status', async (req, res) => {
  try {
    const { chat_id, blocked_status } = req.body;
    // Валидация обязательных полей
    if (!chat_id) {
      return res.status(400).json({ error: 'не указан chat_id' });
    }

    // Поиск пользователя по chat_id
    const user = await User.findOne({ where: { chat_id: chat_id } });

    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Обновление поля blocked_status
    user.blocked_status = blocked_status;
    await user.save();

    res.json({
      message: 'blocked_status успешно обновлен',
      user: {
        chat_id: user.chat_id,
        blocked_status: user.blocked_status
      }
    });

  } catch (err) {
    // console.error('Ошибка при обновлении blocked_status:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;