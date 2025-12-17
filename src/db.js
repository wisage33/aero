const { Sequelize, DataTypes } = require('sequelize')

const sequelize = new Sequelize({
  dialect: 'mysql',
  host: 'localhost',
  username: 'root',
  password: 'example',
  database: 'mydb',
  port: 3306,
})

const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    }
  },
  {
    timestamps: false,
    indexes: [
      { unique: true, fields: ['id'] }
    ]
  }
)

const File = sequelize.define(
  'File',
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false
    },
    extension: {
      type: DataTypes.STRING,
    },
    mimeType: {
      type: DataTypes.STRING,
    },
    size: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    uploadAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    timestamps: false,
    indexes: [
      { fields: ['name', 'id'] }
    ]
  }
)

const Token = sequelize.define(
  'Token',
  {
    jti: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deviceId: {
      type: DataTypes.STRING,
      allowNull: true
    },
    revoked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    timestamps: false,
    indexes: [
      { fields: ['userId'] }
    ]
  }
)

const BlacklistedToken = sequelize.define(
  'BlacklistedToken',
  {
    jti: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false
    }
  },
  {
    timestamps: false
  }
)

async function initDb() {
  await sequelize.sync({ alter: true })
  console.log('Database synchronized')
}

module.exports = {
  sequelize,
  User,
  File,
  Token,
  BlacklistedToken,
  initDb
}