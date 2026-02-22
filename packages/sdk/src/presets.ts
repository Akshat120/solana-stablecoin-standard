import { StablecoinConfig, Preset } from "./types";

export { Preset };

export const Presets = {
  SSS_1: Preset.SSS_1,
  SSS_2: Preset.SSS_2,
};

/**
 * Returns the default config for a given preset
 */
export function getPresetConfig(preset: Preset): Partial<StablecoinConfig> {
  switch (preset) {
    case Preset.SSS_1:
      // SSS-1: Minimal stablecoin - mint authority + freeze authority + metadata
      return {
        decimals: 6,
        enableCompliance: false,
        enablePermanentDelegate: false,
        enableTransferHook: false,
        defaultAccountFrozen: false,
      };

    case Preset.SSS_2:
      // SSS-2: Compliant stablecoin - SSS-1 + permanent delegate + transfer hook + blacklist
      return {
        decimals: 6,
        enableCompliance: true,
        enablePermanentDelegate: true,
        enableTransferHook: true,
        defaultAccountFrozen: true,
      };

    default:
      throw new Error(`Unknown preset: ${preset}`);
  }
}

/**
 * Merge preset config with user-provided config
 */
export function mergeWithPreset(
  preset: Preset,
  userConfig: Partial<StablecoinConfig>
): Partial<StablecoinConfig> {
  const presetConfig = getPresetConfig(preset);
  return {
    ...presetConfig,
    ...userConfig,
  };
}
