# Template Release and Certificate Setup

Quick guide for publishing `tsu-cli` templates through GitHub Release assets and fixing Node TLS certificate errors on Windows.

## Release flow

Template releases use GitHub Release assets:

- tag: `template-v<version>`
- asset: `tsu-templates-v<version>.tar.gz`
- no `--version`: CLI uses the latest GitHub Release
- `--version 1.0.3`: CLI uses `template-v1.0.3`

Trigger publish:

```bash
git tag template-v1.0.3
git push origin template-v1.0.3
```

The GitHub Actions workflow builds and uploads the asset automatically.

Build and validate the template archive before publishing:

```bash
pnpm template:release:build --version=1.0.3
TEMPLATE_VERSION=1.0.3 pnpm validate:template-release
```

`validate:template-release` checks the real `tsu-templates-v<version>.tar.gz` archive, manifest metadata, bundle contents, generated `mfe-main` / `mfe-app` projects, MFE deploy workflow markers, Python deploy/rollback/migration artifacts (`deploy.yml`, `migrate.yml`, `docker-compose.deploy.yml`, `docker-compose.infra.yml`, `.env.deploy.example`), Python production hardening markers (post-deploy health, smoke, backup checklist, observability, rollback playbook), README documentation markers, generated-project install/lint/format/test/build/E2E gates, and host + sub-app integration E2E. It does not publish a GitHub Release, push registry images, or SSH to a server.

Verify remote initialization after the Release exists:

```bash
node cli/dist/index.js init verify-default --template default --version 1.0.3 --cwd ./tmp-verify
node cli/dist/index.js init verify-monorepo --template monorepo --version 1.0.3 --cwd ./tmp-verify
node cli/dist/index.js init verify-mfe-main --template mfe-main --version 1.0.3 --cwd ./tmp-verify
node cli/dist/index.js init verify-mfe-app --template mfe-app --version 1.0.3 --cwd ./tmp-verify
```

Expected output:

```text
Created verify-default from default@1.0.3 at ...
Created verify-monorepo from monorepo@1.0.3 at ...
Created verify-mfe-main from mfe-main@1.0.3 at ...
Created verify-mfe-app from mfe-app@1.0.3 at ...
```

## Node TLS certificate fix

If Node/CLI fails with:

```text
fetch failed
UNABLE_TO_VERIFY_LEAF_SIGNATURE
unable to verify the first certificate
```

export the **CA certificate** used by your proxy/tool, not the `github.com` leaf certificate.

A wrong certificate usually looks like:

```text
subject=CN=github.com
CA:FALSE
```

A usable CA certificate must have:

```text
CA:TRUE
```

### Export on Windows

1. Open `https://api.github.com` in Edge or Chrome.
2. Open the certificate details from the lock icon.
3. Go to **Certification Path**.
4. Select the top CA certificate, not `github.com`.
5. Export it as **Base-64 encoded X.509 (.CER)**.
6. Save it, for example:

```text
C:\certs\github.pem
```

The file name does not matter; the certificate contents do.

### Configure Node

PowerShell:

```powershell
$env:NODE_EXTRA_CA_CERTS="C:\certs\github.pem"
```

cmd:

```cmd
set NODE_EXTRA_CA_CERTS=C:\certs\github.pem
```

Verify:

```bash
node -e "require('node:https').get('https://api.github.com',{headers:{'User-Agent':'test'}},r=>{console.log(r.statusCode);r.resume()}).on('error',e=>{console.error(e.code,e.message)})"
```

Expected:

```text
200
```

## Verified state

Verified successfully with:

- `template-v1.0.3`
- `tsu-templates-v1.0.3.tar.gz`
- `default` template remote init
- `monorepo` template remote init
- `mfe-main` template remote init and release archive validation
- `mfe-app` template remote init and release archive validation
