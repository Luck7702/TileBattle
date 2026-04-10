const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function requireJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required");
  return secret;
}

function signToken(user) {
  const secret = requireJwtSecret();
  return jwt.sign({ sub: String(user.id), username: user.username }, secret, {
    expiresIn: "7d",
  });
}

function verifyToken(token) {
  const secret = requireJwtSecret();
  return jwt.verify(token, secret);
}

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  verifyPassword,
};
