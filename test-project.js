const axios = require('axios');

async function testProjectCreation() {
  try {
    const response = await axios.post('http://localhost:3000/api/projects', {
      id: 'PROJ001',
      name: 'Test Project 2026-04-01',
      budget: 100000,
      createdBy: 'Purchaser01'
    });
    console.log('Project created:', response.data);
  } catch (error) {
    console.error('Error creating project:', error.response ? error.response.data : error.message);
  }
}

testProjectCreation();
