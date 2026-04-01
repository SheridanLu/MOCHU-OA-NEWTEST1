const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Approval = sequelize.define('Approval', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  projectId: { type: DataTypes.STRING(10), allowNull: false },
  step: { type: DataTypes.STRING, allowNull: false }, // BUDGET_REVIEW, GM_APPROVAL
  status: { type: DataTypes.STRING, defaultValue: 'pending' }, // PENDING, APPROVED, REJECTED
  comment: { type: DataTypes.STRING },
  operator: { type: DataTypes.STRING }
});

module.exports = { Approval };
