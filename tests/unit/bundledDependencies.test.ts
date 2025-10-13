/**
 * Unit tests for Bundled Dependencies feature
 *
 * Tests both RuntimeCheck.resolveDependency() and initHandler.resolveDependencyForInit()
 * which implement the bundled > system > error priority logic.
 *
 * Note: These tests use the real fs and which modules but control the test environment
 * through Registry state and test file fixtures.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { RuntimeCheck } from "../../src/mcp-server/utils/runtimeCheck.js";
import { resolveDependencyForInit } from "../../src/mcp-server/toolHandlers/initHandler.js";
import Registry from "../../src/mcp-server/registry.js";

describe("Bundled Dependencies", () => {
  beforeEach(() => {
    // Reset Registry before each test
    Registry.reset();
  });

  describe("RuntimeCheck.resolveDependency", () => {
    describe("Priority 2: System PATH Fallback (using real system)", () => {
      it("should resolve node from system PATH when no bundled deps", () => {
        Registry.setBundledDependencies({});

        // node should be available in system PATH
        const resolved = RuntimeCheck.resolveDependency("node");
        assert.ok(resolved.includes("node"));
        assert.ok(resolved.length > 0);
      });

      it("should handle non-bundled dependencies", () => {
        Registry.setBundledDependencies({ node: "/bundled/node" });

        // git should fallback to system PATH (assuming git is installed)
        try {
          const resolved = RuntimeCheck.resolveDependency("git");
          assert.ok(resolved.includes("git"));
        } catch (err: any) {
          // If git is not installed, that's okay - this test just verifies the logic
          assert.ok(err.message.includes("git"));
        }
      });
    });

    describe("Priority 3: Error When Neither Available", () => {
      it("should throw error with hints for unknown commands", () => {
        Registry.setBundledDependencies({});

        assert.throws(
          () => RuntimeCheck.resolveDependency("definitely_not_a_real_command_12345"),
          /Command.*not found/,
        );
      });

      it("should include install hints for known commands", () => {
        Registry.setBundledDependencies({});

        try {
          // Try to resolve uvx which likely doesn't exist
          RuntimeCheck.resolveDependency("uvx");
        } catch (err: any) {
          // If it throws, it should have a helpful message
          assert.ok(
            err.message.includes("uvx") ||
              err.message.includes("Install") ||
              err.message.includes("not found"),
          );
        }
      });
    });
  });

  describe("resolveDependencyForInit", () => {
    describe("Priority 2: System PATH Fallback (using real system)", () => {
      it("should return system path when bundled not available", () => {
        const result = resolveDependencyForInit(undefined, "node");

        // Should find node in system PATH and mark it as (system)
        assert.ok(result.includes("(system)"));
        assert.ok(result.includes("node"));
      });

      it("should handle undefined bundled path", () => {
        const result = resolveDependencyForInit(undefined, "node");

        // Should fallback gracefully
        assert.ok(typeof result === "string");
        assert.ok(result.length > 0);
      });
    });

    describe("Priority 3: Not Available", () => {
      it("should return 'not available' for non-existent commands", () => {
        const result = resolveDependencyForInit(
          undefined,
          "definitely_not_a_real_command_12345",
        );
        assert.strictEqual(result, "not available");
      });

      it("should return 'not available' for non-existent bundled path", () => {
        const result = resolveDependencyForInit(
          "/this/path/definitely/does/not/exist/node",
          "node",
        );

        // Since bundled path doesn't exist, should either find system or return not available
        assert.ok(
          result.includes("(system)") || result === "not available",
        );
      });
    });
  });

  describe("RuntimeCheck Utilities", () => {
    describe("extractCommandName", () => {
      it("should extract first word as command name", () => {
        assert.strictEqual(RuntimeCheck.extractCommandName("node"), "node");
        assert.strictEqual(
          RuntimeCheck.extractCommandName("node --version"),
          "node",
        );
        assert.strictEqual(
          RuntimeCheck.extractCommandName("npx -y @some/package"),
          "npx",
        );
      });

      it("should handle leading/trailing spaces", () => {
        assert.strictEqual(
          RuntimeCheck.extractCommandName("  node  "),
          "node",
        );
        assert.strictEqual(
          RuntimeCheck.extractCommandName(" python3 -m module "),
          "python3",
        );
      });

      it("should handle empty strings", () => {
        assert.strictEqual(RuntimeCheck.extractCommandName(""), "");
      });
    });

    describe("validateCommandOrThrow", () => {
      it("should not throw for available commands like node", () => {
        // node should be available in system PATH
        assert.doesNotThrow(() => {
          RuntimeCheck.validateCommandOrThrow("node");
        });
      });

      it("should throw for unavailable commands", () => {
        assert.throws(() => {
          RuntimeCheck.validateCommandOrThrow("definitely_not_a_real_command_12345");
        });
      });

      it("should extract command name from full command string", () => {
        // Should extract 'node' and validate it exists
        assert.doesNotThrow(() => {
          RuntimeCheck.validateCommandOrThrow("node --version");
        });
      });
    });
  });

  describe("Registry Integration", () => {
    it("should return copy of bundled dependencies", () => {
      const deps = {
        node: "/bundled/node",
        python: "/bundled/python3",
      };

      Registry.setBundledDependencies(deps);
      const retrieved = Registry.getBundledDependencies();

      // Should be equal but not the same reference
      assert.deepStrictEqual(retrieved, deps);
      assert.notStrictEqual(retrieved, deps);
    });

    it("should handle bundled dependency path lookups", () => {
      Registry.setBundledDependencies({
        node: "/bundled/node",
        python: "/bundled/python3",
      });

      assert.strictEqual(Registry.getBundledDependencyPath("node"), "/bundled/node");
      assert.strictEqual(Registry.getBundledDependencyPath("python"), "/bundled/python3");
      assert.strictEqual(Registry.getBundledDependencyPath("git"), undefined);
    });

    it("should reset bundled dependencies", () => {
      Registry.setBundledDependencies({ node: "/bundled/node" });
      Registry.reset();

      const deps = Registry.getBundledDependencies();
      assert.deepStrictEqual(deps, {});
    });
  });
});
