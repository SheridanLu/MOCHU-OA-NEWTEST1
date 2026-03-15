import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, message, Tag, Space,
  Descriptions, Steps, Divider, Radio, TextArea, Statistic, Row, Col, DatePicker
} from 'antd';
import {
  PlusOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileTextOutlined, AuditOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;
const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

// 签证类型
const VISA_TYPES = {
  labor: { text: '劳务支出合同', color: 'blue' },
  change: { text: '甲方需求变更', color: 'orange' },
  site: { text: '现场签证', color: 'green' },
  other: { text: '其他', color: 'default' }
};

// 状态映射
const STATUS_MAP = {
  pending: { text: '待审批', color: 'orange' },
  approved: { text: '已通过', color: 'green' },
  rejected: { text: '已拒绝', color: 'red' }
};

function LaborVisaList() {
  const [loading, setLoading] = useState(false);
  const [visas, setVisas] = useState([]);
  const [projects, setProjects] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [approveVisible, setApproveVisible] = useState(false);
  const [currentVisa, setCurrentVisa] = useState(null);
  const [form] = Form.useForm();
  const [approveForm] = Form.useForm();

  useEffect(() => {
    loadVisas();
    loadProjects();
  }, []);

  const loadVisas = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/labor-visas`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setVisas(result.data || []);
      }
    } catch (error) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/projects?type=entity&pageSize=100`, {
        headers: getAuthHeaders()
      });
      const result = await response.json();
      if (result.success) {
        setProjects(result.data || []);
      }
    } catch (error) {
      console.error('加载项目失败:', error);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setModalVisible(true);
  };

  const handleSubmit = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/labor-visas`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (result.success) {
        message.success('申请提交成功');
        setModalVisible(false);
        loadVisas();
      } else {
        message.error(result.message || '提交失败');
      }
    } catch (error) {
      message.error('提交失败');
    }
  };

  const handleViewDetail = async (visa) => {
    setCurrentVisa(visa);
    setDetailVisible(true);
  };

  const handleApprove = (visa) => {
    setCurrentVisa(visa);
    approveForm.resetFields();
    setApproveVisible(true);
  };

  const handleSubmitApprove = async (values) => {
    try {
      const response = await fetch(`${API_BASE}/labor-visas/${currentVisa.id}/approve`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(values)
      });
      const result = await response.json();
      if (result.success) {
        message.success(result.message);
        setApproveVisible(false);
        loadVisas();
      } else {
        message.error(result.message || '审批失败');
      }
    } catch (error) {
      message.error('审批失败');
    }
  };

  const columns = [
    {
      title: '签证编号',
      dataIndex: 'visa_no',
      width: 140
    },
    {
      title: '项目',
      dataIndex: 'project_id',
      width: 150,
      render: (projectId) => {
        const project = projects.find(p => p.id === projectId);
        return project ? `${project.project_no} - ${project.name}` : '-';
      }
    },
    {
      title: '签证类型',
      dataIndex: 'visa_type',
      width: 120,
      render: (type) => {
        const info = VISA_TYPES[type] || VISA_TYPES.other;
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '标题',
      dataIndex: 'title',
      ellipsis: true
    },
    {
      title: '金额',
      dataIndex: 'amount',
      width: 100,
      render: (val) => val ? `¥${Number(val).toLocaleString()}` : '-'
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 100,
      render: (status) => {
        const info = STATUS_MAP[status] || STATUS_MAP.pending;
        return <Tag color={info.color}>{info.text}</Tag>;
      }
    },
    {
      title: '申请时间',
      dataIndex: 'applied_at',
      width: 150,
      render: (val) => val ? dayjs(val).format('YYYY-MM-DD HH:mm') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button type="link" size="small" onClick={() => handleViewDetail(record)}>
            查看
          </Button>
          {record.status === 'pending' && (
            <Button type="link" size="small" onClick={() => handleApprove(record)}>
              审批
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 统计
  const stats = {
    total: visas.length,
    pending: visas.filter(v => v.status === 'pending').length,
    approved: visas.filter(v => v.status === 'approved').length,
    rejected: visas.filter(v => v.status === 'rejected').length
  };

  return (
    <div style={{ padding: '24px' }}>
      <Card 
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            劳务签证申请
          </span>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新建申请
          </Button>
        }
      >
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={4}>
            <Statistic title="申请总数" value={stats.total} />
          </Col>
          <Col span={4}>
            <Statistic title="待审批" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Col>
          <Col span={4}>
            <Statistic title="已通过" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
          </Col>
          <Col span={4}>
            <Statistic title="已拒绝" value={stats.rejected} valueStyle={{ color: '#ff4d4f' }} />
          </Col>
        </Row>

        <Table
          columns={columns}
          dataSource={visas}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 新建申请弹窗 */}
      <Modal
        title="新建劳务签证申请"
        open={modalVisible}
        onOk={() => form.submit()}
        onCancel={() => setModalVisible(false)}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="projectId"
            label="关联项目"
            rules={[{ required: true, message: '请选择项目' }]}
          >
            <Select placeholder="请选择项目" showSearch optionFilterProp="children">
              {projects.map(p => (
                <Option key={p.id} value={p.id}>{p.project_no} - {p.name}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="visaType"
            label="签证类型"
            rules={[{ required: true, message: '请选择签证类型' }]}
          >
            <Select placeholder="请选择签证类型">
              <Option value="labor">劳务支出合同</Option>
              <Option value="change">甲方需求变更</Option>
              <Option value="site">现场签证</Option>
              <Option value="other">其他</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="title"
            label="申请标题"
            rules={[{ required: true, message: '请输入申请标题' }]}
          >
            <Input placeholder="请输入申请标题" maxLength={100} />
          </Form.Item>

          <Form.Item
            name="amount"
            label="申请金额"
          >
            <Input 
              type="number" 
              placeholder="请输入申请金额" 
              addonBefore="¥"
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="申请说明"
          >
            <Input.TextArea rows={3} placeholder="请输入申请说明" maxLength={500} />
          </Form.Item>

          <Form.Item
            name="reason"
            label="申请原因"
          >
            <Input.TextArea rows={2} placeholder="请输入申请原因" maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 详情弹窗 */}
      <Modal
        title="劳务签证详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={700}
      >
        {currentVisa && (
          <div>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="签证编号">{currentVisa.visa_no}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={STATUS_MAP[currentVisa.status]?.color}>
                  {STATUS_MAP[currentVisa.status]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="签证类型">
                <Tag color={VISA_TYPES[currentVisa.visa_type]?.color}>
                  {VISA_TYPES[currentVisa.visa_type]?.text}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="申请金额">
                ¥{Number(currentVisa.amount || 0).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="申请标题" span={2}>{currentVisa.title}</Descriptions.Item>
              <Descriptions.Item label="申请说明" span={2}>{currentVisa.description || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请原因" span={2}>{currentVisa.reason || '-'}</Descriptions.Item>
              <Descriptions.Item label="申请时间">
                {dayjs(currentVisa.applied_at).format('YYYY-MM-DD HH:mm:ss')}
              </Descriptions.Item>
            </Descriptions>

            <Divider>审批流程</Divider>
            <Steps
              current={currentVisa.status === 'approved' ? 2 : (currentVisa.status === 'rejected' ? 1 : 0)}
              size="small"
              items={[
                {
                  title: '预算管理',
                  status: currentVisa.status === 'pending' ? 'wait' : 
                          (currentVisa.status === 'approved' ? 'finish' : 'error'),
                  icon: currentVisa.status === 'approved' ? <CheckCircleOutlined /> : 
                        (currentVisa.status === 'rejected' ? <CloseCircleOutlined /> : <AuditOutlined />)
                },
                {
                  title: '总经理',
                  status: currentVisa.status === 'approved' ? 'finish' : 'wait',
                  icon: currentVisa.status === 'approved' ? <CheckCircleOutlined /> : <AuditOutlined />
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* 审批弹窗 */}
      <Modal
        title="审批劳务签证"
        open={approveVisible}
        onOk={() => approveForm.submit()}
        onCancel={() => setApproveVisible(false)}
        width={500}
        destroyOnClose
      >
        {currentVisa && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
            <div style={{ fontWeight: 600 }}>{currentVisa.title}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{currentVisa.visa_no}</div>
            <div style={{ marginTop: 8 }}>金额: ¥{Number(currentVisa.amount || 0).toLocaleString()}</div>
          </div>
        )}

        <Form
          form={approveForm}
          layout="vertical"
          onFinish={handleSubmitApprove}
        >
          <Form.Item
            name="action"
            label="审批意见"
            rules={[{ required: true, message: '请选择审批意见' }]}
          >
            <Radio.Group>
              <Radio value="approve">
                <CheckCircleOutlined style={{ color: '#52c41a' }} /> 同意
              </Radio>
              <Radio value="reject">
                <CloseCircleOutlined style={{ color: '#ff4d4f' }} /> 不同意
              </Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.action !== currentValues.action}
          >
            {({ getFieldValue }) => 
              getFieldValue('action') === 'reject' ? (
                <Form.Item
                  name="opinion"
                  label="不同意原因"
                  rules={[{ required: true, message: '请输入不同意原因' }]}
                >
                  <Input.TextArea rows={3} placeholder="请输入不同意原因" />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default LaborVisaList;
