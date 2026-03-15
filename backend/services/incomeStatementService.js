/**
 * 收入对账单服务
 * Task 45: 实现收入对账单每月25日自动生成功能
 */

const { db } = require('../models/database');

/**
 * 生成对账单编号
 * 格式：ZD + YYMM + 项目编号后4位
 * @param {string} projectNo - 项目编号
 * @returns {string} 对账单编号
 */
/**
 * 生成对账单编号
 * 格式：项目编号-ZD + 序号（如：P260312002-ZD01）
 * @param {number} projectId - 项目ID
 * @returns {string} 对账单编号
 */
function generateStatementNo(projectId) {
  // 获取项目编号
  const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }
  
  const projectNo = project.project_no;
  
  // 获取该项目已有对账单数量（包括已删除的，确保编号不重复）
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM income_statements WHERE project_id = ?
  `).get(projectId);
  
  // 从1开始尝试，直到找到未使用的编号
  let seq = (count?.total || 0) + 1;
  let statementNo;
  let exists;
  
  do {
    const seqStr = String(seq).padStart(2, '0');
    statementNo = `${projectNo}-ZD${seqStr}`;
    
    // 检查该编号是否已存在
    exists = db.prepare('SELECT id FROM income_statements WHERE statement_no = ?').get(statementNo);
    if (exists) {
      seq++;
    }
  } while (exists);
  
  return statementNo;
}

/**
 * 检查指定项目在指定月份是否已存在对账单
 * @param {number} projectId - 项目ID
 * @param {string} periodStart - 期间开始日期
 * @param {string} periodEnd - 期间结束日期
 * @returns {boolean}
 */
function checkExistingStatement(projectId, periodStart, periodEnd) {
  const existing = db.prepare(`
    SELECT id FROM income_statements 
    WHERE project_id = ? AND period_start = ? AND period_end = ?
  `).get(projectId, periodStart, periodEnd);
  return !!existing;
}

/**
 * 获取项目的收入合同信息
 * @param {number} projectId - 项目ID
 * @returns {object|null}
 */
function getProjectContract(projectId) {
  return db.prepare(`
    SELECT * FROM contracts 
    WHERE project_id = ? AND type = 'income' AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(projectId);
}

/**
 * 计算项目进度产值
 * Task 45 & 55: 根据施工进度填报计算项目进度产值
 * @param {number} projectId - 项目ID
 * @param {string} periodEnd - 期间结束日期（可选，用于获取截至某日期的进度）
 * @returns {object} { progressAmount, progressRate, details, workContent }
 */
function calculateProgress(projectId, periodEnd = null) {
  // 获取项目合同金额（优先使用合同表，否则使用项目表）
  const project = db.prepare(`
    SELECT p.*, 
      COALESCE(c.amount, p.contract_amount) as contract_amount
    FROM projects p
    LEFT JOIN contracts c ON p.id = c.project_id AND c.type = 'income' AND c.status = 'active'
    WHERE p.id = ?
  `).get(projectId);

  if (!project) {
    return { progressAmount: 0, progressRate: 0, details: [], workContent: '' };
  }

  const contractAmount = parseFloat(project.contract_amount) || 0;

  // 从施工进度填报获取最新进度
  let constructionProgress = null;
  let progressRate = 0;
  let workContent = '';
  
  try {
    // 获取最新的施工进度填报记录（状态为 submitted 或 approved）
    const progressQuery = periodEnd 
      ? `SELECT * FROM construction_progress WHERE project_id = ? AND report_date <= ? AND status IN ('submitted', 'approved') ORDER BY report_date DESC LIMIT 1`
      : `SELECT * FROM construction_progress WHERE project_id = ? AND status IN ('submitted', 'approved') ORDER BY report_date DESC LIMIT 1`;
    
    const params = periodEnd ? [projectId, periodEnd] : [projectId];
    constructionProgress = db.prepare(progressQuery).get(...params);
    
    if (constructionProgress) {
      progressRate = parseFloat(constructionProgress.progress_rate) || 0;
      workContent = constructionProgress.work_content || '';
    }
  } catch (e) {
    console.log('获取施工进度失败:', e.message);
  }

  // 如果没有施工进度，使用出库金额计算
  if (!constructionProgress || progressRate === 0) {
    const stockOutTotal = db.prepare(`
      SELECT COALESCE(SUM(so.total_amount), 0) as total
      FROM stock_out so
      WHERE so.project_id = ? AND so.status = 'confirmed'
    `).get(projectId);

    const stockAmount = parseFloat(stockOutTotal?.total || 0);
    progressRate = contractAmount > 0 ? Math.min((stockAmount / contractAmount) * 100, 100) : 0;
  }

  // 计算累计产值 = 合同金额 × 进度百分比
  const progressAmount = Math.round(contractAmount * progressRate / 100 * 100) / 100;

  // 获取施工进度历史明细
  const progressHistory = db.prepare(`
    SELECT report_date, progress_rate, work_content
    FROM construction_progress
    WHERE project_id = ? AND status = 'approved'
    ORDER BY report_date DESC
    LIMIT 5
  `).all(projectId);

  // 构建明细
  const details = [
    {
      item_name: '施工进度产值',
      description: workContent || '根据施工进度填报计算',
      amount: progressAmount,
      progress_value: progressRate
    }
  ];

  // 添加历史进度明细
  if (progressHistory.length > 0) {
    progressHistory.forEach((h, index) => {
      const histAmount = Math.round(contractAmount * (h.progress_rate || 0) / 100 * 100) / 100;
      details.push({
        item_name: `进度记录 (${h.report_date})`,
        description: h.work_content || '',
        amount: histAmount,
        progress_value: h.progress_rate || 0
      });
    });
  }

  return {
    progressAmount,
    progressRate: Math.round(progressRate * 100) / 100,
    details,
    workContent,
    constructionProgressId: constructionProgress?.id || null
  };
}

