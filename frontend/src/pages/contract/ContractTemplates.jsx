/**
 * 合同模板管理页面
 * PRD 3.5: 支持创建收入/支出合同模板，模板变量自动替换
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, Select, Tag,
  message, Popconfirm, Descriptions, Tabs, Typography, Tooltip, Row, Col
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  FileTextOutlined, StarOutlined, ThunderboltOutlined
} from '@ant-design/icons';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

const API_BASE = window.location.origin + '/api';

function getHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

const TYPE_MAP = {
  income: { text: '收入合同', color: 'green' },
  expense: { text: '支出合同', color: 'blue' }
};

const CATEGORY_MAP = {
  equipment: '设备类',
  material: '材料类',
  labor: '劳务类',
  construction: '施工类',
  general: '通用类'
};

const ContractTemplates = () => {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [activeTab, setActiveTab] = useState('income');
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [variables, setVariables] = useState([]);
  const [isEdit, setIsEdit] = useState(false);
  const [form] = Form.useForm();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: activeTab });
      const res = await fetch(`${API_BASE}/contract-templates?${params}`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data || []);
      }
    } catch (error) {
      message.error('获取模板列表失败');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  const fetchVariables = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/contract-templates/variables/common`, {
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setVariables(data.data || []);
      }
    } catch (error) {
      console.error('获取变量列表失败:', error);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);
  useEffect(() => { fetchVariables(); }, [fetchVariables]);

  const handleCreate = () => {
    setIsEdit(false);
    form.resetFields();
    form.setFieldsValue({ type: activeTab, status: 'active' });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setIsEdit(true);
    setCurrentTemplate(record);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      category: record.category,
      content: record.content,
      status: record.status,
      description: record.description
    });
    setModalVisible(true);
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const url = isEdit
        ? `${API_BASE}/contract-templates/${currentTemplate.id}`
        : `${API_BASE}/contract-templates`;
      const method = isEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: getHeaders(),
        body: JSON.stringify(values)
      });
      const data = await res.json();

      if (data.success) {
        message.success(isEdit ? '模板更新成功' : '模板创建成功');
        setModalVisible(false);
        fetchTemplates();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      console.error('提交失败:', error);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/contract-templates/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        message.success('模板删除成功');
        fetchTemplates();
      } else {
        message.error(data.message || '删除失败');
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSetDefault = async (record) => {
    try {
      const res = await fetch(`${API_BASE}/contract-templates/${record.id}/set-default`, {
        method: 'POST',
        headers: getHeaders()
      });
      const data = await res.json();
      if (data.success) {
        message.success('已设为默认模板');
        fetchTemplates();
      } else {
        message.error(data.message || '操作失败');
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleViewDetail = (record) => {
    setCurrentTemplate(record);
    setDetailVisible(true);
  };

  const columns = [
    {
      title: '模板编号',
      dataIndex: 'template_code',
      key: 'template_code',
      width: 140
    },
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (text) => CATEGORY_MAP[text] || text
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'default'}>
          {status === 'active' ? '启用' : '停用'}
        </Tag>
      )
    },
    {
      title: '默认',
      dataIndex: 'is_default',
      key: 'is_default',
      width: 80,
      render: (val) => val ? <StarOutlined style={{ color: '#faad14' }} /> : '-'
    },
    {
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 160,
      render: (text) => text ? new Date(text).toLocaleString('zh-CN') : '-'
    },
    {
      title: '操作',
      key: 'action',
      width: 250,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} /></Tooltip>
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          {!record.is_default && (
            <Tooltip title="设为默认">
              <Button type="link" size="small" icon={<StarOutlined />} onClick={() => handleSetDefault(record)} />
            </Tooltip>
          )}
          <Popconfirm title="确定删除此模板？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
          { key: 'income', label: '收入合同模板' },
          { key: 'expense', label: '支出合同模板' }
        ]} />
        <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Text type="secondary">
              支持 {{contract_no: '合同编号', party_a: '甲方', party_b: '乙方', contract_amount: '合同金额'}} 等变量
            </Text>
          </Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新建模板</Button>
        </div>
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="id"
          loading={loading}
          pagination={{ showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
        />
      </Card>

      <Modal
        title={isEdit ? '编辑合同模板' : '新建合同模板'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="模板名称" rules={[{ required: true, message: '请输入模板名称' }]}>
                <Input placeholder="请输入模板名称" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
                <Select placeholder="请选择分类">
                  {Object.entries(CATEGORY_MAP).map(([k, v]) => (
                    <Option key={k} value={k}>{v}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="type" label="合同类型" rules={[{ required: true }]}>
            <Select>
              <Option value="income">收入合同</Option>
              <Option value="expense">支出合同</Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Option value="active">启用</Option>
              <Option value="inactive">停用</Option>
            </Select>
          </Form.Item>
          <Form.Item name="content" label="模板内容" rules={[{ required: true, message: '请输入模板内容' }]}
            extra="使用 {{变量名}} 插入变量，如 {{contract_no}}、{{party_a}}"
          >
            <TextArea rows={15} placeholder="请输入合同模板内容，使用 {{变量名}} 作为占位符" />
          </Form.Item>
          <Form.Item name="description" label="备注说明">
            <TextArea rows={2} placeholder="模板说明（可选）" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="模板详情"
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={<Button onClick={() => setDetailVisible(false)}>关闭</Button>}
        width={800}
      >
        {currentTemplate && (
          <>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="模板编号">{currentTemplate.template_code}</Descriptions.Item>
              <Descriptions.Item label="模板名称">{currentTemplate.name}</Descriptions.Item>
              <Descriptions.Item label="合同类型">
                <Tag color={TYPE_MAP[currentTemplate.type]?.color}>{TYPE_MAP[currentTemplate.type]?.text}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="分类">{CATEGORY_MAP[currentTemplate.category]}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={currentTemplate.status === 'active' ? 'green' : 'default'}>
                  {currentTemplate.status === 'active' ? '启用' : '停用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="是否默认">{currentTemplate.is_default ? '是' : '否'}</Descriptions.Item>
              <Descriptions.Item label="描述" span={2}>{currentTemplate.description || '-'}</Descriptions.Item>
            </Descriptions>
            <Card size="small" title="模板内容">
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.8 }}>
                {currentTemplate.content}
              </pre>
            </Card>
          </>
        )}
      </Modal>
    </div>
  );
};

export default ContractTemplates;
