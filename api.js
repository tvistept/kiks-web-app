// routes/api.js
const express = require('express');
const router = express.Router();
const models = require('./models');
const { Op } = require('sequelize');
const { User, Booking } = models;
const today = new Date();
today.setHours(0, 0, 0, 0); // Устанавливаем время на начало дня (00:00:00)

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
      } 
    );
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;