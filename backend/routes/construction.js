/**
 * 施工管理路由
 * Task 54: 实现施工管理 - 里程碑设置
 * Task 56: 实现施工管理 - 偏差预警
 */

const express = require('express');
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');
const constructionService = require('../services/constructionService');

const router = express.Router();

// 简化中间件引用
const authenticateToken = authMiddleware;
const requirePermission = (permission) => {
  return (req, res, next) => {
    // 开发阶段暂时跳过权限检查
    next();
  };
};

// 里程碑编号生成
function generateMilestoneNo() {
  const now = new Date();
  const yearMonth = now.toISOString().slice(2, 7).replace('-', '');
  
  // 获取当月已有数量
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM construction_milestones 
    WHERE milestone_no LIKE ?
  `).get(`MS${yearMonth}%`);
  
  const seq = String((count?.total || 0) + 1).padStart(3, '0');
  return `MS${yearMonth}${seq}`;
}

/**
 * GET /api/construction/milestones
 * 获取里程碑列表
 * 查询参数: project_id, status, page, pageSize
 */
router.get('/milestones', authMiddleware, (req, res) => {
  const { project_id, status, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let sql = `
    SELECT m.*, 
           p.name as project_name, p.project_no,
           u.real_name as creator_name
    FROM construction_milestones m
    LEFT JOIN projects p ON m.project_id = p.id
    LEFT JOIN users u ON m.creator_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (project_id) {
    sql += ` AND m.project_id = ?`;
    params.push(project_id);
  }
  
  if (status) {
    sql += ` AND m.status = ?`;
    params.push(status);
  }
  
  // 获取总数
  const countSql = sql.replace(
    /SELECT m\.\*,\s*p\.name as project_name, p\.project_no,\s*u\.real_name as creator_name/,
    'SELECT COUNT(*) as total'
  ).replace(/LEFT JOIN projects p.*WHERE/, 'WHERE');
  
  const countResult = db.prepare(countSql).get(...params);
  const total = countResult ? countResult.total : 0;
  
  // 排序和分页
  sql += ` ORDER BY m.planned_date ASC, m.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(pageSize), offset);
  
  const milestones = db.prepare(sql).all(...params);
  
  // 计算进度偏差
  const milestonesWithDeviation = milestones.map(m => {
    let deviation_days = null;
    let deviation_status = 'normal';
    
    if (m.actual_date && m.planned_date) {
      const planned = new Date(m.planned_date);
      const actual = new Date(m.actual_date);
      const diffTime = actual - planned;
      deviation_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (deviation_days > 0) {
        deviation_status = 'delayed';  // 延期
      } else if (deviation_days < 0) {
        deviation_status = 'advanced'; // 提前
      }
    } else if (!m.actual_date && m.planned_date) {
      const planned = new Date(m.planned_date);
      const today = new Date();
      if (today > planned) {
        deviation_status = 'overdue'; // 已超期未完成
      }
    }
    
    return {
      ...m,
      deviation_days,
      deviation_status
    };
  });
  
  res.json({
    success: true,
    data: milestonesWithDeviation,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total
    }
  });
});

/**
 * GET /api/construction/milestones/:id
 * 获取里程碑详情
 */
router.get('/milestones/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const milestone = db.prepare(`
    SELECT m.*, 
           p.name as project_name, p.project_no, p.contract_amount,
           u.real_name as creator_name
    FROM construction_milestones m
    LEFT JOIN projects p ON m.project_id = p.id
    LEFT JOIN users u ON m.creator_id = u.id
    WHERE m.id = ?
  `).get(id);
  
  if (!milestone) {
    return res.status(404).json({
      success: false,
      message: '里程碑不存在'
    });
  }
  
  // 计算进度偏差
  let deviation_days = null;
  let deviation_status = 'normal';
  
  if (milestone.actual_date && milestone.planned_date) {
    const planned = new Date(milestone.planned_date);
    const actual = new Date(milestone.actual_date);
    const diffTime = actual - planned;
    deviation_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (deviation_days > 0) {
      deviation_status = 'delayed';
    } else if (deviation_days < 0) {
      deviation_status = 'advanced';
    }
  } else if (!milestone.actual_date && milestone.planned_date) {
    const planned = new Date(milestone.planned_date);
    const today = new Date();
    if (today > planned) {
      deviation_status = 'overdue';
    }
  }
  
  res.json({
    success: true,
    data: {
      ...milestone,
      deviation_days,
      deviation_status
    }
  });
});

/**
 * POST /api/construction/milestones
 * 创建里程碑
 */
router.post('/milestones', authMiddleware, (req, res) => {
  const { project_id, name, description, planned_date, progress_rate, remark } = req.body;
  const userId = req.user?.id || 1;
  
  // 验证必填字段
  if (!project_id) {
    return res.status(400).json({
      success: false,
      message: '请选择关联项目'
    });
  }
  
  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: '里程碑名称不能为空'
    });
  }
  
  if (!planned_date) {
    return res.status(400).json({
      success: false,
      message: '计划日期不能为空'
    });
  }
  
  // 检查项目是否存在
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: '关联项目不存在'
    });
  }
  
  // 生成里程碑编号
  const milestoneNo = generateMilestoneNo();
  
  try {
    const result = db.prepare(`
      INSERT INTO construction_milestones (
        milestone_no, project_id, name, description, planned_date,
        progress_rate, remark, status, creator_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `).run(
      milestoneNo, project_id, name.trim(), description || null,
      planned_date, progress_rate || 0, remark || null, userId
    );
    
    const newMilestone = db.prepare(`
      SELECT m.*, 
             p.name as project_name, p.project_no,
             u.real_name as creator_name
      FROM construction_milestones m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.creator_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: '里程碑创建成功',
      data: newMilestone
    });
  } catch (error) {
    console.error('创建里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '创建里程碑失败: ' + error.message
    });
  }
});

/**
 * PUT /api/construction/milestones/:id
 * 更新里程碑
 */
