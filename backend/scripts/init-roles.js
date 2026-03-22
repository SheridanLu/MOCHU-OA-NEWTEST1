/**
 * 初始化预置角色
 */
const { db } = require('../models/database');

function initRoles() {
  console.log('开始初始化预置角色...');

  const roles = [
    { name: '总经理', code: 'GM', description: '拥有所有权限' },
    { name: '财务管理', code: 'FINANCE', description: '财务相关权限' },
    { name: '项目经理', code: 'PROJ_MGR', description: '项目管理权限' },
    { name: '采购员', code: 'PURCHASE', description: '采购相关权限' },
    { name: '法务', code: 'LEGAL', description: '法务审核权限' },
    { name: '预算员', code: 'BUDGET', description: '预算管理权限' },
    { name: '基地', code: 'BASE', description: '基础权限' },
    { name: '资料员', code: 'ARCHIVIST', description: '资料管理权限，负责文档归档、图纸管理、库存出入库' }
  ];

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO roles (name, code, description, status)
    VALUES (?, ?, ?, 'active')
  `);

  roles.forEach(role => {
    try {
      insertStmt.run(role.name, role.code, role.description);
      console.log(`角色 ${role.name} (${role.code}) 初始化成功`);
    } catch (error) {
      if (!error.message.includes('UNIQUE constraint failed')) {
        console.error(`角色 ${role.name} 初始化失败:`, error.message);
      }
    }
  });

  console.log('预置角色初始化完成');
}

module.exports = { initRoles };

// 如果直接运行此脚本
if (require.main === module) {
  initRoles();
}
