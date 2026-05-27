# 模板发布与证书配置说明

这是一份压缩版操作说明，覆盖两件事：

1. 通过 GitHub Release 发布 `tsu-cli` 模板
2. 解决 Node 在 Windows 下访问 GitHub 时的证书校验问题

## 一、发布流程

模板不是直接发源码仓库，而是发 GitHub Release asset：

- tag：`template-v<version>`
- asset：`tsu-templates-v<version>.tar.gz`
- 不传 `--version`：CLI 使用最新 Release
- `--version 1.0.3`：CLI 使用 `template-v1.0.3`

触发发布：

```bash
git tag template-v1.0.3
git push origin template-v1.0.3
```

GitHub Actions 会自动构建并上传 asset。

发布后验证：

```bash
node cli/dist/index.js init verify-default --template default --version 1.0.3 --cwd ./tmp-verify
node cli/dist/index.js init verify-monorepo --template monorepo --version 1.0.3 --cwd ./tmp-verify
```

期望输出：

```text
Created verify-default from default@1.0.3 at ...
Created verify-monorepo from monorepo@1.0.3 at ...
```

## 二、Node 证书报错处理

如果 CLI 报错：

```text
fetch failed
UNABLE_TO_VERIFY_LEAF_SIGNATURE
unable to verify the first certificate
```

说明 Node 不信任当前环境的证书链。

这时要导出的是 **CA 证书**，不是 `github.com` 的叶子证书。

错误证书通常会显示：

```text
subject=CN=github.com
CA:FALSE
```

正确的证书应满足：

```text
CA:TRUE
```

### Windows 导出步骤

1. 用 Edge 或 Chrome 打开 `https://api.github.com`
2. 点地址栏左侧小锁
3. 打开证书详情
4. 进入 **证书路径**
5. 选最上层 CA 证书，不要选 `github.com`
6. 导出为 **Base-64 encoded X.509 (.CER)**
7. 保存为例如：

```text
C:\certs\github.pem
```

文件名不重要，内容才重要。

### 配置 Node

PowerShell：

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\certs\github.pem"
```

cmd：

```cmd
set NODE_EXTRA_CA_CERTS=C:\certs\github.pem
```

验证：

```bash
node -e "require('node:https').get('https://api.github.com',{headers:{'User-Agent':'test'}},r=>{console.log(r.statusCode);r.resume()}).on('error',e=>{console.error(e.code,e.message)})"
```

期望结果：

```text
200
```

## 三、已验证状态

已验证通过：

- `template-v1.0.3`
- `tsu-templates-v1.0.3.tar.gz`
- `default` 模板远程初始化
- `monorepo` 模板远程初始化
