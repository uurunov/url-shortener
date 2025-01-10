const express = require("express");
const { error } = require("node:console");
const crypto = require("node:crypto");
const { url } = require("node:inspector");
const path = require("path");

const app = express();
app.use(express.json()); // для парсинга JSON в теле запросов
app.use(express.static(path.join(__dirname, "public")));

// in-memory БД
// Пример структуры записи url:
// urlDatabase[shortUrl] = {
//   originalUrl: string,
//   createdAt: date,
//   expiresAt: date,
//   analytics: {
//     clicks: number,
//     log: [  // массив с информацией о переходах
//       { ip: string, date: date },
//       ...
//     ]
//   }
// }
const urlDatabase = {};

// 3 случайных байта преобразованы в 6 hex-символа
const generateRandomURLs = () => crypto.randomBytes(3).toString("hex");

const isURLExpired = (shortUrl) =>
  shortUrl.expiresAt ? new Date() >= new Date(shortUrl.expiresAt) : false;

/**
 * Создание короткой ссылки (POST /shorten)
 *
 * Тело запроса (JSON):
 * {
 *   "originalUrl": string, // required
 *   "alias": string, // optional
 *   "expiresAt": date // optional
 * }
 */
app.post("/shorten", (req, res) => {
  const { originalUrl, alias, expiresAt } = req.body;
  let shortUrl = "";

  if (!originalUrl) {
    return res.status(400).json({
      error: 'Поле "Оригинальный URL" обязательно',
      target: "url-input",
    });
  }

  if (alias) {
    if (alias.length > 20) {
      return res.status(400).json({
        error: "Псевдоним не должен превышать 20 символов",
        target: "alias-input",
      });
    }

    if (urlDatabase[alias]) {
      return res.status(409).json({
        error: "Такой псевдоним уже используется",
        target: "alias-input",
      });
    }

    shortUrl = alias;
  } else {
    // Генерируем случайный shortUrl проверяя уникальность
    do {
      shortUrl = generateRandomURLs();
    } while (urlDatabase[shortUrl]);
  }

  // Создаём запись
  urlDatabase[shortUrl] = {
    originalUrl,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null,
    analytics: {
      clicks: 0,
      log: [],
    },
  };

  return res.status(201).json({
    shortUrl,
    originalUrl,
    createdAt: urlDatabase[shortUrl].createdAt,
    expiresAt: urlDatabase[shortUrl].expiresAt,
    clicks: urlDatabase[shortUrl].analytics.clicks,
  });
});

/**
 * Переадресация (GET /:shortUrl)
 *
 * - Если shortUrl не найден, 404
 * - Если срок жизни истёк, 410 Gone
 * - Иначе записываем (ip, date) и переадресуем на оригинальный URL
 */
app.get("/:shortUrl", (req, res) => {
  const { shortUrl } = req.params;
  const recordedUrl = urlDatabase[shortUrl];

  if (!recordedUrl) {
    return res.status(404).json({ error: "Ссылка не найдена" });
  }

  if (isURLExpired(recordedUrl)) {
    return res
      .status(410)
      .json({ error: "Срок действия ссылки истёк (410 Gone)" });
  }

  recordedUrl.analytics.clicks += 1;
  recordedUrl.analytics.log.push({
    ip: req.ip,
    date: new Date().toISOString(),
  });

  return res.redirect(recordedUrl.originalUrl);
});

/**
 * Получение информации о короткой ссылке (GET /info/:shortUrl)
 *
 * - Если не найдено, 404
 * - Если ссылка истекла, 410 Gone
 * - Возвращаем JSON с полями: shortUrl, originalUrl, createdAt, expiresAt, clicks
 */
app.get("/info/:shortUrl", (req, res) => {
  const { shortUrl } = req.params;
  const recordedUrl = urlDatabase[shortUrl];

  if (!recordedUrl) {
    return res.status(404).json({ error: "Ссылка не найдена" });
  }

  if (isURLExpired(recordedUrl)) {
    return res
      .status(410)
      .json({ error: "Срок действия ссылки истёк (410 Gone)" });
  }

  return res.json({
    shortUrl,
    originalUrl: recordedUrl.originalUrl,
    createdAt: recordedUrl.createdAt,
    expiresAt: recordedUrl.expiresAt,
    clicks: recordedUrl.analytics.clicks,
  });
});

/**
 * Аналитика переходов (GET /analytics/:shortUrl)
 * Возвращает общее количество переходов (clicks) и последние 5 IP-адресов
 */
app.get("/analytics/:shortUrl", (req, res) => {
  const { shortUrl } = req.params;
  const recordedUrl = urlDatabase[shortUrl];

  if (!recordedUrl) {
    return res.status(404).json({ error: "Ссылка не найдена" });
  }

  const { clicks, log } = recordedUrl.analytics;
  const lastFive = log.slice(log.length - (log.length + 5));

  return res.json({ shortUrl, totalClicks: clicks, lastFive });
});

/**
 * Удаление короткой ссылки (DELETE /delete/:shortUrl)
 */
app.delete("/delete/:shortUrl", (req, res) => {
  const { shortUrl } = req.params;

  if (!urlDatabase[shortUrl]) {
    return res.status(404).json({ error: "Ссылка не найдена" });
  }

  delete urlDatabase[shortUrl];
  return res.status(200).json({ message: `Ссылка "${shortUrl}" удалена.` });
});

module.exports.urlDatabase = urlDatabase; // экспортируем базу в тестах
module.exports = app;
