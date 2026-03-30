/**
 * 附件上传通用路由
 * 实现统一的附件管理功能
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { db } = require('../models/database');
const authMiddleware = require('../middleware/auth').authMiddleware;

// 配置上传目录
const uploadDir = path.join(__dirname, '..', 'uploads', 'attachments');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // 按实体类型创建子目录
    const entityType = req.body.entity_type || 'common';
    const subDir = path.join(uploadDir, entityType);
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    cb(null, subDir);
  },
  filename: (req, file, cb) => {
    // 生成唯一文件名
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8')
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${safeName}${ext}`);
  }
});

// 文件过滤
const fileFilter = (req, file, cb) => {
  // 允许的文件类型
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'application/x-rar-compressed'
  ];
  
  if (allowedTypes.includes(file.mimetype) || file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('不支持的文件类型: ' + file.mimetype), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});

/**
 * POST /api/attachments/upload
 * 上传附件
 * 
 * 请求体 (multipart/form-data):
 * - entity_type: 实体类型 (visa, owner_change, overage, contract, project, bid_notice)
 * - entity_id: 实体ID
 * - file: 文件
 */
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  const { entity_type, entity_id } = req.body;
  
  if (!entity_type || !entity_id) {
    // 删除已上传的文件
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(400).json({
      success: false,
      message: '请提供entity_type和entity_id'
    });
  }

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '请选择要上传的文件'
    });
  }

  const userId = req.user?.id;
  const fileUrl = `/uploads/attachments/${entity_type}/${path.basename(req.file.path)}`;

  try {
    const result = db.prepare(`
      INSERT INTO attachments (
        entity_type, entity_id, file_name, file_path,
        file_size, file_type, uploader_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      entity_type,
      parseInt(entity_id),
      Buffer.from(req.file.originalname, 'latin1').toString('utf8'),
      fileUrl,
      req.file.size,
      req.file.mimetype,
      userId
    );

    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);

    res.json({
      success: true,
      message: '文件上传成功',
      data: attachment
    });
  } catch (error) {
    // 删除已上传的文件
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    console.error('保存附件记录失败:', error);
    res.status(500).json({
      success: false,
      message: '保存附件记录失败: ' + error.message
    });
  }
});

/**
 * POST /api/attachments/upload-multiple
 * 批量上传附件
 */
router.post('/upload-multiple', authMiddleware, upload.array('files', 10), (req, res) => {
  const { entity_type, entity_id } = req.body;
  
  if (!entity_type || !entity_id) {
    // 删除已上传的文件
    if (req.files) {
      req.files.forEach(f => fs.unlinkSync(f.path));
    }
    return res.status(400).json({
      success: false,
      message: '请提供entity_type和entity_id'
    });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({
      success: false,
      message: '请选择要上传的文件'
    });
  }

  const userId = req.user?.id;
  const uploadedAttachments = [];

  try {
    const insert = db.transaction(() => {
      req.files.forEach(file => {
        const fileUrl = `/uploads/attachments/${entity_type}/${path.basename(file.path)}`;
        
        const result = db.prepare(`
          INSERT INTO attachments (
            entity_type, entity_id, file_name, file_path,
            file_size, file_type, uploader_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
          entity_type,
          parseInt(entity_id),
          Buffer.from(file.originalname, 'latin1').toString('utf8'),
          fileUrl,
          file.size,
          file.mimetype,
          userId
        );

        const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(result.lastInsertRowid);
        uploadedAttachments.push(attachment);
      });
    });

    insert();

    res.json({
      success: true,
      message: `成功上传 ${uploadedAttachments.length} 个文件`,
      data: uploadedAttachments
    });
  } catch (error) {
    // 删除已上传的文件
    if (req.files) {
      req.files.forEach(f => fs.unlinkSync(f.path));
    }
    console.error('批量上传失败:', error);
    res.status(500).json({
      success: false,
      message: '批量上传失败: ' + error.message
    });
  }
});

/**
 * GET /api/attachments
 * 获取附件列表
 * 
 * 查询参数:
 * - entity_type: 实体类型
 * - entity_id: 实体ID
 */
