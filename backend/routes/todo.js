/**
 * 待办事项API
 */

const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const { authMiddleware } = require('../middleware/auth');
const { checkPermission } = require('../middleware/permission');

/**
 * GET /api/todos
 * 获取当前用户的待办事项
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;
    const { status, type, page = 1, pageSize = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = `
      SELECT t.*, p.project_no, p.name as project_name,
             u.real_name as assigner_name
      FROM todos t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN users u ON t.assigner_id = u.id
      WHERE t.assignee_id = ?
    `;
    const params = [userId];

    if (status) {
      sql += ' AND t.status = ?';
      params.push(status);
    }

    if (type) {
      sql += ' AND t.type = ?';
      params.push(type);
    }

    // 获取总数
    const countSql = sql.replace(/SELECT.*FROM/, 'SELECT COUNT(*) as total FROM');
    const countResult = db.prepare(countSql).get(...params);
    const total = countResult ? countResult.total : 0;

    // 排序和分页
    sql += ' ORDER BY t.priority DESC, t.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const todos = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: todos,
      pagination: {
        current: parseInt(page),
        pageSize: parseInt(pageSize),
        total
      }
    });
  } catch (error) {
    console.error('获取待办事项失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * GET /api/todos/stats
 * 获取待办事项统计
 */
router.get('/stats', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN priority = 'urgent' AND status = 'pending' THEN 1 ELSE 0 END) as urgent
      FROM todos
      WHERE assignee_id = ?
    `).get(userId);

    res.json({
      success: true,
      data: stats || { total: 0, pending: 0, in_progress: 0, completed: 0, urgent: 0 }
    });
  } catch (error) {
    console.error('获取待办统计失败:', error);
    res.status(500).json({ success: false, message: '获取失败', error: error.message });
  }
});

/**
 * PUT /api/todos/:id/complete
 * 完成待办事项
 */
router.put('/:id/complete', authMiddleware, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // 检查是否是自己的待办
    const todo = db.prepare('SELECT * FROM todos WHERE id = ? AND assignee_id = ?').get(id, userId);
    if (!todo) {
      return res.status(404).json({ success: false, message: '待办事项不存在' });
    }

    db.prepare(`
      UPDATE todos 
      SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(id);

    res.json({
      success: true,
      message: '待办事项已完成'
    });
  } catch (error) {
    console.error('完成待办失败:', error);
    res.status(500).json({ success: false, message: '操作失败', error: error.message });
  }
});

/**
 * POST /api/todos
 * 创建待办事项（内部使用）
 */
router.post('/', authMiddleware, checkPermission('todo:create'), (req, res) => {
  try {
    const {
      title, content, type = 'general', priority = 'normal',
      projectId, relatedId, relatedType, assigneeId, dueDate
    } = req.body;
    const userId = req.user.id;

    if (!title || !assigneeId) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const result = db.prepare(`
      INSERT INTO todos (
        title, content, type, priority, project_id, related_id, related_type,
        assignee_id, assigner_id, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      title, content || '', type, priority, projectId || null, relatedId || null,
      relatedType || null, assigneeId, userId, dueDate || null
    );

    res.json({
      success: true,
      message: '待办事项创建成功',
      data: { id: result.lastInsertRowid }
    });
  } catch (error) {
    console.error('创建待办失败:', error);
    res.status(500).json({ success: false, message: '创建失败', error: error.message });
  }
});

/**
 * 创建待办事项的辅助函数（供其他模块调用）
 */
function createTodo(params) {
  const { title, content, type, priority, projectId, relatedId, relatedType, assigneeId, assignerId, dueDate } = params;

  try {
    const result = db.prepare(`
      INSERT INTO todos (
        title, content, type, priority, project_id, related_id, related_type,
        assignee_id, assigner_id, due_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      title, content || '', type || 'general', priority || 'normal',
      projectId || null, relatedId || null, relatedType || null,
      assigneeId, assignerId || null, dueDate || null
    );

    return result.lastInsertRowid;
  } catch (error) {
    console.error('创建待办失败:', error);
    return null;
  }
}

module.exports = { router, createTodo };
