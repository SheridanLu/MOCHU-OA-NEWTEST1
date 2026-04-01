const express = require('express');
const { sequelize } = require('./models/project');
const projectRoutes = require('./routes/project');
const approvalRoutes = require('./routes/approval');

const app = express();
app.use(express.json());

app.use('/api/projects', projectRoutes);
app.use('/api/approvals', approvalRoutes);

sequelize.sync().then(() => {
  app.listen(3000, () => console.log('Server running on port 3000'));
});
