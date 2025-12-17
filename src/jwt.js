const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET = process.env.JWT_SECRET || 'your-secret-key';

function generateToken(payload) {
  // create jwt ids for access and refresh tokens so we can track them
  const accessJti = uuidv4();
  const refreshJti = uuidv4();

  const accessToken = jwt.sign(payload, SECRET, { expiresIn: '10m', jwtid: accessJti });
  const refreshToken = jwt.sign(payload, SECRET, { expiresIn: '7d', jwtid: refreshJti });

  return { accessToken, refreshToken, accessJti, refreshJti };
}

function verifyToken(token) {
  return jwt.verify(token, SECRET);
}

module.exports = {
  generateToken,
  verifyToken
}