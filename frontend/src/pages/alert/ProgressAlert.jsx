import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, Modal, Descriptions, Progress, message, Tooltip, Statistic, Row, Col } from 'antd';
import { WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, AlertOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

function ProgressAlert() {
  const [loading, setLoading] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [reportVisible, setReportVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/progress-alerts`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setAlerts(result.data || []);
      }
    } catch (error) {
      console.error('加载预警数据失败:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = async (projectId) => {
    try {
      const response = await fetch(`${API_BASE}/progress-alerts/report/${projectId}`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setCurrentReport(result.data);
        setReportVisible(true);
      }
    } catch (error) {
      console.error('加载报告失败:', error);
      message.error('加载报告失败');
    }
  };

  const handleManualCheck = async () => {
    try {
      const response = await fetch(`${API_BASE}/progress-alerts/check`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        message.success(result.message);
        loadAlerts();
      }
    } catch (error) {
      console.error('手动检查失败:', error);
      message.error('检查失败');
    }
  };

  const getStatusTag = (status, deviation) => {
    const statusMap = {
      'ahead': { color: 'green', icon: <CheckCircleOutlined />, text: '进度超前' },
      'on_track': { color: 'blue', icon: <ClockCircleOutlined />, text: '进度正常' },
      'slight_delay': { color: 'orange', icon: <WarningOutlined />, text: '轻微滞后' },
      'serious_delay': { color: 'red', icon: <AlertOutlined />, text: '严重滞后' },
      'no_data': { color: 'default', icon: <ClockCircleOutlined />, text: '无进度数据' }
    };

    const info = statusMap[status] || statusMap['no_data'];
    return (
      <Tag color={info.color} icon={info.icon}>
        {info.text} ({deviation > 0 ? '+' : ''}{deviation}%)
      </Tag>
    );
  };

  const columns = [
    {
      title: '项目编号',
      dataIndex: 'project_no',
      key: 'project_no',
      width: 120
    },
    {
      title: '项目名称',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      ellipsis: true
    },
    {
      title: '计划进度',
      dataIndex: 'plannedProgress',
      key: 'plannedProgress',
      width: 150,
      render: (val) => (
        <Progress percent={Math.round(val)} size="small" status="normal" />
      )
    },
    {
      title: '实际进度',
      dataIndex: 'actualProgress',
      key: 'actualProgress',
      width: 150,
      render: (val, record) => {
        const status = record.deviation >= -5 ? 'success' : (record.deviation >= -15 ? 'normal' : 'exception');
        return <Progress percent={Math.round(val)} size="small" status={status} />;
      }
    },
    {
      title: '偏差',
      dataIndex: 'deviation',
      key: 'deviation',
      width: 100,
      sorter: (a, b) => a.deviation - b.deviation,
      render: (val) => (
        <span style={{ color: val >= 0 ? '#52c41a' : (val >= -15 ? '#faad14' : '#ff4d4f'), fontWeight: 'bold' }}>
          {val > 0 ? '+' : ''}{val}%
        </span>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status, record) => getStatusTag(status, record.deviation)
    },
    {
      title: '最新填报',
      dataIndex: 'latestReportDate',
      key: 'latestReportDate',
      width: 100,
      render: (val) => val || '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="link" onClick={() => handleViewReport(record.id)}>
          查看报告
        </Button>
      )
    }
  ];

  // 统计数据
  const stats = {
    total: alerts.length,
    ahead: alerts.filter(a => a.status === 'ahead').length,
    onTrack: alerts.filter(a => a.status === 'on_track').length,
    slightDelay: alerts.filter(a => a.status === 'slight_delay').length,
    seriousDelay: alerts.filter(a => a.status === 'serious_delay').length
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card title="进度偏差预警" extra={
        <Button icon={<SyncOutlined />} onClick={handleManualCheck}>
          手动检查
        </Button>
      }>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Statistic title="项目总数" value={stats.total} />
          </Col>
          <Col span={4}>
            <Statistic title="进度超前" value={stats.ahead} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={4}>
            <Statistic title="进度正常" value={stats.onTrack} valueStyle={{ color: '#1890ff' }} />
          </Col>
          <Col span={4}>
            <Statistic title="轻微滞后" value={stats.slightDelay} valueStyle={{ color: '#faad14' }} />
          </Col>
          <Col span={4}>
            <Statistic title="严重滞后" value={stats.seriousDelay} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 进度报告弹窗 */}
      <Modal
        title={`项目进度报告 - ${currentReport?.project?.name || ''}`}
        open={reportVisible}
        onCancel={() => setReportVisible(false)}
        footer={null}
        width={700}
      >
        {currentReport && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="项目编号">{currentReport.project.projectNo}</Descriptions.Item>
              <Descriptions.Item label="项目经理">{currentReport.project.manager}</Descriptions.Item>
              <Descriptions.Item label="合同金额">¥{Number(currentReport.project.contractAmount || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="计划周期">{currentReport.project.startDate} ~ {currentReport.project.endDate}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title="进度对比" style={{ marginBottom: 16 }}>
              <Row gutter={24}>
                <Col span={8}>
                  <Statistic title="计划进度" value={currentReport.progress.planned} suffix="%" />
                </Col>
                <Col span={8}>
                  <Statistic title="实际进度" value={currentReport.progress.actual} suffix="%" />
                </Col>
                <Col span={8}>
                  <Statistic 
                    title="进度偏差" 
                    value={currentReport.progress.deviation} 
                    suffix="%"
                    valueStyle={{ 
                      color: currentReport.progress.deviation >= 0 ? '#52c41a' : '#ff4d4f' 
                    }}
                  />
                </Col>
              </Row>
            </Card>

            {currentReport.milestoneStatus && currentReport.milestoneStatus.total > 0 && (
              <Card size="small" title="里程碑状态" style={{ marginBottom: 16 }}>
                <Row gutter={16}>
                  <Col span={6}>总数: {currentReport.milestoneStatus.total}</Col>
                  <Col span={6}>已完成: {currentReport.milestoneStatus.completed}</Col>
                  <Col span={6}>按期: {currentReport.milestoneStatus.onTrack}</Col>
                  <Col span={6} style={{ color: '#ff4d4f' }}>延期: {currentReport.milestoneStatus.delayed}</Col>
                </Row>
              </Card>
            )}

            <Card size="small" title="改进建议" style={{ background: '#f6f6f6' }}>
              <pre style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{currentReport.suggestion}</pre>
            </Card>

            {currentReport.issues && (
              <Card size="small" title="当前问题" style={{ marginTop: 16, background: '#fff2f0' }}>
                <p style={{ margin: 0 }}>{currentReport.issues}</p>
              </Card>
            )}

            <div style={{ marginTop: 16, color: '#999', fontSize: 12 }}>
              报告生成时间: {dayjs(currentReport.generateTime).format('YYYY-MM-DD HH:mm:ss')}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default ProgressAlert;
