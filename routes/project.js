const express = require('express');
const { Project } = require('../models/project');
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { id, name, createdBy, budget } = req.body;
    const project = await Project.create({ id, name, createdBy, budget });
    res.status(201).json(project);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
