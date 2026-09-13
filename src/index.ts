import * as core from "@actions/core";
import { run } from "./run";

try {
  await run();
} catch (error) {
  core.setFailed(
    error instanceof Error ? error.message : JSON.stringify(error),
  );
}
