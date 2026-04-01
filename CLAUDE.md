# CLAUDE.md - Long-running Agent Workflow Specification

## Goal
依据 v1.0 PRD 开发 MOCHU-OA 施工管理系统。

## Workflow
1. **领取任务**: 检查 `task.json`，领取状态为 `pending` 的任务。
2. **执行开发**: 基于 PRD 规范开发对应的模块。
3. **验证**: 执行单元测试或手动 curl 验证接口。
4. **记录**: 更新 `progress.txt`，将任务状态改为 `completed`。
5. **提交**: 执行 `git commit`。
6. **求助**: 遇阻碍时在 `progress.txt` 留存上下文并求助人类。

## Rules
- 严格遵循 PRD 中的审批流程编号。
- 模块必须包含权限控制中间件。
- 所有 API 必须符合 `code: 200/401/403` 规范。
