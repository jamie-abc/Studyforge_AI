# AI Token 计费系统实现说明

## 📋 概述

实现了基于真实 API 返回的 Token 使用情况的计费系统，完全符合硅基流动（SiliconFlow）等 OpenAI 兼容 API 的标准计费方式。

## ✨ 核心特性

1. **零侵入设计** - 不修改现有的 `SiliconFlowAiServiceImpl` 代码
2. **真实 Token 统计** - 直接从 API 响应的 `usage` 字段提取
3. **自动费用计算** - 根据模型价格配置自动计算每次调用的费用
4. **灵活扩展** - 支持多种模型和价格配置

## 🏗️ 架构设计

### 新增组件

#### 1. 数据库层
- **文件**: `sql/006_ai_token_pricing.sql`
- **功能**:
  - 为 `ai_logs` 表添加 token 统计字段
  - 创建 `ai_model_pricing` 价格配置表
  
**新增字段**:
- `model_name` - 使用的模型名称
- `prompt_tokens` - 输入 token 数
- `completion_tokens` - 输出 token 数
- `total_tokens` - 总 token 数
- `cost_yuan` - 费用（元）

**价格配置表**:
```sql
CREATE TABLE ai_model_pricing (
    id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    model_name VARCHAR(100) NOT NULL,
    input_price DECIMAL(10, 6) NOT NULL,   -- 输入价格（元/1K tokens）
    output_price DECIMAL(10, 6) NOT NULL,  -- 输出价格（元/1K tokens）
    effective_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
);
```

#### 2. 实体层
- **文件**: `studyforge-ai/src/main/java/com/studyforge/ai/entity/AiLog.java`
- **修改**: 添加 token 相关字段的 getter/setter

#### 3. 服务层（两个独立组件）

##### AiTokenBillingService
- **文件**: `studyforge-ai/src/main/java/com/studyforge/ai/service/AiTokenBillingService.java`
- **职责**: 
  - 调用 AI API 并获取完整响应（包含 usage 信息）
  - 从响应中提取文本内容
  - 提供当前使用的模型名称

##### AiTokenUsageLogger
- **文件**: `studyforge-ai/src/main/java/com/studyforge/ai/service/AiTokenUsageLogger.java`
- **职责**:
  - 解析 API 响应中的 usage 字段
  - 根据价格配置计算费用
  - 更新 ai_logs 表的 token 统计字段

#### 4. Controller 层
- **文件**: `studyforge-webapi/src/main/java/com/studyforge/webapi/ai/AiController.java`
- **修改**:
  - 注入 `AiTokenBillingService` 和 `AiTokenUsageLogger`
  - 修改各接口方法，使用计费服务调用 API
  - 在调用后记录 token 使用情况

## 💰 计费公式

```
费用 = (prompt_tokens / 1000) × input_price + (completion_tokens / 1000) × output_price
```

**示例**（DeepSeek-V4-Flash）:
- 输入价格：¥0.002 / 1K tokens
- 输出价格：¥0.008 / 1K tokens
- 如果 prompt_tokens=100, completion_tokens=200：
  ```
  费用 = (100/1000) × 0.002 + (200/1000) × 0.008
       = 0.0002 + 0.0016
       = ¥0.0018
  ```

## 📊 支持的模型及价格

| 模型名称 | 输入价格（元/1K） | 输出价格（元/1K） |
|---------|-----------------|-----------------|
| deepseek-ai/DeepSeek-V4-Flash | ¥0.002 | ¥0.008 |
| deepseek-ai/DeepSeek-V3 | ¥0.002 | ¥0.008 |
| deepseek-ai/DeepSeek-R1 | ¥0.004 | ¥0.016 |
| google/gemma-2-9b-it | ¥0.001 | ¥0.001 |
| meta-llama/Llama-3.3-70B-Instruct | ¥0.004 | ¥0.016 |
| Qwen/Qwen2.5-72B-Instruct | ¥0.004 | ¥0.016 |
| THUDM/glm-4-9b-chat | ¥0.001 | ¥0.001 |

## 🚀 部署步骤

### 1. 执行数据库脚本

```powershell
# 执行 token 计费配置脚本
Get-Content "sql\006_ai_token_pricing.sql" | mysql -u root -p12345 studyforge_ai

# 验证表结构
mysql -u root -p12345 studyforge_ai -e "DESCRIBE ai_logs;"
mysql -u root -p12345 studyforge_ai -e "SELECT * FROM ai_model_pricing;"
```

### 2. 重新编译项目

```bash
cd studyforge-server
mvn clean package -DskipTests
```

### 3. 重启应用

```powershell
# 停止现有服务
.\scripts\stop_api_maven.sh

# 启动服务
.\scripts\start_api_maven.sh
```

### 4. 测试功能

```powershell
# 执行测试脚本
Get-Content "sql\007_test_token_billing.sql" | mysql -u root -p12345 studyforge_ai
```

## 🔍 工作流程

```
用户请求 → AiController
    ↓
AiTokenBillingService.callApiWithUsage(prompt)
    ↓
调用硅基流动 API
    ↓
获取完整响应（包含 usage）
    ↓
提取文本内容 → 返回给用户
    ↓
AiTokenUsageLogger.logTokenUsage(logId, response, modelName)
    ↓
解析 usage 字段 → 计算费用 → 更新 ai_logs 表
```

## 📝 API 响应示例

```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "deepseek-ai/DeepSeek-V4-Flash",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "这是 AI 生成的内容..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 200,
    "total_tokens": 300
  }
}
```

## ⚠️ 注意事项

1. **向后兼容**: 旧的 ai_logs 记录 token 字段为 NULL，不影响查询
2. **错误处理**: Token 记录失败不会影响主流程，只记录错误日志
3. **性能影响**: 额外的数据库 UPDATE 操作，性能开销很小
4. **价格更新**: 可通过修改 `ai_model_pricing` 表来调整价格

## 🔧 维护指南

### 添加新模型价格

```sql
INSERT INTO ai_model_pricing (model_name, input_price, output_price, effective_date, status)
VALUES ('new-model-name', 0.003, 0.012, CURDATE(), 'ACTIVE');
```

### 查看费用统计

```sql
-- 总费用统计
SELECT 
    COUNT(*) AS total_calls,
    SUM(total_tokens) AS total_tokens,
    ROUND(SUM(cost_yuan), 4) AS total_cost
FROM ai_logs 
WHERE prompt_tokens IS NOT NULL;

-- 按模型分组
SELECT 
    model_name,
    COUNT(*) AS call_count,
    ROUND(SUM(cost_yuan), 4) AS total_cost
FROM ai_logs 
GROUP BY model_name;
```

### 清理旧数据

```sql
-- 删除 30 天前的记录
DELETE FROM ai_logs WHERE created_time < NOW() - INTERVAL 30 DAY;
```

## 🎯 优势总结

1. ✅ **完全不修改现有 AI Service 代码** - 符合您的要求
2. ✅ **基于真实 API 数据** - 准确可靠
3. ✅ **行业标准** - 符合 OpenAI/SiliconFlow 标准
4. ✅ **易于维护** - 独立组件，职责清晰
5. ✅ **灵活配置** - 支持多模型、多价格
6. ✅ **向后兼容** - 不影响现有功能

## 📞 技术支持

如有问题，请检查：
1. 数据库表结构是否正确
2. 价格配置是否存在
3. API 密钥是否有效
4. 日志中是否有错误信息