router.get('/', authMiddleware, (req, res) => {
  const { entity_type, entity_id, page = 1, pageSize = 20 } = req.query;

  try {
    let sql, countSql, params, countParams;

    if (entity_type && entity_id) {
      sql = `
        SELECT a.*, u.real_name as uploader_name
        FROM attachments a
        LEFT JOIN users u ON a.uploader_id = u.id
        WHERE a.entity_type = ? AND a.entity_id = ?
        ORDER BY a.created_at DESC
      `;
      params = [entity_type, parseInt(entity_id)];
    } else {
      sql = `
        SELECT a.*, u.real_name as uploader_name
        FROM attachments a
        LEFT JOIN users u ON a.uploader_id = u.id
        ORDER BY a.created_at DESC
      `;
      params = [];
    }

    countSql = `SELECT COUNT(*) as total FROM (${sql})`;
    const total = db.prepare(countSql).get(...params).total;

    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const attachments = db.prepare(sql).all(...params);

    res.json({
      success: true,
      data: attachments,
      pagination: { total, page: parseInt(page), pageSize: parseInt(pageSize) }
    });
  } catch (error) {
    console.error('获取附件列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取附件列表失败: ' + error.message
    });
  }
});

/**
 * GET /api/attachments/:id
 * 获取附件详情
 */
router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const attachment = db.prepare(`
      SELECT a.*, u.real_name as uploader_name
      FROM attachments a
      LEFT JOIN users u ON a.uploader_id = u.id
      WHERE a.id = ?
    `).get(parseInt(id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: '附件不存在'
      });
    }

    res.json({
      success: true,
      data: attachment
    });
  } catch (error) {
    console.error('获取附件详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取附件详情失败: ' + error.message
    });
  }
});

/**
 * GET /api/attachments/:id/download
 * 下载附件
 */
router.get('/:id/download', authMiddleware, (req, res) => {
  const { id } = req.params;

  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(parseInt(id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: '附件不存在'
      });
    }

    // 构建实际文件路径
    const filePath = path.join(__dirname, '..', attachment.file_path.replace(/^\//, ''));

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: '文件不存在'
      });
    }

    // 设置响应头
    res.setHeader('Content-Type', attachment.file_type || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`);

    // 发送文件
    res.sendFile(filePath);
  } catch (error) {
    console.error('下载附件失败:', error);
    res.status(500).json({
      success: false,
      message: '下载附件失败: ' + error.message
    });
  }
});

/**
 * DELETE /api/attachments/:id
 * 删除附件
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const attachment = db.prepare('SELECT * FROM attachments WHERE id = ?').get(parseInt(id));

    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: '附件不存在'
      });
    }

    // 删除物理文件
    const filePath = path.join(__dirname, '..', attachment.file_path.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // 删除数据库记录
    db.prepare('DELETE FROM attachments WHERE id = ?').run(parseInt(id));

    res.json({
      success: true,
      message: '附件删除成功'
    });
  } catch (error) {
    console.error('删除附件失败:', error);
    res.status(500).json({
      success: false,
      message: '删除附件失败: ' + error.message
    });
  }
});

/**
 * GET /api/attachments/stats/overview
 * 获取附件统计概览
 */
router.get('/stats/overview', authMiddleware, (req, res) => {
  try {
    const totalAttachments = db.prepare('SELECT COUNT(*) as count FROM attachments').get();
    const totalSize = db.prepare('SELECT SUM(file_size) as total FROM attachments').get();
    const byType = db.prepare(`
      SELECT entity_type, COUNT(*) as count, SUM(file_size) as total_size
      FROM attachments
      GROUP BY entity_type
    `).all();

    res.json({
      success: true,
      data: {
        total_count: totalAttachments.count || 0,
        total_size: totalSize.total || 0,
        by_type: byType
      }
    });
  } catch (error) {
    console.error('获取附件统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取附件统计失败: ' + error.message
    });
  }
});

// 权限信息
router.get('/permissions', (req, res) => {
  res.json({
    success: true,
    data: {
      'attachment:upload': '上传附件',
      'attachment:view': '查看附件',
      'attachment:download': '下载附件',
      'attachment:delete': '删除附件'
    }
  });
});

module.exports = router;
