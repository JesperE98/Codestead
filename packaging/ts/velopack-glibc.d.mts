// Types of velopack-glibc.mjs (for ts/packages/ui/test/VelopackGlibcTests.test.ts).
export declare const OPTIONAL_GLIBC: string;
export declare const NEWEST_REQUIRED_GLIBC: string;
export declare function elfHash(name: string): number;
export interface VersionNeed {
  file: string;
  name: string;
  hash: number;
  flagsOffset: number;
  flags: number;
  index: number;
  symbols: { name: string; weak: boolean }[];
}
export declare function readVersionNeeds(b: Buffer): VersionNeed[];
export declare function makeGlibcNeedOptional(b: Buffer): { version: string; symbols: string[]; changed: boolean };
export declare function makeGlibcNeedOptionalInFile(file: string): { version: string; symbols: string[]; changed: boolean };
