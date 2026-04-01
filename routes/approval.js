const express = require('express');
const { Approval } = require('../models/approval');
const { Project } = require('../models/project');
const AuthorizeMiddleware = require('../middleware/auth');
const router = express.Router();

router.post('/:projectId/review', AuthorizeMiddleware('GM'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { step, status, comment, operator } = req.body;
    
    // 记录审批
    const approval = await Approval.create({ projectId, step, status, comment, operator });
    
    // 如果审批通过，更新项目状态
    if (status === 'APPROVED') {
      await Project.update({ status: 'approved' }, { where: { id: projectId } });
    }
    
    res.status(201).json({ approval, message: 'Review recorded and status updated' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