/**
 * 同步合同信息
 * @param {number} projectId - 项目ID
 * @returns {object} 合同信息
 */
function syncContract(projectId) {
  const contract = getProjectContract(projectId);
  
  if (!contract) {
    // 尝试从项目获取合同金额
    const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
    return {
      contractId: null,
      contractAmount: parseFloat(project?.contract_amount) || 0
    };
  }

  return {
    contractId: contract.id,
    contractAmount: parseFloat(contract.amount) || 0
  };
}

/**
 * 生成月度对账单
 * @param {number} projectId - 项目ID
 * @param {object} options - 可选配置
 * @param {string} options.periodStart - 自定义期间开始日期
 * @param {string} options.periodEnd - 自定义期间结束日期
 * @param {number} options.creatorId - 创建人ID
 * @returns {object} 创建的对账单
 */
function generateMonthly(projectId, options = {}) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed

  // 计算期间（默认为上月）
  let periodStart, periodEnd;
  
  if (options.periodStart && options.periodEnd) {
    periodStart = options.periodStart;
    periodEnd = options.periodEnd;
  } else {
    // 上月第一天到上月最后一天
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    periodStart = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-01`;
    periodEnd = `${lastMonthYear}-${String(lastMonth + 1).padStart(2, '0')}-${new Date(lastMonthYear, lastMonth + 1, 0).getDate()}`;
  }

  // 获取项目信息
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }

  // 只为实体项目生成对账单
  if (project.type !== 'entity') {
    throw new Error('只能为实体项目生成对账单');
  }

  // 检查是否已存在对账单
  if (checkExistingStatement(projectId, periodStart, periodEnd)) {
    throw new Error('该期间已存在对账单');
  }

  // 同步合同信息
  const contractInfo = syncContract(projectId);

  // 计算进度（传入期间结束日期以获取截至该日期的施工进度）
  const progressInfo = calculateProgress(projectId, periodEnd);

  // 生成对账单编号（使用项目ID）
  const statementNo = generateStatementNo(projectId);

  // 计算确认金额和差异
  const confirmedAmount = Math.round(contractInfo.contractAmount * progressInfo.progressRate / 100 * 100) / 100;
  const difference = Math.round((progressInfo.progressAmount - confirmedAmount) * 100) / 100;

  // 使用事务插入数据
  const transaction = db.transaction(() => {
    // 插入对账单主表（包含施工进度关联和形象进度描述）
    const result = db.prepare(`
      INSERT INTO income_statements (
        statement_no, project_id, contract_id,
        period_start, period_end,
        contract_amount, progress_amount, progress_rate,
        confirmed_amount, difference,
        construction_progress_id, progress_description,
        status, creator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      statementNo,
      projectId,
      contractInfo.contractId,
      periodStart,
      periodEnd,
      contractInfo.contractAmount,
      progressInfo.progressAmount,
      progressInfo.progressRate,
      confirmedAmount,
      difference,
      progressInfo.constructionProgressId || null,
      progressInfo.workContent || null,
      'draft',
      options.creatorId || null
    );

    const statementId = result.lastInsertRowid;

    // 插入对账单明细
    progressInfo.details.forEach((detail, index) => {
      db.prepare(`
        INSERT INTO income_statement_details (
          statement_id, item_name, description, amount, progress_value, sort_order
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        statementId,
        detail.item_name,
        detail.description,
        detail.amount,
        detail.progress_value,
        index
      );
    });

    return statementId;
  });

  const statementId = transaction();

  // 返回创建的对账单
  return getStatementById(statementId);
}

/**
 * 获取对账单详情
 * @param {number} id - 对账单ID
 * @returns {object|null}
 */
function getStatementById(id) {
  const statement = db.prepare(`
    SELECT s.*,
           p.name as project_name, p.project_no,
           c.name as contract_name, c.contract_no,
           u.real_name as creator_name,
           cu.real_name as confirmer_name
    FROM income_statements s
    LEFT JOIN projects p ON s.project_id = p.id
    LEFT JOIN contracts c ON s.contract_id = c.id
    LEFT JOIN users u ON s.creator_id = u.id
    LEFT JOIN users cu ON s.confirmed_by = cu.id
    WHERE s.id = ?
  `).get(id);

  if (statement) {
    // 获取明细
    statement.details = db.prepare(`
      SELECT * FROM income_statement_details 
      WHERE statement_id = ? 
      ORDER BY sort_order
    `).all(id);
  }

  return statement;
}

/**
 * 获取对账单列表
 * @param {object} filters - 筛选条件
 * @returns {object} { data, pagination }
 */
function getStatements(filters = {}) {
  const { projectId, status, yearMonth, page = 1, pageSize = 20 } = filters;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let sql = `
    SELECT s.*,
           p.name as project_name, p.project_no,
           c.name as contract_name, c.contract_no,
           u.real_name as creator_name
    FROM income_statements s
    LEFT JOIN projects p ON s.project_id = p.id
    LEFT JOIN contracts c ON s.contract_id = c.id
    LEFT JOIN users u ON s.creator_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (projectId) {
    sql += ` AND s.project_id = ?`;
    params.push(projectId);
  }

  if (status) {
    sql += ` AND s.status = ?`;
    params.push(status);
  }

  if (yearMonth) {
    sql += ` AND strftime('%Y-%m', s.period_start) = ?`;
    params.push(yearMonth);
  }

  // 获取总数
  const countSql = sql.replace(
    /SELECT s\.\*,.*?FROM/,
    'SELECT COUNT(*) as total FROM'
  );
  const countResult = db.prepare(countSql).get(...params);
  const total = countResult?.total || 0;

  // 排序和分页
  sql += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(pageSize), offset);

  const data = db.prepare(sql).all(...params);

  return {
    data,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total
    }
  };
}

/**
 * 更新对账单
 * @param {number} id - 对账单ID
 * @param {object} updates - 更新内容
 * @returns {object} 更新后的对账单
 */
function updateStatement(id, updates) {
  const statement = db.prepare('SELECT * FROM income_statements WHERE id = ?').get(id);
  
  if (!statement) {
    throw new Error('对账单不存在');
  }

  if (statement.status === 'confirmed') {
    throw new Error('已确认的对账单不能修改');
  }

  const allowedFields = ['progress_rate', 'confirmed_amount', 'difference', 'remark'];
  const updateParts = [];
  const params = [];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key) && updates[key] !== undefined) {
      updateParts.push(`${key} = ?`);
      params.push(updates[key]);
    }
  });

  if (updateParts.length > 0) {
    updateParts.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    db.prepare(`UPDATE income_statements SET ${updateParts.join(', ')} WHERE id = ?`).run(...params);
  }

  return getStatementById(id);
}

