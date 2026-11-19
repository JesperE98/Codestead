// The port's .NET semantics (src/internal/dotnet.ts) against what .NET 10 prints and computes – the expected values
// were taken from a .NET 10 program (invariant culture). Not a C# test class: a check of the port itself.
import { describe, expect, it } from "vitest";
import { formatCustom, formatDouble, formatE, formatFixed, formatG, roundEven, shl32, sar64, notU32, toInt, toByte } from "../src/internal/dotnet.js";

describe("dotnet semantics", () => {
  it("formats numbers as .NET does (R, 0.###, G6, F6, e6, 0.000000)", () => {
    const cases: [number, string, string, string, string, string, string][] = [
      [-0.0001, "-0.0001", "-0", "-0.0001", "-0.000100", "-1.000000e-004", "-0.000100"],
      [-0.0, "-0", "-0", "-0", "-0.000000", "-0.000000e+000", "-0.000000"],
      [0.0005, "0.0005", "0.001", "0.0005", "0.000500", "5.000000e-004", "0.000500"],
      [1234567890123.4567, "1234567890123.4568", "1234567890123.46", "1.23457E+12", "1234567890123.456787", "1.234568e+012", "1234567890123.460000"],
      [3.4028234663852886e38, "3.4028234663852886E+38", "340282346638529000000000000000000000000", "3.40282E+38", "340282346638528859811704183484516925440.000000", "3.402823e+038", "340282346638529000000000000000000000000.000000"],
      [0.1 + 0.2, "0.30000000000000004", "0.3", "0.3", "0.300000", "3.000000e-001", "0.300000"],
      [-1.0005, "-1.0005", "-1.001", "-1.0005", "-1.000500", "-1.000500e+000", "-1.000500"],
      [1e21, "1E+21", "1000000000000000000000", "1E+21", "1000000000000000000000.000000", "1.000000e+021", "1000000000000000000000.000000"],
      [1e15, "1000000000000000", "1000000000000000", "1E+15", "1000000000000000.000000", "1.000000e+015", "1000000000000000.000000"],
      [1e-5, "1E-05", "0", "1E-05", "0.000010", "1.000000e-005", "0.000010"],
      [0.00012345, "0.00012345", "0", "0.00012345", "0.000123", "1.234500e-004", "0.000123"],
      [1.0005, "1.0005", "1.001", "1.0005", "1.000500", "1.000500e+000", "1.000500"],
      [999.9995, "999.9995", "1000", "1000", "999.999500", "9.999995e+002", "999.999500"],
    ];
    for (const [x, r, custom3, g6, f6, e6, custom6] of cases) {
      expect(formatDouble(x)).toBe(r);
      expect(formatCustom(x, 3, true)).toBe(custom3);
      expect(formatG(x, 6)).toBe(g6);
      expect(formatFixed(x, 6)).toBe(f6);
      expect(formatE(x, 6, false)).toBe(e6);
      expect(formatCustom(x, 6, false)).toBe(custom6);
    }
    expect([1e16, 1e17, 1.5e17, 2.5e-7].map(formatDouble)).toEqual(["10000000000000000", "1E+17", "1.5E+17", "2.5E-07"]);
  });

  it("rounds and converts as .NET does (Math.Round to even, saturating casts, 64-bit shifts)", () => {
    expect([0.5, 1.5, 2.5, -0.5, -1.5, -2.5, 2.4999].map(roundEven)).toEqual([0, 2, 2, -0, -2, -2, 2]);
    expect([Number.NaN, 1e10, -1e10, 2.9, -2.9].map(toInt)).toEqual([0, 2147483647, -2147483648, 2, -2]);
    expect([Number.NaN, 300, -1, 254.9].map(toByte)).toEqual([0, 255, 0, 254]);
    expect(shl32(1, 31)).toBe(2147483648);
    expect(shl32(1, 32)).toBe(0);
    expect(shl32(3, 65)).toBe(6);
    expect(sar64(-8, 1)).toBe(-4);
    expect(notU32(0)).toBe(4294967295);
  });
});
