/**
 * 收入合同拆分管理页面
 * PRD 8.1: 将收入合同按任务拆分，关联甘特图，同步进度计算产值
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Modal, Form, Input, InputNumber,
  Select, Tag, message, Popconfirm, Empty, Statistic, Row, Col,
  Typography, Divider, Tooltip, Spin
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SyncOutlined,
  PieChartOutlined, DollarOutlined, UnorderedListOutlined
} from '@ant-design/icons';

const { Option } = Select;
const { Text } = Typography;

const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
}

function IncomeContractSplits() {
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [splits, setSplits] = useState([]);
  const [summary, setSummary] = useState({ total_amount: 0, total_rate: 0, accumulated_amount: 0 });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [currentSplit, setCurrentSplit] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [form] = Form.useForm();

  // 获取收入合同列表
  const fetchContracts = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/contracts?type=income&pageSize=100`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setContracts(data.data || []);
        // 自动选中第一个
        if (data.data?.length > 0 && !selectedContract) {
          handleSelectContract(data.data[0]);
        }
      }
    } catch (error) {
      message.error('获取合同列表失败');
    }
  }, []);

  // 获取拆分列表
  const fetchSplits = useCallback(async (contractId) => {
    if (!contractId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/income-splits?contract_id=${contractId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setSplits(data.data || []);
        setSummary(data.summary || { total_amount: 0, total_rate: 0, accumulated_amount: 0 });
      }
    } catch (error) {
      message.error('获取拆分列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  // 获取甘特图任务
  const fetchTasks = useCallback(async (projectId) => {
    if (!projectId) return;
    try {
      const res = await fetch(`${API_BASE}/construction/tasks?projectId=${projectId}`, {
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        setTasks(data.data || []);
      }
    } catch (error) {
      console.error('获取任务列表失败');
    }
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const handleSelectContract = (contract) => {
    setSelectedContract(contract);
    fetchSplits(contract.id);
    fetchTasks(contract.project_id);
  };

  // 同步进度
  const handleSyncProgress = async () => {
    if (!selectedContract) return;
    setSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/income-splits/sync-progress`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ contract_id: selectedContract.id })
      });
      const data = await res.json();
      if (data.success) {
        message.success('进度同步成功');
        fetchSplits(selectedContract.id);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('同步失败');
    } finally {
      setSyncing(false);
    }
  };

  // 创建/编辑拆分
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const url = isEdit
        ? `${API_BASE}/income-splits/${currentSplit.id}`
        : `${API_BASE}/income-splits`;
      const method = isEdit ? 'PUT' : 'POST';

      const body = {
        ...values,
        contract_id: selectedContract.id,
        project_id: selectedContract.project_id
      };

      const res = await fetch(url, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.success) {
        message.success(isEdit ? '更新成功' : '创建成功');
        setModalVisible(false);
        form.resetFields();
        fetchSplits(selectedContract.id);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  // 删除拆分
  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/income-splits/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      if (data.success) {
        message.success('删除成功');
        fetchSplits(selectedContract.id);
      } else {
        message.error(data.message);
      }
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleEdit = (record) => {
    setIsEdit(true);
    setCurrentSplit(record);
    form.setFieldsValue({
      task_name: record.task_name,
      task_id: record.task_id,
      split_amount: record.split_amount,
      split_rate: record.split_rate,
      sort_order: record.sort_order,
      remark: record.remark
    });
    setModalVisible(true);
  };

  const handleCreate = () => {
    setIsEdit(false);
    setCurrentSplit(null);
    form.resetFields();
    setModalVisible(true);
  };

  const columns = [
    {
      title: '序号',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: '任务名称',
      dataIndex: 'task_name',
      key: 'task_name',
      ellipsis: true
    },
    {
      title: '关联甘特图',
      dataIndex: 'task_id',
      key: 'task_id',
      width: 120,
      render: (taskId) => {
        if (!taskId) return <Text type="secondary">未关联</Text>;
        const task = tasks.find(t => t.id === taskId);
        return task ? (
          <Tooltip title={`进度: ${task.progress_rate || 0}%`}>
            <Tag color="blue">{task.name}</Tag>
          </Tooltip>
        ) : <Text type="secondary">ID:{taskId}</Text>;
      }
    },
    {
      title: '拆分比例(%)',
      dataIndex: 'split_rate',
      key: 'split_rate',
      width: 120,
      render: (val) => `${val || 0}%`
    },
    {
      title: '任务进度(%)',
      dataIndex: 'progress_rate',
      key: 'progress_rate',
      width: 120,
      render: (val) => (
        <span>
          {val || 0}%
          {val > 0 && val < 100 && <span style={{ marginLeft: 8, color: '#faad14' }}>进行中</span>}
          {val >= 100 && <span style={{ marginLeft: 8, color: '#52c41a' }}>已完成</span>}
        </span>
      )
    },
    {
      title: '当期产值',
      dataIndex: 'current_amount',
      key: 'current_amount',
      width: 120,
      render: (val) => `¥${(val || 0).toLocaleString()}`
    },
    {
      title: '累计产值',
      dataIndex: 'accumulated_amount',
      key: 'accumulated_amount',
      width: 120,
      render: (val) => <Text strong style={{ color: '#1890ff' }}>¥{(val || 0).toLocaleString()}</Text>
    },
    {
      title: '备注',
      dataIndex: 'remark',
      key: 'remark',
      width: 120,
      ellipsis: true
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="编辑"><Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} /></Tooltip>
          <Popconfirm title="确定删除此拆分项？" onConfirm={() => handleDelete(record.id)}>
            <Tooltip title="删除"><Button type="link" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 16 }}>
          <Text style={{ fontSize: 16, fontWeight: 500 }}>选择收入合同</Text>
        </div>
        <Select
          style={{ width: '100%', marginBottom: 16 }}
          placeholder="请选择收入合同"
          value={selectedContract?.id}
          onChange={(_, option) => handleSelectContract(option.data)}
          showSearch
          optionFilterProp="children"
        >
          {contracts
            .filter(c => c.type === 'income')
            .map(c => (
              <Option key={c.id} value={c.id} data={c}>
                {c.contract_no || c.name} - ¥{(c.contract_amount || 0).toLocaleString()}
              </Option>
            ))}
        </Select>

        {selectedContract && (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="合同金额" value={selectedContract.contract_amount || 0} prefix="¥" precision={2} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="拆分比例合计" value={summary.total_rate} suffix="%" precision={1} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="累计产值" value={summary.accumulated_amount} prefix="¥" precision={2}
                    valueStyle={{ color: '#1890ff' }} />
                </Card>
              </Col>
              <Col span={6}>
                <Card size="small">
                  <Statistic title="产值完成率"
                    value={selectedContract.contract_amount > 0
                      ? (summary.accumulated_amount / selectedContract.contract_amount * 100).toFixed(1)
                      : 0}
                    suffix="%" />
                </Card>
              </Col>
            </Row>

            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between' }}>
              <Space>
                <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                  添加拆分项
                </Button>
                <Button icon={<SyncOutlined />} onClick={handleSyncProgress} loading={syncing}>
                  同步甘特图进度
                </Button>
              </Space>
              <Text type="secondary">
                共 {splits.length} 项拆分
              </Text>
            </div>

            {splits.length === 0 ? (
              <Empty description="暂无拆分项，请点击「添加拆分项」" />
            ) : (
              <Table
                columns={columns}
                dataSource={splits}
                rowKey="id"
                loading={loading}
                pagination={false}
                size="middle"
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={4}>合计</Table.Summary.Cell>
                      <Table.Summary.Cell index={4}>
                        <Text strong>{summary.total_rate}%</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={5} />
                      <Table.Summary.Cell index={6}>
                        <Text strong style={{ color: '#1890ff' }}>
                          ¥{summary.accumulated_amount.toLocaleString()}
                        </Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={7} />
                      <Table.Summary.Cell index={8} />
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            )}
          </>
        )}
      </Card>

      <Modal
        title={isEdit ? '编辑拆分项' : '添加拆分项'}
        open={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="task_name" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="如：智能化系统安装" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="task_id" label="关联甘特图任务" tooltip="选择后可自动同步进度">
                <Select placeholder="选择甘特图任务" allowClear showSearch optionFilterProp="children">
                  {tasks.map(t => (
                    <Option key={t.id} value={t.id}>{t.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="split_rate" label="拆分比例(%)" rules={[{ required: true, message: '请输入拆分比例' }]}
                extra="占比用于计算产值，所有拆分项之和应为100%">
                <InputNumber min={0} max={100} precision={1} style={{ width: '100%' }} placeholder="如：30" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="split_amount" label="拆分金额(元)" extra="留空则按合同金额×比例自动计算">
                <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="选填" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="sort_order" label="排序">
                <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="备注（可选）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default IncomeContractSplits;
