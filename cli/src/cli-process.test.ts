import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cliEntrypoint = fileURLToPath(new URL("./index.js", import.meta.url));

test("CLI process writes help to stdout and exits successfully", async () => {
  const result = await execFileAsync(process.execPath, [cliEntrypoint, "--help"]);

  assert.match(result.stdout, /^Tsu CLI - create versioned project templates\./);
  assert.match(result.stdout, /tsu-cli init \[project-name\]/);
  assert.equal(result.stderr, "");
});

test("CLI process initializes a local project with stable stdout", async () => {
  const cwd = await mkdtemp(join(tmpdir(), "tsu-cli-process-"));

  try {
    const result = await execFileAsync(process.execPath, [cliEntrypoint, "init", "demo", "--local"], { cwd });

    assert.match(result.stdout, /^Created demo from default@\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?\nLocation: /);
    assert.match(result.stdout, /Next steps:\n  cd demo\n  pnpm dev\n$/);
    assert.equal(result.stderr, "");
    assert.match(await readFile(join(cwd, "demo", ".tsu", "template.json"), "utf8"), /"source": "local"/);
  } finally {
    await rm(cwd, { force: true, recursive: true });
  }
});

test("CLI process reports argument failures on stderr with exit code 2", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [cliEntrypoint, "init", "../outside", "--local"]),
    (error: unknown) => {
      assert.ok(error && typeof error === "object" && "code" in error && "stdout" in error && "stderr" in error);
      const result = error as { code: number; stdout: string; stderr: string };
      assert.equal(result.code, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^Invalid project name\./);
      return true;
    }
  );
});

test("CLI process reports execution failures on stderr with exit code 2", async () => {
  await assert.rejects(
    () => execFileAsync(process.execPath, [cliEntrypoint, "unknown-command"]),
    (error: unknown) => {
      assert.ok(error && typeof error === "object" && "code" in error && "stdout" in error && "stderr" in error);
      const result = error as { code: number; stdout: string; stderr: string };
      assert.equal(result.code, 2);
      assert.equal(result.stdout, "");
      assert.match(result.stderr, /^Unknown command: unknown-command\./);
      return true;
    }
  );
});
