const express = require('express');
const sequelize = require('sequelize');
const bcrypt = require('bcrypt');
const { generateToken, verifyToken } = require('./src/jwt');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const { User, initDb, Token, BlacklistedToken } = require('./src/db');
const fileUpload = require('express-fileupload');
const filesRouter = require('./src/files');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(fileUpload());

const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).send({ message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);

    const black = await BlacklistedToken.findOne({ where: { jti: payload.jti } });
    if (black) {
      return res.status(401).send({ message: 'Token revoked' });
    }

    req.user = payload;
    next();
  } catch (e) {
    return res.status(401).send({ message: 'Invalid or expired token' });
  }
}

app.post('/signin', async (req, res) => {
  const { id, password } = req.body;

  const user = await User.findOne({ where: { id } });

  if (user === null) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }

  const { accessToken, refreshToken } = generateToken({ id: user.id });
  await Token.create({ jti: verifyToken(refreshToken).jti, userId: user.id, deviceId: req.headers['x-device-id'] || null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });

  res.status(200).send({ message: 'Signin successful', accessToken, refreshToken });
})

app.post('/signup', async (req, res) => {
  const { id, password } = req.body;

  const emailRegExp = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/
  const phoneRegExp = /^(\+?\d{1,3}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,9}$/
  const simpleRegExp = /^\+?[1-9]\d{9,14}$/;

  if (!emailRegExp.test(id) && !phoneRegExp.test(id) && !simpleRegExp.test(id)) {
    return res.status(400).send({ message: 'Invalid email or phone number format' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    await User.create({ id, password: hashedPassword });
  } catch (e) {
    if (e instanceof sequelize.UniqueConstraintError) {
      return res.status(409).send({ message: 'User already exists' });
    }
  }

  const { accessToken, refreshToken } = generateToken({ id });
  await Token.create({ jti: verifyToken(refreshToken).jti, userId: id, deviceId: req.headers['x-device-id'] || null, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

  res.cookie('refreshToken', refreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });

  res.status(201).send({ message: 'User created successfully', accessToken, refreshToken });
})
app.post('/signin/new_token', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).send({ message: 'No refresh token provided' });
  }

  let payload;
  try {
    payload = verifyToken(refreshToken);
  } catch (e) {
    return res.status(401).send({ message: 'Invalid refresh token' });
  }

  const tokenRow = await Token.findOne({ where: { jti: payload.jti, revoked: false } });
  if (!tokenRow || tokenRow.expiresAt < new Date()) {
    return res.status(401).send({ message: 'Refresh token revoked or expired' });
  }

  const user = await User.findOne({ where: { id: payload.id } })
  if (user === null) {
    return res.status(401).send({ message: 'User not found' });
  }
  const { accessToken, refreshToken: newRefreshToken } = generateToken({ id: user.id });

  await tokenRow.update({ revoked: true });

  await Token.create({ jti: verifyToken(newRefreshToken).jti, userId: user.id, deviceId: tokenRow.deviceId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

  res.cookie('refreshToken', newRefreshToken, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });

  res.status(200).send({ message: 'New tokens generated', accessToken, refreshToken: newRefreshToken });
})

app.get('/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  const authHeader = req.headers.authorization;

  (async () => {
    try {
      if (refreshToken) {
        try {
          const payload = verifyToken(refreshToken);
          const tokenRow = await Token.findOne({ where: { jti: payload.jti } });
          if (tokenRow) await tokenRow.update({ revoked: true });
        } catch (e) {
        }
      }

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const accessToken = authHeader.split(' ')[1];
        try {
          const payload = verifyToken(accessToken);
          await BlacklistedToken.create({ jti: payload.jti, expiresAt: new Date(payload.exp * 1000) });
        } catch (e) {
          const decoded = require('jsonwebtoken').decode(accessToken);
          if (decoded && decoded.jti) {
            await BlacklistedToken.create({ jti: decoded.jti, expiresAt: new Date(decoded.exp * 1000) });
          }
        }
      }

      res.clearCookie('refreshToken');
      res.status(200).send({ message: 'Logged out successfully' });
    } catch (e) {
      res.status(500).send({ message: 'Logout failed' });
    }
  })();
})

app.get('/info', authenticate, async (req, res) => {
  const user = await User.findOne({ where: { id: req.user.id }, attributes: ['id'] });

  if (user === null) {
    return res.status(404).send({ message: 'User not found' });
  }

  res.status(200).send({ user });
})

app.use('/file', authenticate, filesRouter);

async function start() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (e) {
    console.log('Failed to connect to the database:', e);
    process.exit(1);
  }
}

start();