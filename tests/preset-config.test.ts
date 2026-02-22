import { expect } from "chai";
import { Preset, getPresetConfig, mergeWithPreset } from "../packages/sdk/src/presets";

describe("Preset Configuration", () => {
  describe("SSS-1 preset", () => {
    it("returns correct defaults for SSS-1", () => {
      const config = getPresetConfig(Preset.SSS_1);
      expect(config.decimals).to.equal(6);
      expect(config.enableCompliance).to.equal(false);
      expect(config.enablePermanentDelegate).to.equal(false);
      expect(config.enableTransferHook).to.equal(false);
      expect(config.defaultAccountFrozen).to.equal(false);
    });

    it("has all required fields", () => {
      const config = getPresetConfig(Preset.SSS_1);
      expect(config).to.have.property("decimals");
      expect(config).to.have.property("enableCompliance");
      expect(config).to.have.property("enablePermanentDelegate");
      expect(config).to.have.property("enableTransferHook");
      expect(config).to.have.property("defaultAccountFrozen");
    });
  });

  describe("SSS-2 preset", () => {
    it("returns correct defaults for SSS-2", () => {
      const config = getPresetConfig(Preset.SSS_2);
      expect(config.decimals).to.equal(6);
      expect(config.enableCompliance).to.equal(true);
      expect(config.enablePermanentDelegate).to.equal(true);
      expect(config.enableTransferHook).to.equal(true);
      expect(config.defaultAccountFrozen).to.equal(true);
    });

    it("enables all compliance features", () => {
      const config = getPresetConfig(Preset.SSS_2);
      expect(config.enableCompliance).to.equal(true);
      expect(config.enablePermanentDelegate).to.equal(true);
    });
  });

  describe("mergeWithPreset", () => {
    it("overrides preset defaults with user config", () => {
      const merged = mergeWithPreset(Preset.SSS_2, {
        decimals: 8,
        enableTransferHook: false,
      });
      expect(merged.decimals).to.equal(8);
      expect(merged.enableTransferHook).to.equal(false);
      // non-overridden defaults remain
      expect(merged.enableCompliance).to.equal(true);
      expect(merged.enablePermanentDelegate).to.equal(true);
    });

    it("SSS-1 merge preserves non-compliance defaults", () => {
      const merged = mergeWithPreset(Preset.SSS_1, {
        decimals: 9,
      });
      expect(merged.decimals).to.equal(9);
      expect(merged.enableCompliance).to.equal(false);
      expect(merged.enablePermanentDelegate).to.equal(false);
    });

    it("rejects unknown preset", () => {
      expect(() => getPresetConfig("sss-99" as any)).to.throw("Unknown preset");
    });
  });

  describe("Preset enum values", () => {
    it("has correct string values", () => {
      expect(Preset.SSS_1).to.equal("sss-1");
      expect(Preset.SSS_2).to.equal("sss-2");
    });
  });
});