/**
 * 确认对账单
 * @param {number} id - 对账单ID
 * @param {number} userId - 确认人ID
 * @returns {object} 确认后的对账单
 */
function confirmStatement(id, userId) {
  const statement = db.prepare('SELECT * FROM income_statements WHERE id = ?').get(id);
  
  if (!statement) {
    throw new Error('对账单不存在');
  }

  if (statement.status === 'confirmed') {
    throw new Error('对账单已确认');
  }

  db.prepare(`
    UPDATE income_statements 
    SET status = 'confirmed', 
        confirmed_at = CURRENT_TIMESTAMP, 
        confirmed_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, id);

  return getStatementById(id);
}

/**
 * 为所有活跃项目自动生成对账单
 * 用于定时任务调用
 * @returns {object} { success: number, failed: number, results: array }
 */
function autoGenerateForAllProjects() {
  // 获取所有活跃的实体项目
  const activeProjects = db.prepare(`
    SELECT * FROM projects 
    WHERE type = 'entity' AND status IN ('pending', 'active')
  `).all();

  const results = {
    success: 0,
    failed: 0,
    projects: []
  };

  activeProjects.forEach(project => {
    try {
      const statement = generateMonthly(project.id);
      results.success++;
      results.projects.push({
        projectId: project.id,
        projectName: project.name,
        statementId: statement.id,
        statementNo: statement.statement_no,
        status: 'success'
      });
    } catch (error) {
      results.failed++;
      results.projects.push({
        projectId: project.id,
        projectName: project.name,
        status: 'failed',
        error: error.message
      });
    }
  });

  return results;
}

// ==================== Task 46: 进度与产值确认功能 ====================

/**
 * 更新进度产值
 * Task 46: 更新对账单的进度百分比，自动计算当期产值和累计产值
 * @param {number} id - 对账单ID
 * @param {number} progressRate - 进度百分比 (0-100)
 * @param {string} remark - 备注
 * @param {number} userId - 操作人ID
 * @returns {object} 更新后的对账单
 */
function updateProgress(id, progressRate, remark, userId) {
  const statement = db.prepare('SELECT * FROM income_statements WHERE id = ?').get(id);
  
  if (!statement) {
    throw new Error('对账单不存在');
  }

  // 业务规则：进度只能增加不能减少
  const currentRate = parseFloat(statement.progress_rate) || 0;
  if (progressRate < currentRate) {
    throw new Error(`进度只能增加不能减少，当前进度为 ${currentRate}%`);
  }

  // 业务规则：进度范围 0-100%
  if (progressRate < 0 || progressRate > 100) {
    throw new Error('进度百分比必须在 0-100 之间');
  }

  const contractAmount = parseFloat(statement.contract_amount) || 0;
  
  // 计算当期产值 = 进度百分比 × 合同金额
  const progressAmount = Math.round(contractAmount * progressRate / 100 * 100) / 100;
  
  // 业务规则：产值不能超过合同金额
  if (progressAmount > contractAmount) {
    throw new Error('产值不能超过合同金额');
  }

  // 获取上期累计产值（同项目上一个月的对账单）
  const lastStatement = db.prepare(`
    SELECT accumulated_amount, progress_rate 
    FROM income_statements 
    WHERE project_id = ? AND id != ? AND status = 'confirmed'
    ORDER BY period_end DESC 
    LIMIT 1
  `).get(statement.project_id, id);
  
  const lastAccumulated = parseFloat(lastStatement?.accumulated_amount) || 0;
  const lastRate = parseFloat(lastStatement?.progress_rate) || 0;
  
  // 当期产值 = 当前进度产值 - 上期累计产值
  const currentProgressAmount = Math.round((progressAmount - lastAccumulated) * 100) / 100;
  
  // 累计产值 = 上期累计 + 当期产值（或直接使用当前进度产值）
  const accumulatedAmount = progressAmount;

  // 使用事务更新
  const transaction = db.transaction(() => {
    // 更新对账单主表
    db.prepare(`
      UPDATE income_statements 
      SET progress_rate = ?,
          progress_amount = ?,
          accumulated_amount = ?,
          confirmed_amount = ?,
          difference = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      progressRate,
      currentProgressAmount,
      accumulatedAmount,
      progressAmount,
      Math.round((currentProgressAmount - progressAmount) * 100) / 100,
      id
    );

    // 记录进度历史
    db.prepare(`
      INSERT INTO income_statement_progress (
        statement_id, progress_rate, progress_amount, accumulated_amount, remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, progressRate, currentProgressAmount, accumulatedAmount, remark || null, userId || null);
  });

  transaction();

  return getStatementById(id);
}

/**
 * 获取进度历史
 * Task 46: 获取对账单的进度变更历史记录
 * @param {number} id - 对账单ID
 * @returns {array} 进度历史列表
 */
function getProgressHistory(id) {
  const statement = db.prepare('SELECT * FROM income_statements WHERE id = ?').get(id);
  
  if (!statement) {
    throw new Error('对账单不存在');
  }

  // 获取进度历史记录
  const history = db.prepare(`
    SELECT p.*, u.real_name as creator_name
    FROM income_statement_progress p
    LEFT JOIN users u ON p.created_by = u.id
    WHERE p.statement_id = ?
    ORDER BY p.created_at DESC
  `).all(id);

  return history;
}

/**
 * 确认进度
 * Task 46: 确认对账单的进度产值，确认后状态变为已确认
 * @param {number} id - 对账单ID
 * @param {number} userId - 确认人ID
 * @param {string} comment - 确认意见
 * @returns {object} 确认后的对账单
 */
function confirmProgress(id, userId, comment) {
  const statement = db.prepare('SELECT * FROM income_statements WHERE id = ?').get(id);
  
  if (!statement) {
    throw new Error('对账单不存在');
  }

  // 检查进度是否已填写
  const progressRate = parseFloat(statement.progress_rate) || 0;
  if (progressRate === 0) {
    throw new Error('请先填写进度百分比');
  }

  // 检查是否已确认
  if (statement.progress_status === 'confirmed') {
    throw new Error('进度已确认，无需重复确认');
  }

  // 使用事务更新
  const transaction = db.transaction(() => {
    // 更新进度确认状态
    db.prepare(`
      UPDATE income_statements 
      SET progress_status = 'confirmed',
          progress_confirmed_by = ?,
          progress_confirmed_at = CURRENT_TIMESTAMP,
          status = 'confirmed',
          confirmed_by = ?,
          confirmed_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(userId, userId, id);

    // 记录确认操作到进度历史
    db.prepare(`
      INSERT INTO income_statement_progress (
        statement_id, progress_rate, progress_amount, accumulated_amount, remark, created_by
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id, 
      progressRate, 
      statement.progress_amount,
      statement.accumulated_amount,
      `[确认] ${comment || '进度已确认'}`, 
      userId
    );
  });

  transaction();

  return getStatementById(id);
}

/**
 * 获取项目进度统计
 * Task 46: 获取项目的整体进度统计信息
 * @param {number} projectId - 项目ID
 * @returns {object} 进度统计信息
 */
function getProjectProgressStats(projectId) {
  // 获取项目信息
  const project = db.prepare(`
    SELECT p.*, c.amount as contract_amount
    FROM projects p
    LEFT JOIN contracts c ON p.id = c.project_id AND c.type = 'income'
    WHERE p.id = ?
  `).get(projectId);

  if (!project) {
    throw new Error('项目不存在');
  }

  const contractAmount = parseFloat(project.contract_amount) || 0;

  // 获取最新对账单
  const latestStatement = db.prepare(`
    SELECT * FROM income_statements 
    WHERE project_id = ? AND status = 'confirmed'
    ORDER BY period_end DESC 
    LIMIT 1
  `).get(projectId);

  // 获取所有已确认对账单的累计产值
  const totalConfirmed = db.prepare(`
    SELECT COALESCE(SUM(confirmed_amount), 0) as total
    FROM income_statements 
    WHERE project_id = ? AND status = 'confirmed'
  `).get(projectId);

  // 获取对账单数量
  const statementCount = db.prepare(`
    SELECT COUNT(*) as count
    FROM income_statements 
    WHERE project_id = ?
  `).get(projectId);

  return {
    projectId,
    projectName: project.name,
    projectNo: project.project_no,
    contractAmount,
    latestProgress: latestStatement ? parseFloat(latestStatement.progress_rate) : 0,
    latestAccumulated: latestStatement ? parseFloat(latestStatement.accumulated_amount) : 0,
    totalConfirmedAmount: parseFloat(totalConfirmed?.total || 0),
    statementCount: statementCount?.count || 0,
    latestStatement: latestStatement || null
  };
}

module.exports = {
  generateStatementNo,
  checkExistingStatement,
  getProjectContract,
  calculateProgress,
  syncContract,
  generateMonthly,
  getStatementById,
  getStatements,
  updateStatement,
  confirmStatement,
  autoGenerateForAllProjects,
  // Task 46: 进度与产值确认
  updateProgress,
  getProgressHistory,
  confirmProgress,
  getProjectProgressStats
};
