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

// // Получить пользователя
// router.get('/get-user:chat_id', async (req, res) => {
//   try {
//     const user = await User.findOne({ where: { chat_id: chat_id } });
//     res.json(user);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

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

module.exports = router;