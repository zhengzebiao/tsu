import assert from "node:assert/strict";
import test from "node:test";

import { EmptyState as ReactEmptyState, ErrorState as ReactErrorState, LoadingState as ReactLoadingState, PageContainer as ReactPageContainer, reactComponentPreset } from "../dist/react/index.js";
import { EmptyState as VueEmptyState, ErrorState as VueErrorState, LoadingState as VueLoadingState, PageContainer as VuePageContainer, vueComponentPreset } from "../dist/vue/index.js";

test("exports Vue component primitives", () => {
  assert.equal(vueComponentPreset.framework, "vue");
  assert.equal(VuePageContainer.name, "TsuPageContainer");
  assert.equal(VueEmptyState.name, "TsuEmptyState");
  assert.equal(VueLoadingState.name, "TsuLoadingState");
  assert.equal(VueErrorState.name, "TsuErrorState");
});

test("exports React component primitives", () => {
  assert.equal(reactComponentPreset.framework, "react");
  assert.equal(typeof ReactPageContainer, "function");
  assert.equal(typeof ReactEmptyState, "function");
  assert.equal(typeof ReactLoadingState, "function");
  assert.equal(typeof ReactErrorState, "function");
});
