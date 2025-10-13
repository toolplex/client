/**
 * Unit tests for Registry - Bundled Dependencies Storage
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import Registry from "../../src/mcp-server/registry.js";
import type { BundledDependencies } from "../../src/shared/mcpServerTypes.js";

describe("Registry - Bundled Dependencies", () => {
  beforeEach(() => {
    // Reset Registry before each test
    Registry.reset();
  });

  describe("setBundledDependencies", () => {
    it("should store bundled dependencies", () => {
      const deps: BundledDependencies = {
        node: "/bundled/node",
        python: "/bundled/python3",
        git: "/bundled/git",
      };

      Registry.setBundledDependencies(deps);

      const stored = Registry.getBundledDependencies();
      assert.deepStrictEqual(stored, deps);
    });

    it("should handle empty dependencies object", () => {
      const deps: BundledDependencies = {};

      Registry.setBundledDependencies(deps);

      const stored = Registry.getBundledDependencies();
      assert.deepStrictEqual(stored, {});
    });

    it("should handle partial dependencies", () => {
      const deps: BundledDependencies = {
        node: "/bundled/node",
        // python, git, etc. not provided
      };

      Registry.setBundledDependencies(deps);

      const stored = Registry.getBundledDependencies();
      assert.strictEqual(stored.node, "/bundled/node");
      assert.strictEqual(stored.python, undefined);
      assert.strictEqual(stored.git, undefined);
    });

    it("should overwrite existing dependencies", () => {
      // Set initial deps
      Registry.setBundledDependencies({
        node: "/bundled/node",
      });

      // Overwrite with new deps
      Registry.setBundledDependencies({
        node: "/new/bundled/node",
        python: "/bundled/python",
      });

      const stored = Registry.getBundledDependencies();
      assert.strictEqual(stored.node, "/new/bundled/node");
      assert.strictEqual(stored.python, "/bundled/python");
    });

    it("should handle all dependency types", () => {
      const deps: BundledDependencies = {
        node: "/bundled/node",
        python: "/bundled/python3",
        git: "/bundled/git",
        npx: "/bundled/npx",
        uvx: "/bundled/uvx",
      };

      Registry.setBundledDependencies(deps);

      const stored = Registry.getBundledDependencies();
      assert.strictEqual(stored.node, "/bundled/node");
      assert.strictEqual(stored.python, "/bundled/python3");
      assert.strictEqual(stored.git, "/bundled/git");
      assert.strictEqual(stored.npx, "/bundled/npx");
      assert.strictEqual(stored.uvx, "/bundled/uvx");
    });
  });

  describe("getBundledDependencies", () => {
    it("should return empty object when no dependencies set", () => {
      const deps = Registry.getBundledDependencies();
      assert.deepStrictEqual(deps, {});
    });

    it("should return all stored dependencies", () => {
      const originalDeps: BundledDependencies = {
        node: "/bundled/node",
        python: "/bundled/python3",
        git: "/bundled/git",
      };

      Registry.setBundledDependencies(originalDeps);

      const retrieved = Registry.getBundledDependencies();
      assert.deepStrictEqual(retrieved, originalDeps);
    });

    it("should return a copy, not reference", () => {
      const originalDeps: BundledDependencies = {
        node: "/bundled/node",
      };

      Registry.setBundledDependencies(originalDeps);

      const retrieved = Registry.getBundledDependencies();

      // Mutate retrieved object
      (retrieved as any).node = "/modified/node";

      // Original in Registry should be unchanged
      const again = Registry.getBundledDependencies();
      assert.strictEqual(again.node, "/bundled/node");
    });
  });

  describe("getBundledDependencyPath", () => {
    beforeEach(() => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
        python: "/bundled/python3",
        git: "/bundled/git",
        npx: "/bundled/npx",
        uvx: "/bundled/uvx",
      });
    });

    it("should retrieve individual dependency paths", () => {
      assert.strictEqual(
        Registry.getBundledDependencyPath("node"),
        "/bundled/node",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("python"),
        "/bundled/python3",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("git"),
        "/bundled/git",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("npx"),
        "/bundled/npx",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("uvx"),
        "/bundled/uvx",
      );
    });

    it("should return undefined for unset dependencies", () => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
      });

      assert.strictEqual(Registry.getBundledDependencyPath("python"), undefined);
      assert.strictEqual(Registry.getBundledDependencyPath("git"), undefined);
    });

    it("should return undefined when no dependencies set", () => {
      Registry.setBundledDependencies({});

      assert.strictEqual(Registry.getBundledDependencyPath("node"), undefined);
    });
  });

  describe("reset", () => {
    it("should clear bundled dependencies", () => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
        python: "/bundled/python3",
      });

      Registry.reset();

      const deps = Registry.getBundledDependencies();
      assert.deepStrictEqual(deps, {});
    });

    it("should allow setting new dependencies after reset", () => {
      // Set initial
      Registry.setBundledDependencies({
        node: "/bundled/node",
      });

      // Reset
      Registry.reset();

      // Set new
      Registry.setBundledDependencies({
        python: "/new/python",
      });

      const deps = Registry.getBundledDependencies();
      assert.strictEqual(deps.node, undefined);
      assert.strictEqual(deps.python, "/new/python");
    });
  });

  describe("Edge Cases", () => {
    it("should handle undefined values in dependencies", () => {
      const deps: BundledDependencies = {
        node: "/bundled/node",
        python: undefined,
      };

      Registry.setBundledDependencies(deps);

      assert.strictEqual(Registry.getBundledDependencyPath("node"), "/bundled/node");
      assert.strictEqual(Registry.getBundledDependencyPath("python"), undefined);
    });

    it("should handle empty string paths", () => {
      const deps: BundledDependencies = {
        node: "",
      };

      Registry.setBundledDependencies(deps);

      assert.strictEqual(Registry.getBundledDependencyPath("node"), "");
    });

    it("should handle Windows-style paths", () => {
      const deps: BundledDependencies = {
        node: "C:\\Program Files\\Node\\node.exe",
        python: "C:\\Python39\\python.exe",
      };

      Registry.setBundledDependencies(deps);

      assert.strictEqual(
        Registry.getBundledDependencyPath("node"),
        "C:\\Program Files\\Node\\node.exe",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("python"),
        "C:\\Python39\\python.exe",
      );
    });

    it("should handle Unix-style paths", () => {
      const deps: BundledDependencies = {
        node: "/usr/local/bin/node",
        python: "/usr/bin/python3",
      };

      Registry.setBundledDependencies(deps);

      assert.strictEqual(
        Registry.getBundledDependencyPath("node"),
        "/usr/local/bin/node",
      );
      assert.strictEqual(
        Registry.getBundledDependencyPath("python"),
        "/usr/bin/python3",
      );
    });
  });

  describe("Integration with other Registry methods", () => {
    it("should persist bundled deps through reset", () => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
      });

      // Reset should clear bundled deps
      Registry.reset();

      const deps = Registry.getBundledDependencies();
      assert.deepStrictEqual(deps, {});
    });

    it("should not affect bundled deps when accessing other Registry methods", () => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
      });

      // Access other methods (these would throw if Registry not initialized, but shouldn't affect bundled deps)
      try {
        Registry.getClientContext();
      } catch (e) {
        // Expected to throw since Registry not fully initialized
      }

      // Bundled deps should still be accessible
      const deps = Registry.getBundledDependencies();
      assert.strictEqual(deps.node, "/bundled/node");
    });
  });
});
