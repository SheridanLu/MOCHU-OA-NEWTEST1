const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Project = sequelize.define('Project', {
  id: { type: DataTypes.STRING(10), primaryKey: true },
  name: { type: DataTypes.STRING, allowNull: false },
  status: { type: DataTypes.STRING, defaultValue: 'pending' },
  createdBy: { type: DataTypes.STRING, allowNull: false },
  budget: { type: DataTypes.DECIMAL(15, 2) }
});

module.exports = { sequelize, Project };
