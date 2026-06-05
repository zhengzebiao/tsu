# @tsuz/utils

Small frontend utilities used by projects generated from Tsu templates.

The package is intentionally narrow. It contains utilities that support generated project workflows instead of trying to replace a general-purpose utility library.

## Install

```bash
pnpm add @tsuz/utils
```

## Usage

```ts
import { pick, sleep, toErrorMessage } from "@tsuz/utils/js";

const payload = pick({ id: 1, name: "Tsu", internal: true }, ["id", "name"]);

try {
  await sleep(250);
} catch (error) {
  console.error(toErrorMessage(error));
}
```

## API

| Export | Purpose |
| --- | --- |
| `isPlainObject(value)` | Checks whether a value is a plain object |
| `pick(source, keys)` | Creates an object with selected keys |
| `toErrorMessage(error)` | Converts unknown errors into displayable messages |
| `sleep(ms)` | Resolves after a delay, useful for demos, retries, and polling |

## In Tsu Templates

The Vue3 and React templates use `sleep` in the mock SDK adapter and `toErrorMessage` to render request failures in the generated dashboard starter page.
