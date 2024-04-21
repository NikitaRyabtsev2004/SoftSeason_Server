const express = require("express");
const nodemailer = require("nodemailer");

const server = express();

server.use(express.static(__dirname + '/public'));
server.use(express.json());

const cors = require('cors');
server.use(cors());

const fs = require('fs');
const path = require('path');
const dbPath = path.join(__dirname, 'dataBase.db');
const sqlite3 = require('sqlite3').verbose();

if (!fs.existsSync(dbPath)) {
  fs.openSync(dbPath, 'w');
  const db = new sqlite3.Database(dbPath);
  const sql = fs.readFileSync('../shop/src/server/schema.sql').toString();
  db.exec(sql);
  db.close();
}

const db = new sqlite3.Database(dbPath);

const sql = fs.readFileSync('../shop/src/server/schema.sql').toString();

db.exec(sql);

const generateVerifyCode = () => {
  const code = Math.floor(1000 + Math.random() * 9000).toString();
  return code
}

const jwt = require('jsonwebtoken');

const bcrypt = require('bcrypt');

server.post('/submitReview', (req, res) => {
  const { email, review } = req.body;
  const date = new Date().toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  db.run('INSERT INTO reviews (email, review, date) VALUES (?, ?, ?)', [email, review, date], function (err) {
    if (err) {
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
    return res.status(200).send({ status: 200, message: "Review submitted successfully" });
  });
});

server.get('/getReviews', (req, res) => {
  db.all('SELECT * FROM reviews', [], (err, rows) => {
    if (err) {
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
    return res.status(200).send({ status: 200, reviews: rows });
  });
});


server.post('/newLogin', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const userId = req.body.userId;

  const hashedPassword = await bcrypt.hash(password, 10);
  db.run('INSERT INTO users (email, password, userId) VALUES (?, ?, ?)', [email, hashedPassword, userId], function (err) {
    if (err) {
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
  });
})

server.post('/register', async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
    if (row) {
      const isMatch = await bcrypt.compare(password, row.password);
      if (!isMatch) {
        // Если пароль не совпадает, предлагаем изменить пароль
        return res.status(400).send({ status: 400, message: "Incorrect password" });
      } else {
        // Если пароль совпадает, пользователь может войти без кода подтверждения
        return res.status(200).send({ status: 200, message: "Login successful" });
      }
    } else {
      // Для новых пользователей генерируем код подтверждения и отправляем его
      const verifyCode = generateVerifyCode();
      let responseSent = false;
      try {
        const transporter = nodemailer.createTransport({
          host: "smtp.yandex.ru",
          port: 465,
          secure: true,
          auth: {
            user: "NikitaRyabtsev2004@yandex.ru",
            pass: "oqlgrgpglfyctpdk",
          },
        });
        await transporter.sendMail({
          from: "NikitaRyabtsev2004@yandex.ru",
          to: "NikitaRyabtsev2004@yandex.ru",
          subject: "Ваш код для проверки",
          text: `Ваш код для проверки: ${verifyCode}`,
          html: `<p>Ваш логин для входа: ${email}</p>
                          <p>Пароль: ${password}</p>
                          <p>Код для проверки: ${verifyCode}</p>
                          <p></p>
                          <p>Если вы ввели какие-либо данные некорректно, то можете перейти по ссылке и вписать новые данные регистрации,</p>
                          <p>в случае, если это сообщение ничего вам не говорит, то игнорируйте.</p>`,
        });
        const token = jwt.sign({ code: verifyCode }, 'shhhhhhared-secret', { expiresIn: '1h' });
        if (!responseSent) {
          responseSent = true;
          return res.status(200).send({ status: 200, message: "Success", token: token });
        }
      } catch (e) {
        if (!responseSent) {
          responseSent = true;
          return res.status(500).send({ status: 500, message: "Internal server error" });
        }
      }
    }
  });
});

server.post('/changePassword', async (req, res) => {
  const email = req.body.email;
  const newPassword = req.body.newPassword;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
    if (!row) {
      return res.status(404).send({ status: 404, message: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, email], function (err) {
      if (err) {
        return res.status(500).send({ status: 500, message: "Internal server error" });
      }
      return res.status(200).send({ status: 200, message: "Password updated successfully" });
    });
  });
});

server.post('/submit', async (req, res) => {
  const email = req.body.email;
  const ip = req.body.ip;
  const name = req.body.name;
  const phone = req.body.phone;
  const message = req.body.message;
  const order = req.body.order;
  const userId = req.body.userId;

  let responseSent = false;

  db.run('INSERT INTO orders (userId, date, message, phone, "order") VALUES (?, ?, ?, ?, ?)', [userId, new Date().toISOString(), message, phone, order], function (err) {
    if (err) {
      responseSent = true;
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }

    if (!responseSent) {
      responseSent = true;
      return res.status(200).send({ status: 200, message: "Success" });
    }
  });

  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.yandex.ru",
      port: 465,
      secure: true,
      auth: {
        user: "NikitaRyabtsev2004@yandex.ru",
        pass: "oqlgrgpglfyctpdk",
      },
    });

    await transporter.sendMail({
      from: "NikitaRyabtsev2004@yandex.ru",
      to: "NikitaRyabtsev2004@yandex.ru",
      subject: `${name} (${phone})`,
      text: name,
      html: `
          <p>${name}</p>
          <p>${phone}</p>
          <p>${message}</p>
          <p>${order}</p>
          <p>${ip}</p>
          <div>personal data</div>
          <p>${email}</p>
          `,
    });

    if (!responseSent) {
      responseSent = true;
      return res.status(200).send({ status: 200, message: "Success" });
    }
  } catch (e) {
    if (!responseSent) {
      responseSent = true;
      return res.status(500).send({ status: 500, message: "Internal server error" });
    }
  }
});

server.listen(2000, () => {
  console.log(`App listening on port 2000:`);
});