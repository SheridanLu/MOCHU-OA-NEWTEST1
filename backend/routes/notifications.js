/**
 * 站内通知路由
 * PRD 6.4/14: 审批通知、偏差预警、库存预警等
 */

const express = require('express');
const router = express.Router();
const { db } = require('../models/database');
const authMiddleware = require('../middleware/auth').authMiddleware;

/**
 * GET /api/notifications
 * 获取当前用户通知列表
 * 查询参数: type, is_read, page, pageSize
 */
router.get('/', authMiddleware, (req, res) => {
  try {
    const { type, is_read, page = 1, pageSize = 20 } = req.query;
    const userId = req.user.id;
    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    let sql = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    if (is_read !== undefined && is_read !== '') {
      sql += ' AND is_read = ?';
      params.push(parseInt(is_read));
    }

    // 未读优先
    sql += ' ORDER BY is_read ASC, created_at DESC';

    const countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const total = db.prepare(countSql).get(...params).total;

    sql += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), offset);

    const list = db.prepare(sql).all(...params);
    const unread = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0').get(userId).count;

    res.json({
      success: true,
      data: list,
      pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) },
      unread
    });
  } catch (error) {
    console.error('获取通知列表失败:', error);
    res.status(500).json({ success: false, message: '获取通知列表失败' });
  }
});

/**
 * POST /api/notifications
 * 创建通知
 * Body: { user_id, title, content, type, source_type, source_id }
 * 也支持批量: { users: [id1, id2], ... }
 */
router.post('/', authMiddleware, (req, res) => {
  try {
    const { user_id, users, title, content, type = 'info', source_type, source_id } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'title必填' });
    }

    let userIds = [];
    if (users && Array.isArray(users)) {
      userIds = users;
    } else if (user_id) {
      userIds = [user_id];
    } else {
      // 不指定用户则发给所有人
      const allUsers = db.prepare('SELECT id FROM users WHERE status = ?').all('active');
      userIds = allUsers.map(u => u.id);
    }

    const insert = db.prepare(`
      INSERT INTO notifications (user_id, title, content, type, source_type, source_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const insertMany = db.transaction((ids) => {
      ids.forEach(uid => {
        insert.run(uid, title, content || '', type, source_type || null, source_id || null);
      });
    });

    insertMany(userIds);

    res.json({ success: true, message: `已发送${userIds.length}条通知` });
  } catch (error) {
    console.error('创建通知失败:', error);
    res.status(500).json({ success: false, message: '创建通知失败' });
  }
});

/**
 * PUT /api/notifications/:id/read
 * 标记已读
 */
router.put('/:id/read', authMiddleware, (req, res) => {
  try {
    db.prepare(`
      UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?
    `).run(req.params.id, req.user.id);
    res.json({ success: true, message: '已标记为已读' });
  } catch (error) {
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

/**
 * PUT /api/notifications/read-all
 * 全部标记已读
 */
router.put('/read-all', authMiddleware, (req, res) => {
  try {
    const { type } = req.query;
    let sql = 'UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND is_read = 0';
    const params = [req.user.id];
    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }
    const result = db.prepare(sql).run(...params);
    res.json({ success: true, message: `已标记${result.changes}条为已读` });
  } catch (error) {
    res.status(500).json({ success: false, message: '操作失败' });
  }
});

/**
 * GET /api/notifications/unread-count
 * 获取未读数量
 */
router.get('/unread-count', authMiddleware, (req, res) => {
  try {
    const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0')
      .get(req.user.id).count;
    res.json({ success: true, data: { unread: count } });
  } catch (error) {
    res.status(500).json({ success: false, message: '获取未读数量失败' });
  }
});

/**
 * DELETE /api/notifications/:id
 * 删除通知
 */
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: '删除失败' });
  }
});

module.exports = router;
