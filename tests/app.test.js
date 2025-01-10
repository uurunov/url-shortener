const request = require("supertest"); // позволяет нам делать HTTP-запросы к объекту app напрямую
const app = require("../app");
const { urlDatabase } = require("../app"); // для очищение urlDatabase перед каждым тестом

describe("URL Shortener API", () => {
  afterEach(() => {
    for (const key in urlDatabase) {
      delete urlDatabase[key];
    }
  });

  test("POST /shorten - Создание ссылки с уникальным alias", async () => {
    const response = await request(app)
      .post("/shorten")
      .send({
        originalUrl: "https://music.yandex.ru/",
        alias: "my-fav-music",
      })
      .expect(201);

    expect(response.body).toHaveProperty("shortUrl", "my-fav-music");
    expect(response.body).toHaveProperty(
      "originalUrl",
      "https://music.yandex.ru/"
    );
  });

  test("GET /:shortUrl - Переадресацию на оригинальный URL", async () => {
    // создадим ссылку
    const res = await request(app)
      .post("/shorten")
      .send({ originalUrl: "https://music.yandex.ru/", alias: "my-music" });

    const shortUrl = res.body.shortUrl;
    console.log(res.body);

    // запрашиваем ссылку
    const response = await request(app).get(`/${shortUrl}`).expect(302); // 302 Redirect
    expect(response.header.location).toBe("https://music.yandex.ru/");
  });
});
