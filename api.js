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

// Получить все брони по клубу и по дате
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

// Удаление брони по booking_id
router.delete('/delete-booking/:booking_id', async (req, res) => {
  try {
    const { booking_id } = req.params;

    // 1. Валидация параметра
    if (!booking_id) {
      return res.status(400).json({
        error: 'не передан параметр booking_id'
      });
    }

    // 2. Проверка, что booking_id — число
    const bookingIdNum = parseInt(booking_id, 10);
    if (isNaN(bookingIdNum)) {
      return res.status(400).json({
        error: 'параметр booking_id должен быть числом'
      });
    }

    // 3. Поиск записи
    const booking = await Booking.findOne({ where: { booking_id: bookingIdNum } });

    if (!booking) {
      return res.status(404).json({
        error: 'Бронь не найдена'
      });
    }

    // 4. Удаление записи
    await booking.destroy();

    res.json({
      message: 'Бронь успешно удалена',
      deletedId: bookingIdNum
    });

  } catch (err) {
    console.error('Ошибка при удалении брони:', err);

    res.status(500).json({
      error: 'Не удалось удалить бронь',
      details: err.message
    });
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

// Маршрут: удаление дня отдыха по off_id
router.delete('/delete-dayoff/:off_id', async (req, res) => {
  try {
    const { off_id } = req.params;

    // 1. Валидация параметра
    if (!off_id) {
      return res.status(400).json({
        error: 'off_id is required'
      });
    }

    // 2. Проверка, что off_id — число
    const offIdNum = parseInt(off_id, 10);
    if (isNaN(offIdNum)) {
      return res.status(400).json({
        error: 'off_id must be a valid number'
      });
    }

    // 3. Поиск записи
    const dayoff = await Dayoffs.findOne({ where: { off_id: offIdNum } });

    if (!dayoff) {
      return res.status(404).json({
        error: 'Dayoff not found'
      });
    }

    // 4. Удаление записи
    await dayoff.destroy();

    res.json({
      message: 'Dayoff deleted successfully',
      deletedId: offIdNum
    });

  } catch (err) {
    console.error('Error deleting dayoff:', err);

    res.status(500).json({
      error: 'Failed to delete dayoff',
      details: err.message
    });
  }
});

// Получить все закрытые слоты текущей даты
router.get('/get-closed-slots', async (req, res) => {
  try {
    const closedSlots = await Booking.findAll({
      where: {
        chat_id: -2,
        booking_date: {
            [Op.gte]: today // Greater than or equal (>=) текущей даты
          }, 
      },
      attributes: [
        ['booking_id', 'id'],
        ['user_name', 'signature'],
        ['booking_date', 'date'],
        ['time', 'time'],
        ['hours', 'hours'],
        ['table', 'table'],
        ['club_id', 'club']
      ],
      order: [['booking_date', 'ASC']]
    });
    res.json(closedSlots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Удаление закрытого слота по booking_id
router.delete('/delete-closed-slot/:booking_id', async (req, res) => {
  try {
    const { booking_id } = req.params;

    // 1. Валидация параметра
    if (!booking_id) {
      return res.status(400).json({
        error: 'не передан параметр booking_id'
      });
    }

    // 2. Проверка, что booking_id — число
    const bookingIdNum = parseInt(booking_id, 10);
    if (isNaN(bookingIdNum)) {
      return res.status(400).json({
        error: 'параметр booking_id должен быть числом'
      });
    }

    // 3. Поиск записи
    const closedSlot = await Booking.findOne({ where: { booking_id: bookingIdNum } });

    if (!closedSlot) {
      return res.status(404).json({
        error: 'Закрытый слот не найден'
      });
    }

    // 4. Удаление записи
    await closedSlot.destroy();

    res.json({
      message: 'Закрытый слот успешно удален',
      deletedId: bookingIdNum
    });

  } catch (err) {
    console.error('Ошибка при удалении закрытого слота:', err);

    res.status(500).json({
      error: 'Не удалось удалить закрытый слот',
      details: err.message
    });
  }
});

// Создание закрытого слота
router.post('/create-closed-slot', async (req, res) => {
  try {
    const { club_id, booking_date, user_name, time, hours, table } = req.body;

    // 1. Валидация обязательных полей
    if (!club_id || !booking_date || !user_name || !time || !hours || !table) {
      return res.status(400).json({
        error: 'Не указаны обязательные поля: клуб, дата, причина, время, часы, стол'
      });
    }

    if (table == -1) {
      let tables
      if (club_id == 'kiks1') {
        tables = [3, 4, 5, 6];
      } else {
        tables = [3, 4, 6, 7, 8];
      }

      for (const table of tables) {
        const newClosedSlot = await Booking.create({
          chat_id: -2,
          user_name,
          booking_date,
          time,
          hours,
          table,
          club_id
        });

         res.status(201).json({
          message: 'Закрытый слот успешно создан',
          data: newClosedSlot
        });
      }
    } else {
      // 3. Создание записи в БД
      const newClosedSlot = await Booking.create({
        chat_id: -2,
        user_name,
        booking_date,
        time,
        hours,
        table,
        club_id
      });

      // 4. Ответ с созданной записью
      res.status(201).json({
        message: 'Закрытый слот успешно создан',
        data: newClosedSlot
      });
    }

  } catch (err) {
    console.error('Ошибка при создании закрытого слота:', err);

    // Обработка уникальных ошибок Sequelize
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        details: err.errors?.map(e => e.message)
      });
    }

    res.status(500).json({
      error: 'Ошибка при создании закрытого слота',
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