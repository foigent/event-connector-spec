# Foigent Event & Connector Specification

[English](README.md) · [贡献指南（英文）](../docs/COMMUNITY.md) · [许可证](../LICENSE)

本仓库定义 UniRouter、X-Insight 及参考集成共用的事件与 Connector 合同，
包含 Schema、规范化测试向量、Go／TypeScript 实现、兼容映射和发布校验工具。
各产品保留自己的运行时和业务逻辑。

它帮助 Connector 实现者核对身份、规范化字节、来源信息、错误和重放行为。
一致性通过不代表某个部署已验收，也不证明模型回答或业务任务正确。

## 运行消费者校验

准备 Go 1.24.3、Deno 2.7.13、Node.js 和 Python 3。仓库公开后执行：

```sh
git clone https://github.com/foigent/event-connector-spec.git
cd event-connector-spec
./scripts/run-source-neutral-v2-consumer-kit.sh "$PWD" "$(mktemp -d)/consumer" --release
```

校验使用本地样例和已随仓库保存的 Go 依赖，不需要产品仓库、数据库、
模型密钥或真实调用。UR 当前消费协议 `2.0.2`，保留 v1 `1.1.2` 兼容。
精确合同由[发布 manifest](../releases/v2.0.2/release-manifest.json)及消费者 pin 决定。

原[权威说明](../README.md)已被发布摘要绑定，其中候选状态文字保留历史含义。
新的社区首页不修改这些固定字节。语义变更继续遵循原[治理规则](../GOVERNANCE.md)
与[协议贡献要求](../CONTRIBUTING.md)。

英文是第一语言，中文是第二语言；参与方式见[社区指南](../docs/COMMUNITY.md)。
项目自有内容使用 Apache-2.0，第三方许可保留，详见[许可说明](../docs/LICENSING.md)。
本分支仍处于开源准备阶段，不代表仓库已经公开，也没有改变协议、历史版本或产品运行时。