router.put('/milestones/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { name, description, planned_date, progress_rate, remark } = req.body;
  
  // 检查里程碑是否存在
  const existingMilestone = db.prepare('SELECT * FROM construction_milestones WHERE id = ?').get(id);
  if (!existingMilestone) {
    return res.status(404).json({
      success: false,
      message: '里程碑不存在'
    });
  }
  
  // 已完成的里程碑不允许修改
  if (existingMilestone.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: '已完成的里程碑不允许修改'
    });
  }
  
  // 验证必填字段
  if (!planned_date) {
    return res.status(400).json({
      success: false,
      message: '计划日期不能为空'
    });
  }
  
  try {
    db.prepare(`
      UPDATE construction_milestones SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        planned_date = COALESCE(?, planned_date),
        progress_rate = COALESCE(?, progress_rate),
        remark = COALESCE(?, remark),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name?.trim() || null, description || null, planned_date,
      progress_rate ?? null, remark || null, id
    );
    
    const updatedMilestone = db.prepare(`
      SELECT m.*, 
             p.name as project_name, p.project_no,
             u.real_name as creator_name
      FROM construction_milestones m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.creator_id = u.id
      WHERE m.id = ?
    `).get(id);
    
    res.json({
      success: true,
      message: '里程碑更新成功',
      data: updatedMilestone
    });
  } catch (error) {
    console.error('更新里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '更新里程碑失败: ' + error.message
    });
  }
});

/**
 * DELETE /api/construction/milestones/:id
 * 删除里程碑
 */
router.delete('/milestones/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  // 检查里程碑是否存在
  const milestone = db.prepare('SELECT * FROM construction_milestones WHERE id = ?').get(id);
  if (!milestone) {
    return res.status(404).json({
      success: false,
      message: '里程碑不存在'
    });
  }
  
  // 已完成的里程碑不允许删除
  if (milestone.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: '已完成的里程碑不允许删除'
    });
  }
  
  try {
    db.prepare('DELETE FROM construction_milestones WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '里程碑删除成功'
    });
  } catch (error) {
    console.error('删除里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '删除里程碑失败: ' + error.message
    });
  }
});

/**
 * POST /api/construction/milestones/:id/complete
 * 完成里程碑
 */
router.post('/milestones/:id/complete', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { actual_date, progress_rate, remark } = req.body;
  const userId = req.user?.id || 1;
  
  // 检查里程碑是否存在
  const milestone = db.prepare('SELECT * FROM construction_milestones WHERE id = ?').get(id);
  if (!milestone) {
    return res.status(404).json({
      success: false,
      message: '里程碑不存在'
    });
  }
  
  // 已完成的里程碑不能重复完成
  if (milestone.status === 'completed') {
    return res.status(400).json({
      success: false,
      message: '里程碑已完成，不能重复操作'
    });
  }
  
  // 默认实际日期为今天
  const actualDate = actual_date || new Date().toISOString().slice(0, 10);
  
  try {
    db.prepare(`
      UPDATE construction_milestones SET
        status = 'completed',
        actual_date = ?,
        progress_rate = COALESCE(?, 100),
        remark = COALESCE(?, remark),
        completed_by = ?,
        completed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(actualDate, progress_rate, remark, userId, id);
    
    const updatedMilestone = db.prepare(`
      SELECT m.*, 
             p.name as project_name, p.project_no,
             u.real_name as creator_name,
             uc.real_name as completer_name
      FROM construction_milestones m
      LEFT JOIN projects p ON m.project_id = p.id
      LEFT JOIN users u ON m.creator_id = u.id
      LEFT JOIN users uc ON m.completed_by = uc.id
      WHERE m.id = ?
    `).get(id);
    
    // 计算进度偏差
    let deviation_days = null;
    let deviation_status = 'normal';
    
    if (updatedMilestone.actual_date && updatedMilestone.planned_date) {
      const planned = new Date(updatedMilestone.planned_date);
      const actual = new Date(updatedMilestone.actual_date);
      const diffTime = actual - planned;
      deviation_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (deviation_days > 0) {
        deviation_status = 'delayed';
      } else if (deviation_days < 0) {
        deviation_status = 'advanced';
      }
    }
    
    res.json({
      success: true,
      message: '里程碑已完成',
      data: {
        ...updatedMilestone,
        deviation_days,
        deviation_status
      }
    });
  } catch (error) {
    console.error('完成里程碑失败:', error);
    res.status(500).json({
      success: false,
      message: '完成里程碑失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/milestones/project/:projectId/timeline
 * 获取项目里程碑时间线（用于时间线展示）
 */
router.get('/milestones/project/:projectId/timeline', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  const milestones = db.prepare(`
    SELECT m.*, 
           p.name as project_name, p.project_no,
           u.real_name as creator_name,
           uc.real_name as completer_name
    FROM construction_milestones m
    LEFT JOIN projects p ON m.project_id = p.id
    LEFT JOIN users u ON m.creator_id = u.id
    LEFT JOIN users uc ON m.completed_by = uc.id
    WHERE m.project_id = ?
    ORDER BY m.planned_date ASC
  `).all(projectId);
  
  // 计算进度偏差
  const timeline = milestones.map(m => {
    let deviation_days = null;
    let deviation_status = 'normal';
    
    if (m.actual_date && m.planned_date) {
      const planned = new Date(m.planned_date);
      const actual = new Date(m.actual_date);
      const diffTime = actual - planned;
      deviation_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (deviation_days > 0) {
        deviation_status = 'delayed';
      } else if (deviation_days < 0) {
        deviation_status = 'advanced';
      }
    } else if (!m.actual_date && m.planned_date) {
      const planned = new Date(m.planned_date);
      const today = new Date();
      if (today > planned) {
        deviation_status = 'overdue';
      }
    }
    
    return {
      ...m,
      deviation_days,
      deviation_status
    };
  });
  
  // 统计信息
  const stats = {
    total: timeline.length,
    completed: timeline.filter(m => m.status === 'completed').length,
    pending: timeline.filter(m => m.status === 'pending').length,
    overdue: timeline.filter(m => m.deviation_status === 'overdue').length,
    delayed: timeline.filter(m => m.deviation_status === 'delayed').length,
    advanced: timeline.filter(m => m.deviation_status === 'advanced').length
  };
  
  res.json({
    success: true,
    data: {
      timeline,
      stats
    }
  });
});

/**
 * GET /api/construction/milestones/stats/overview
 * 获取里程碑统计概览
 */
router.get('/milestones/stats/overview', authMiddleware, (req, res) => {
  const { project_id } = req.query;
  
  let whereClause = '1=1';
  const params = [];
  
  if (project_id) {
    whereClause += ' AND project_id = ?';
    params.push(project_id);
  }
  
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'pending' AND planned_date < date('now') THEN 1 ELSE 0 END) as overdue
      FROM construction_milestones
      WHERE ${whereClause}
    `).get(...params);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取统计失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/projects/active
 * 获取活跃项目列表（用于里程碑关联）
 */
router.get('/projects/active', authMiddleware, (req, res) => {
  const projects = db.prepare(`
    SELECT id, project_no, name, customer, contract_amount, status
    FROM projects
    WHERE type = 'entity' AND status IN ('pending', 'active')
    ORDER BY created_at DESC
  `).all();
  
  res.json({
    success: true,
    data: projects
  });
});

// ========== Task 55: 施工管理 - 进度填报 ==========

// 进度填报编号生成
function generateProgressNo(projectId) {
  // 获取项目编号
  const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }
  
  const projectNo = project.project_no;
  
  // 获取该项目已有进度数量
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM construction_progress 
    WHERE project_id = ?
  `).get(projectId);
  
  const seq = String((count?.total || 0) + 1).padStart(2, '0');
  return `${projectNo}-PR${seq}`;
}

/**
 * GET /api/construction/progress
 * 获取进度填报列表
 * 查询参数: project_id, milestone_id, reporter_id, start_date, end_date, page, pageSize
 */
router.get('/progress', authMiddleware, (req, res) => {
  const { project_id, milestone_id, reporter_id, start_date, end_date, page = 1, pageSize = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  
  let sql = `
    SELECT pr.*, 
           p.name as project_name, p.project_no,
           m.name as milestone_name,
           u.real_name as reporter_name
    FROM construction_progress pr
    LEFT JOIN projects p ON pr.project_id = p.id
    LEFT JOIN construction_milestones m ON pr.milestone_id = m.id
    LEFT JOIN users u ON pr.reporter_id = u.id
    WHERE 1=1
  `;
  const params = [];
  
  if (project_id) {
    sql += ` AND pr.project_id = ?`;
    params.push(project_id);
  }
  
  if (milestone_id) {
    sql += ` AND pr.milestone_id = ?`;
    params.push(milestone_id);
  }
  
  if (reporter_id) {
    sql += ` AND pr.reporter_id = ?`;
    params.push(reporter_id);
  }
  
  if (start_date) {
    sql += ` AND pr.report_date >= ?`;
    params.push(start_date);
  }
  
  if (end_date) {
    sql += ` AND pr.report_date <= ?`;
    params.push(end_date);
  }
  
  // 获取总数
  const countSql = `
    SELECT COUNT(*) as total FROM construction_progress pr
    WHERE 1=1
    ${project_id ? ' AND pr.project_id = ?' : ''}
    ${milestone_id ? ' AND pr.milestone_id = ?' : ''}
    ${reporter_id ? ' AND pr.reporter_id = ?' : ''}
    ${start_date ? ' AND pr.report_date >= ?' : ''}
    ${end_date ? ' AND pr.report_date <= ?' : ''}
  `;
  
  const countParams = [];
  if (project_id) countParams.push(project_id);
  if (milestone_id) countParams.push(milestone_id);
  if (reporter_id) countParams.push(reporter_id);
  if (start_date) countParams.push(start_date);
  if (end_date) countParams.push(end_date);
  
  const countResult = db.prepare(countSql).get(...countParams);
  const total = countResult ? countResult.total : 0;
  
  // 排序和分页
  sql += ` ORDER BY pr.report_date DESC, pr.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(pageSize), offset);
  
  const progressList = db.prepare(sql).all(...params);
  
  res.json({
    success: true,
    data: progressList,
    pagination: {
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      total
    }
  });
});

/**
 * GET /api/construction/progress/:id
 * 获取进度填报详情
 */
router.get('/progress/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const progress = db.prepare(`
    SELECT pr.*, 
           p.name as project_name, p.project_no,
           m.name as milestone_name, m.planned_date as milestone_planned_date,
           u.real_name as reporter_name
    FROM construction_progress pr
    LEFT JOIN projects p ON pr.project_id = p.id
    LEFT JOIN construction_milestones m ON pr.milestone_id = m.id
    LEFT JOIN users u ON pr.reporter_id = u.id
    WHERE pr.id = ?
  `).get(id);
  
  if (!progress) {
    return res.status(404).json({
      success: false,
      message: '进度填报记录不存在'
    });
  }
  
  res.json({
    success: true,
    data: progress
  });
});

/**
 * POST /api/construction/progress
 * 创建进度填报
 */
router.post('/progress', authMiddleware, (req, res) => {
  const { project_id, milestone_id, report_date, progress_rate, work_content, issues, next_plan, remark } = req.body;
  const userId = req.user?.id || 1;
  
  // 验证必填字段
  if (!project_id) {
    return res.status(400).json({
      success: false,
      message: '请选择关联项目'
    });
  }
  
  if (!report_date) {
    return res.status(400).json({
      success: false,
      message: '填报日期不能为空'
    });
  }
  
  // 验证进度百分比
  if (progress_rate !== undefined && progress_rate !== null) {
    if (progress_rate < 0 || progress_rate > 100) {
      return res.status(400).json({
        success: false,
        message: '进度百分比必须在 0-100 之间'
      });
    }
  }
  
  // 检查项目是否存在
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(project_id);
  if (!project) {
    return res.status(404).json({
      success: false,
      message: '关联项目不存在'
    });
  }
  
  // 如果关联了里程碑，检查里程碑是否存在
  if (milestone_id) {
    const milestone = db.prepare('SELECT * FROM construction_milestones WHERE id = ?').get(milestone_id);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: '关联里程碑不存在'
      });
    }
  }
  
  // 生成填报编号（使用项目编号作为前缀）
  const progressNo = generateProgressNo(project_id);
  
  try {
    const result = db.prepare(`
      INSERT INTO construction_progress (
        progress_no, project_id, milestone_id, report_date, progress_rate,
        work_content, issues, next_plan, reporter_id, status, remark
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)
    `).run(
      progressNo, project_id, milestone_id || null, report_date,
      progress_rate || 0, work_content || null, issues || null,
      next_plan || null, userId, remark || null
    );
    
    const newProgress = db.prepare(`
      SELECT pr.*, 
             p.name as project_name, p.project_no,
             m.name as milestone_name,
             u.real_name as reporter_name
      FROM construction_progress pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN construction_milestones m ON pr.milestone_id = m.id
      LEFT JOIN users u ON pr.reporter_id = u.id
      WHERE pr.id = ?
    `).get(result.lastInsertRowid);
    
    res.json({
      success: true,
      message: '进度填报创建成功',
      data: newProgress
    });
  } catch (error) {
    console.error('创建进度填报失败:', error);
    res.status(500).json({
      success: false,
      message: '创建进度填报失败: ' + error.message
    });
  }
});

/**
 * PUT /api/construction/progress/:id
 * 更新进度填报
 */
router.put('/progress/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { milestone_id, report_date, progress_rate, work_content, issues, next_plan, remark } = req.body;
  
  // 检查填报记录是否存在
  const existingProgress = db.prepare('SELECT * FROM construction_progress WHERE id = ?').get(id);
  if (!existingProgress) {
    return res.status(404).json({
      success: false,
      message: '进度填报记录不存在'
    });
  }
  
  // 验证进度百分比
  if (progress_rate !== undefined && progress_rate !== null) {
    if (progress_rate < 0 || progress_rate > 100) {
      return res.status(400).json({
        success: false,
        message: '进度百分比必须在 0-100 之间'
      });
    }
  }
  
  // 如果关联了里程碑，检查里程碑是否存在
  if (milestone_id) {
    const milestone = db.prepare('SELECT * FROM construction_milestones WHERE id = ?').get(milestone_id);
    if (!milestone) {
      return res.status(404).json({
        success: false,
        message: '关联里程碑不存在'
      });
    }
  }
  
  try {
    db.prepare(`
      UPDATE construction_progress SET
        milestone_id = COALESCE(?, milestone_id),
        report_date = COALESCE(?, report_date),
        progress_rate = COALESCE(?, progress_rate),
        work_content = COALESCE(?, work_content),
        issues = COALESCE(?, issues),
        next_plan = COALESCE(?, next_plan),
        remark = COALESCE(?, remark),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      milestone_id ?? null, report_date, progress_rate ?? null,
      work_content || null, issues || null, next_plan || null,
      remark || null, id
    );
    
    const updatedProgress = db.prepare(`
      SELECT pr.*, 
             p.name as project_name, p.project_no,
             m.name as milestone_name,
             u.real_name as reporter_name
      FROM construction_progress pr
      LEFT JOIN projects p ON pr.project_id = p.id
      LEFT JOIN construction_milestones m ON pr.milestone_id = m.id
      LEFT JOIN users u ON pr.reporter_id = u.id
      WHERE pr.id = ?
    `).get(id);
    
    res.json({
      success: true,
      message: '进度填报更新成功',
      data: updatedProgress
    });
  } catch (error) {
    console.error('更新进度填报失败:', error);
    res.status(500).json({
      success: false,
      message: '更新进度填报失败: ' + error.message
    });
  }
});

/**
 * DELETE /api/construction/progress/:id
 * 删除进度填报
 */
router.delete('/progress/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  // 检查填报记录是否存在
  const progress = db.prepare('SELECT * FROM construction_progress WHERE id = ?').get(id);
  if (!progress) {
    return res.status(404).json({
      success: false,
      message: '进度填报记录不存在'
    });
  }
  
  try {
    db.prepare('DELETE FROM construction_progress WHERE id = ?').run(id);
    
    res.json({
      success: true,
      message: '进度填报删除成功'
    });
  } catch (error) {
    console.error('删除进度填报失败:', error);
    res.status(500).json({
      success: false,
      message: '删除进度填报失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/progress/project/:projectId/chart
 * 获取项目进度曲线图数据
 */
router.get('/progress/project/:projectId/chart', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  // 获取项目的所有进度填报记录，按日期排序
  const progressData = db.prepare(`
    SELECT 
      pr.report_date,
      pr.progress_rate,
      pr.work_content,
      m.name as milestone_name
    FROM construction_progress pr
    LEFT JOIN construction_milestones m ON pr.milestone_id = m.id
    WHERE pr.project_id = ?
    ORDER BY pr.report_date ASC
  `).all(projectId);
  
  // 获取项目里程碑
  const milestones = db.prepare(`
    SELECT 
      name,
      planned_date,
      actual_date,
      progress_rate,
      status
    FROM construction_milestones
    WHERE project_id = ?
    ORDER BY planned_date ASC
  `).all(projectId);
  
  // 计算累计进度
  let accumulated = 0;
  const chartData = progressData.map((item, index) => {
    // 使用填报的进度率（如果是递增的话）
    if (item.progress_rate >= accumulated) {
      accumulated = item.progress_rate;
    }
    return {
      date: item.report_date,
      progress: item.progress_rate,
      milestone: item.milestone_name || null
    };
  });
  
  // 里程碑节点
  const milestonePoints = milestones.map(m => ({
    name: m.name,
    planned_date: m.planned_date,
    actual_date: m.actual_date,
    status: m.status,
    progress: m.progress_rate
  }));
  
  res.json({
    success: true,
    data: {
      progressCurve: chartData,
      milestones: milestonePoints,
      latestProgress: chartData.length > 0 ? chartData[chartData.length - 1].progress : 0
    }
  });
});

/**
 * GET /api/construction/progress/stats/overview
 * 获取进度填报统计概览
 */
router.get('/progress/stats/overview', authMiddleware, (req, res) => {
  const { project_id } = req.query;
  
  let whereClause = '1=1';
  const params = [];
  
  if (project_id) {
    whereClause += ' AND project_id = ?';
    params.push(project_id);
  }
  
  try {
    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total_reports,
        MAX(progress_rate) as max_progress,
        AVG(progress_rate) as avg_progress,
        MAX(report_date) as latest_report_date
      FROM construction_progress
      WHERE ${whereClause}
    `).get(...params);
    
    // 获取本月填报数
    const thisMonth = new Date().toISOString().slice(0, 7);
    const monthlyStats = db.prepare(`
      SELECT COUNT(*) as monthly_reports
      FROM construction_progress
      WHERE ${whereClause} AND strftime('%Y-%m', report_date) = ?
    `).get(...params, thisMonth);
    
    res.json({
      success: true,
      data: {
        ...stats,
        monthly_reports: monthlyStats?.monthly_reports || 0
      }
    });
  } catch (error) {
    console.error('获取进度统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取进度统计失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/progress/project/:projectId/milestones
 * 获取项目的里程碑列表（用于进度填报关联）
 */
router.get('/progress/project/:projectId/milestones', authMiddleware, (req, res) => {
  const { projectId } = req.params;
  
  const milestones = db.prepare(`
    SELECT id, milestone_no, name, planned_date, actual_date, progress_rate, status
    FROM construction_milestones
    WHERE project_id = ?
    ORDER BY planned_date ASC
  `).all(projectId);
  
  res.json({
    success: true,
    data: milestones
  });
});

// ==================== Task 56: 偏差预警 API ====================

/**
 * GET /api/construction/warnings
 * 获取偏差预警列表
 * 查询参数: projectId, warningLevel, status, page, pageSize
 */
router.get('/warnings', authMiddleware, (req, res) => {
  const { projectId, warningLevel, status, page = 1, pageSize = 20 } = req.query;

  try {
    const result = constructionService.getWarnings({
      projectId: projectId ? parseInt(projectId) : null,
      warningLevel,
      status,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });

    res.json({
      success: true,
      data: result.list,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('获取预警列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警列表失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/warnings/stats
 * 获取预警统计
 */
router.get('/warnings/stats', authMiddleware, (req, res) => {
  const { projectId } = req.query;

  try {
    const stats = constructionService.getWarningStats(projectId ? parseInt(projectId) : null);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('获取预警统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警统计失败: ' + error.message
    });
  }
});

/**
 * GET /api/construction/warnings/:id
 * 获取预警详情
 */
router.get('/warnings/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const warning = constructionService.getWarningById(parseInt(id));

    if (!warning) {
      return res.status(404).json({
        success: false,
        message: '预警记录不存在'
      });
    }

    res.json({
      success: true,
      data: warning
    });
  } catch (error) {
    console.error('获取预警详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取预警详情失败: ' + error.message
    });
  }
});

/**
 * POST /api/construction/warnings/check
 * 检查偏差
 * 请求体: { projectId }
 */
router.post('/warnings/check', authMiddleware, (req, res) => {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({
      success: false,
      message: '项目ID不能为空'
    });
  }

  try {
    // 检查偏差并自动创建预警
    const createdWarnings = constructionService.checkAndCreateWarnings(parseInt(projectId));
    
    // 获取最新的检查结果
    const deviationResult = constructionService.checkDeviation(parseInt(projectId));

    res.json({
      success: true,
      message: `检查完成，发现 ${deviationResult.warnings.length} 个偏差，创建了 ${createdWarnings.length} 条预警`,
      data: {
        deviationResult,
        createdWarnings
      }
    });
  } catch (error) {
    console.error('检查偏差失败:', error);
    res.status(500).json({
      success: false,
      message: '检查偏差失败: ' + error.message
    });
  }
});

/**
 * POST /api/construction/warnings/check-all
 * 检查所有项目的偏差
 */
router.post('/warnings/check-all', authMiddleware, (req, res) => {
  try {
    // 获取所有活跃项目
    const projects = db.prepare(`
      SELECT id, project_no, name FROM projects 
      WHERE type = 'entity' AND status IN ('pending', 'active')
    `).all();

    const results = [];
    
    for (const project of projects) {
      const createdWarnings = constructionService.checkAndCreateWarnings(project.id);
      const deviationResult = constructionService.checkDeviation(project.id);
      
      results.push({
        projectId: project.id,
        projectNo: project.project_no,
        projectName: project.name,
        warningCount: deviationResult.warnings.length,
        createdCount: createdWarnings.length
      });
    }

    const totalCreated = results.reduce((sum, r) => sum + r.createdCount, 0);

    res.json({
      success: true,
      message: `检查了 ${projects.length} 个项目，创建了 ${totalCreated} 条预警`,
      data: results
    });
  } catch (error) {
    console.error('检查所有项目偏差失败:', error);
    res.status(500).json({
      success: false,
      message: '检查所有项目偏差失败: ' + error.message
    });
  }
});

/**
 * PUT /api/construction/warnings/:id/handle
 * 处理预警
 * 请求体: { handleRemark }
 */
router.put('/warnings/:id/handle', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { handleRemark } = req.body;
  const userId = req.user?.id || 1;

  try {
    const warning = constructionService.handleWarning(
      parseInt(id),
      userId,
      handleRemark
    );

    res.json({
      success: true,
      message: '预警处理成功',
      data: warning
    });
  } catch (error) {
    console.error('处理预警失败:', error);
    res.status(500).json({
      success: false,
      message: error.message || '处理预警失败'
    });
  }
});

/**
 * GET /api/construction/warnings/analysis/:projectId
 * 获取项目偏差分析（用于图表展示）
 */
router.get('/warnings/analysis/:projectId', authMiddleware, (req, res) => {
  const { projectId } = req.params;

  try {
    const analysis = constructionService.getDeviationAnalysis(parseInt(projectId));

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    console.error('获取偏差分析失败:', error);
    res.status(500).json({
      success: false,
      message: '获取偏差分析失败: ' + error.message
    });
  }
});

module.exports = router;

// ==================== 任务管理 API ====================

/**
 * 生成任务编号
 */
function generateTaskNo(projectId) {
  const project = db.prepare('SELECT project_no FROM projects WHERE id = ?').get(projectId);
  if (!project) {
    throw new Error('项目不存在');
  }
  
  const projectNo = project.project_no;
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM construction_tasks WHERE project_id = ?
  `).get(projectId);
  
  const seq = String((count?.total || 0) + 1).padStart(3, '0');
  return `${projectNo}-T${seq}`;
}

/**
 * GET /api/construction/tasks
 * 获取任务列表（支持甘特图格式）
 */
router.get('/tasks', authMiddleware, (req, res) => {
  try {
    const { projectId, milestoneId, parentId, gantt } = req.query;

    let sql = `
      SELECT t.*, 
             p.project_no, p.name as project_name,
             m.name as milestone_name,
             u.real_name as assignee_name,
             pt.name as parent_name
      FROM construction_tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN construction_milestones m ON t.milestone_id = m.id
      LEFT JOIN users u ON t.assignee_id = u.id
      LEFT JOIN construction_tasks pt ON t.parent_id = pt.id
      WHERE 1=1
    `;
    const params = [];

    if (projectId) {
      sql += ' AND t.project_id = ?';
      params.push(projectId);
    }

    if (milestoneId) {
      sql += ' AND t.milestone_id = ?';
      params.push(milestoneId);
    }

    if (parentId !== undefined) {
      if (parentId === 'null' || parentId === '') {
        sql += ' AND t.parent_id IS NULL';
      } else {
        sql += ' AND t.parent_id = ?';
        params.push(parentId);
      }
    }

    sql += ' ORDER BY t.sort_order, t.created_at';

    const tasks = db.prepare(sql).all(...params);

    // 如果请求甘特图格式，转换为树形结构
    if (gantt === 'true') {
      const taskMap = {};
      const rootTasks = [];

      // 先建立映射
      tasks.forEach(task => {
        taskMap[task.id] = {
          ...task,
          children: []
        };
      });

      // 构建树形结构
      tasks.forEach(task => {
        if (task.parent_id && taskMap[task.parent_id]) {
          taskMap[task.parent_id].children.push(taskMap[task.id]);
        } else {
          rootTasks.push(taskMap[task.id]);
        }
      });

      return res.json({
        success: true,
        data: rootTasks
      });
    }

    res.json({
      success: true,
      data: tasks
    });
  } catch (error) {
    console.error('获取任务列表失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * GET /api/construction/tasks/:id
 * 获取单个任务详情
 */
router.get('/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const task = db.prepare(`
      SELECT t.*, 
             p.project_no, p.name as project_name,
             m.name as milestone_name,
             u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN construction_milestones m ON t.milestone_id = m.id
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `).get(id);

    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 获取子任务
    const children = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.parent_id = ?
      ORDER BY t.sort_order
    `).all(id);

    res.json({
      success: true,
      data: { ...task, children }
    });
  } catch (error) {
    console.error('获取任务详情失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * POST /api/construction/tasks
 * 创建任务
 */
router.post('/tasks', authMiddleware, (req, res) => {
  try {
    const {
      projectId, milestoneId, parentId, name, description,
      plannedStartDate, plannedEndDate, assigneeId, sortOrder, remark
    } = req.body;
    const userId = req.user.id;

    if (!projectId || !name) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const taskNo = generateTaskNo(projectId);

    const result = db.prepare(`
      INSERT INTO construction_tasks (
        task_no, project_id, milestone_id, parent_id, name, description,
        planned_start_date, planned_end_date, assignee_id, sort_order, remark,
        creator_id, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).run(
      taskNo, projectId, milestoneId || null, parentId || null, name, description || '',
      plannedStartDate || null, plannedEndDate || null, assigneeId || null,
      sortOrder || 0, remark || '', userId
    );

    const newTask = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.json({
      success: true,
      message: '任务创建成功',
      data: newTask
    });
  } catch (error) {
    console.error('创建任务失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

/**
 * PUT /api/construction/tasks/:id
 * 更新任务（包括进度）
 */
router.put('/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, description, plannedStartDate, plannedEndDate,
      actualStartDate, actualEndDate, progressRate, status, assigneeId, sortOrder, remark
    } = req.body;

    const task = db.prepare('SELECT * FROM construction_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    const updates = [];
    const params = [];

    if (name !== undefined) { updates.push('name = ?'); params.push(name); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (plannedStartDate !== undefined) { updates.push('planned_start_date = ?'); params.push(plannedStartDate); }
    if (plannedEndDate !== undefined) { updates.push('planned_end_date = ?'); params.push(plannedEndDate); }
    if (actualStartDate !== undefined) { updates.push('actual_start_date = ?'); params.push(actualStartDate); }
    if (actualEndDate !== undefined) { updates.push('actual_end_date = ?'); params.push(actualEndDate); }
    if (progressRate !== undefined) { updates.push('progress_rate = ?'); params.push(progressRate); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (assigneeId !== undefined) { updates.push('assignee_id = ?'); params.push(assigneeId); }
    if (sortOrder !== undefined) { updates.push('sort_order = ?'); params.push(sortOrder); }
    if (remark !== undefined) { updates.push('remark = ?'); params.push(remark); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: '没有要更新的字段' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    db.prepare(`UPDATE construction_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    const updatedTask = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.id = ?
    `).get(id);

    res.json({
      success: true,
      message: '任务更新成功',
      data: updatedTask
    });
  } catch (error) {
    console.error('更新任务失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  }
});

/**
 * PUT /api/construction/tasks/:id/progress
 * 更新任务进度
 */
router.put('/tasks/:id/progress', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { progressRate, status, actualStartDate, actualEndDate } = req.body;

    const task = db.prepare('SELECT * FROM construction_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    const updates = ['progress_rate = ?', "updated_at = datetime('now')"];
    const params = [progressRate];

    if (status) { updates.push('status = ?'); params.push(status); }
    if (actualStartDate) { updates.push('actual_start_date = ?'); params.push(actualStartDate); }
    if (actualEndDate) { updates.push('actual_end_date = ?'); params.push(actualEndDate); }

    // 如果进度100%，自动设置状态为完成
    if (progressRate >= 100) {
      updates.push("status = 'completed'");
    } else if (progressRate > 0 && task.status === 'pending') {
      updates.push("status = 'in_progress'");
    }

    params.push(id);

    db.prepare(`UPDATE construction_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    res.json({
      success: true,
      message: '进度更新成功'
    });
  } catch (error) {
    console.error('更新进度失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  }
});

/**
 * DELETE /api/construction/tasks/:id
 * 删除任务
 */
router.delete('/tasks/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    // 检查是否有子任务
    const children = db.prepare('SELECT COUNT(*) as count FROM construction_tasks WHERE parent_id = ?').get(id);
    if (children.count > 0) {
      return res.status(400).json({ success: false, message: '请先删除子任务' });
    }

    db.prepare('DELETE FROM construction_tasks WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '任务删除成功'
    });
  } catch (error) {
    console.error('删除任务失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: error.message });
  }
});

/**
 * GET /api/construction/tasks/gantt/:projectId
 * 获取项目甘特图数据
 */
router.get('/tasks/gantt/:projectId', authMiddleware, (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取所有任务
    const tasks = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.sort_order, t.planned_start_date
    `).all(projectId);

    // 获取里程碑
    const milestones = db.prepare(`
      SELECT * FROM construction_milestones
      WHERE project_id = ?
      ORDER BY planned_date
    `).all(projectId);

    // 转换为甘特图格式
    const ganttData = {
      tasks: tasks.map(t => ({
        id: t.id,
        taskNo: t.task_no,
        name: t.name,
        parentId: t.parent_id,
        milestoneId: t.milestone_id,
        plannedStart: t.planned_start_date,
        plannedEnd: t.planned_end_date,
        actualStart: t.actual_start_date,
        actualEnd: t.actual_end_date,
        progress: t.progress_rate || 0,
        status: t.status,
        assignee: t.assignee_name,
        assigneeId: t.assignee_id
      })),
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        plannedDate: m.planned_date,
        actualDate: m.actual_date,
        status: m.status,
        progress: m.progress_rate || 0
      }))
    };

    res.json({
      success: true,
      data: ganttData
    });
  } catch (error) {
    console.error('获取甘特图数据失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

// ==================== 任务依赖关系 API ====================

/**
 * GET /api/construction/dependencies
 * 获取任务依赖关系
 */
router.get('/dependencies', authMiddleware, (req, res) => {
  try {
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ success: false, message: '缺少项目ID' });
    }

    const dependencies = db.prepare(`
      SELECT d.*,
             pt.name as predecessor_name,
             st.name as successor_name,
             pt.task_no as predecessor_no,
             st.task_no as successor_no
      FROM task_dependencies d
      LEFT JOIN construction_tasks pt ON d.predecessor_id = pt.id
      LEFT JOIN construction_tasks st ON d.successor_id = st.id
      WHERE d.project_id = ?
      ORDER BY d.created_at
    `).all(projectId);

    res.json({
      success: true,
      data: dependencies
    });
  } catch (error) {
    console.error('获取依赖关系失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * POST /api/construction/dependencies
 * 创建任务依赖关系（紧前关系）
 */
router.post('/dependencies', authMiddleware, (req, res) => {
  try {
    const { projectId, predecessorId, successorId, dependencyType, lagDays } = req.body;

    if (!projectId || !predecessorId || !successorId) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    // 不能自己依赖自己
    if (predecessorId === successorId) {
      return res.status(400).json({ success: false, message: '任务不能依赖自己' });
    }

    // 检查是否已存在
    const existing = db.prepare(`
      SELECT id FROM task_dependencies 
      WHERE predecessor_id = ? AND successor_id = ?
    `).get(predecessorId, successorId);

    if (existing) {
      return res.status(400).json({ success: false, message: '该依赖关系已存在' });
    }

    // 检查是否会造成循环依赖
    const hasCycle = checkCircularDependency(projectId, predecessorId, successorId);
    if (hasCycle) {
      return res.status(400).json({ success: false, message: '不能创建循环依赖' });
    }

    const result = db.prepare(`
      INSERT INTO task_dependencies (
        project_id, predecessor_id, successor_id, dependency_type, lag_days, created_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'))
    `).run(projectId, predecessorId, successorId, dependencyType || 'FS', lagDays || 0);

    res.json({
      success: true,
      message: '依赖关系创建成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('创建依赖关系失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

/**
 * DELETE /api/construction/dependencies/:id
 * 删除任务依赖关系
 */
router.delete('/dependencies/:id', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    db.prepare('DELETE FROM task_dependencies WHERE id = ?').run(id);

    res.json({
      success: true,
      message: '依赖关系删除成功'
    });
  } catch (error) {
    console.error('删除依赖关系失败:', error);
    res.status(500).json({ success: false, message: '删除失败', error: error.message });
  }
});

/**
 * 检查循环依赖
 */
function checkCircularDependency(projectId, predecessorId, successorId, visited = new Set()) {
  // 获取后继任务的所有前驱任务
  const predecessors = db.prepare(`
    SELECT predecessor_id FROM task_dependencies 
    WHERE successor_id = ? AND project_id = ?
  `).all(successorId, projectId);

  for (const pred of predecessors) {
    if (pred.predecessor_id === predecessorId) {
      return true; // 发现循环
    }
    if (!visited.has(pred.predecessor_id)) {
      visited.add(pred.predecessor_id);
      if (checkCircularDependency(projectId, predecessorId, pred.predecessor_id, visited)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * GET /api/construction/tasks/with-dependencies/:projectId
 * 获取带依赖关系的任务列表（甘特图用）
 */
router.get('/tasks/with-dependencies/:projectId', authMiddleware, (req, res) => {
  try {
    const { projectId } = req.params;

    // 获取所有任务
    const tasks = db.prepare(`
      SELECT t.*, u.real_name as assignee_name
      FROM construction_tasks t
      LEFT JOIN users u ON t.assignee_id = u.id
      WHERE t.project_id = ?
      ORDER BY t.sort_order, t.planned_start_date
    `).all(projectId);

    // 获取所有依赖关系
    const dependencies = db.prepare(`
      SELECT d.*,
             pt.name as predecessor_name,
             st.name as successor_name
      FROM task_dependencies d
      LEFT JOIN construction_tasks pt ON d.predecessor_id = pt.id
      LEFT JOIN construction_tasks st ON d.successor_id = st.id
      WHERE d.project_id = ?
    `).all(projectId);

    // 为每个任务添加前置任务和后继任务列表
    const taskMap = {};
    tasks.forEach(task => {
      taskMap[task.id] = {
        ...task,
        predecessors: [],
        successors: []
      };
    });

    dependencies.forEach(dep => {
      if (taskMap[dep.successor_id]) {
        taskMap[dep.successor_id].predecessors.push({
          id: dep.predecessor_id,
          name: dep.predecessor_name,
          type: dep.dependency_type,
          lagDays: dep.lag_days
        });
      }
      if (taskMap[dep.predecessor_id]) {
        taskMap[dep.predecessor_id].successors.push({
          id: dep.successor_id,
          name: dep.successor_name,
          type: dep.dependency_type,
          lagDays: dep.lag_days
        });
      }
    });

    res.json({
      success: true,
      data: {
        tasks: Object.values(taskMap),
        dependencies: dependencies.map(d => ({
          id: d.id,
          predecessorId: d.predecessor_id,
          successorId: d.successor_id,
          predecessorName: d.predecessor_name,
          successorName: d.successor_name,
          type: d.dependency_type,
          lagDays: d.lag_days
        }))
      }
    });
  } catch (error) {
    console.error('获取任务依赖数据失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }


/**
 * POST /api/construction/tasks/:id/dependencies
 * 设置任务依赖关系
 */
router.post('/tasks/:id/dependencies', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { dependencies } = req.body; // [{ taskId, type, lagDays }, ...]

    const task = db.prepare('SELECT * FROM construction_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 删除现有依赖
    db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(id);

    // 添加新依赖
    if (dependencies && dependencies.length > 0) {
      const insertDep = db.prepare(`
        INSERT INTO task_dependencies (task_id, depends_on_task_id, dependency_type, lag_days)
        VALUES (?, ?, ?, ?)
      `);

      for (const dep of dependencies) {
        if (dep.taskId && dep.taskId !== parseInt(id)) {
          insertDep.run(id, dep.taskId, dep.type || 'finish_to_start', dep.lagDays || 0);
        }
      }
    }

    res.json({
      success: true,
      message: '依赖关系设置成功'
    });
  } catch (error) {
    console.error('设置依赖关系失败:', error);
    res.status(500).json({ success: false, message: '设置失败', error: error.message });
  }
});

/**
 * GET /api/construction/tasks/:id/dependencies
 * 获取任务依赖关系
 */
router.get('/tasks/:id/dependencies', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;

    const dependencies = db.prepare(`
      SELECT td.*, t.name as depends_on_task_name, t.task_no as depends_on_task_no
      FROM task_dependencies td
      LEFT JOIN construction_tasks t ON td.depends_on_task_id = t.id
      WHERE td.task_id = ?
    `).all(id);

    // 获取依赖此任务的任务
    const dependents = db.prepare(`
      SELECT td.*, t.name as task_name, t.task_no as task_no
      FROM task_dependencies td
      LEFT JOIN construction_tasks t ON td.task_id = t.id
      WHERE td.depends_on_task_id = ?
    `).all(id);

    res.json({
      success: true,
      data: { dependencies, dependents }
    });
  } catch (error) {
    console.error('获取依赖关系失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * POST /api/construction/tasks/batch
 * 批量创建任务（甘特图拖拽创建）
 */
router.post('/tasks/batch', authMiddleware, (req, res) => {
  try {
    const { tasks } = req.body;
    const userId = req.user.id;

    if (!tasks || tasks.length === 0) {
      return res.status(400).json({ success: false, message: '没有任务数据' });
    }

    const projectId = tasks[0].projectId;
    const createdTasks = [];

    // 使用事务
    const createTask = db.transaction(() => {
      for (const taskData of tasks) {
        const taskNo = generateTaskNo(taskData.projectId);
        
        const result = db.prepare(`
          INSERT INTO construction_tasks (
            task_no, project_id, milestone_id, name, 
            planned_start_date, planned_end_date, planned_duration,
            assignee_id, priority, status, creator_id,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now'), datetime('now'))
        `).run(
          taskNo, taskData.projectId, taskData.milestoneId || null, taskData.name,
          taskData.plannedStartDate, taskData.plannedEndDate, 
          taskData.plannedDuration || 0,
          taskData.assigneeId || null, taskData.priority || 'normal', userId
        );

        createdTasks.push({
          id: result.lastInsertRowid,
          taskNo,
          ...taskData
        });
      }
    });

    createTask();

    res.json({
      success: true,
      message: `成功创建 ${createdTasks.length} 个任务`,
      data: createdTasks
    });
  } catch (error) {
    console.error('批量创建任务失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

/**
 * PUT /api/construction/tasks/:id/dates
 * 更新任务日期（甘特图拖拽）
 */
router.put('/tasks/:id/dates', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const { plannedStartDate, plannedEndDate, plannedDuration } = req.body;

    const task = db.prepare('SELECT * FROM construction_tasks WHERE id = ?').get(id);
    if (!task) {
      return res.status(404).json({ success: false, message: '任务不存在' });
    }

    // 计算工期
    let duration = plannedDuration;
    if (plannedStartDate && plannedEndDate) {
      const start = new Date(plannedStartDate);
      const end = new Date(plannedEndDate);
      duration = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    }

    db.prepare(`
      UPDATE construction_tasks 
      SET planned_start_date = ?, planned_end_date = ?, planned_duration = ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(plannedStartDate, plannedEndDate, duration, id);

    res.json({
      success: true,
      message: '日期更新成功'
    });
  } catch (error) {
    console.error('更新日期失败:', error);
    res.status(500).json({ success: false, message: '更新失败', error: error.message });
  }
});

module.exports = router;
});
