// Types of deb-xz.mjs (for ts/packages/ui/test/PackagingTests.test.ts).
export interface ArMember {
  name: string;
  header: Buffer;
  data: Buffer;
}
export declare function readAr(b: Buffer): ArMember[];
export declare function writeAr(members: ArMember[]): Buffer;
export declare function debWithXzData(deb: Buffer, compress: (data: Buffer) => Buffer): Buffer;
