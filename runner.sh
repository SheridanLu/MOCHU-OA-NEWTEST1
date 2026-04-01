#!/bin/bash
# runner.sh - 循环调度脚本
# Usage: ./runner.sh <次数>

COUNT=${1:-1}
for ((i=1; i<=COUNT; i++)); do
    echo "[RUNNER] 第 $i 次执行开发流程开始..."
    
    # 模拟 agent 领取任务及开发
    # 这里根据环境调用 sessions_spawn 启动任务
    echo "[RUNNER] 模拟 AI agent 开发流程..."
    # 真实执行请将以下内容替换为对 openclaw sub-agent 的实际调用
    node -e "console.log('Developing tasks based on task.json...')"
    
    # 记录日志
    echo "[$(date)] 任务已完成，第 $i 次运行结束" >> progress.txt
    
    # Git 提交
    git add .
    git commit -m "Auto-development cycle $i"
    
    echo "[RUNNER] 第 $i 次开发流程完成，已提交。"
done
