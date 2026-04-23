import { describe, expect, it } from "vitest";

import {
  defaultLightThemeVariables,
  defaultDarkThemeVariables,
} from "../src/styles";

describe("Theme variable exports", (): void => {
  it("exports defaultLightThemeVariables", (): void => {
    expect(defaultLightThemeVariables).toBeDefined();
  });

  it("exports defaultDarkThemeVariables", (): void => {
    expect(defaultDarkThemeVariables).toBeDefined();
  });
});
