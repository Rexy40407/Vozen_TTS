// scripts/logRotation.d.mts — tipos para o import em tests/logRotation.test.ts.
export interface RotatingWriter {
  write(chunk: string | Buffer): void;
  readonly currentFile: string;
  readonly rotatedFile: string;
}
export declare function makeRotatingWriter(
  dir: string,
  fileName: string,
  maxBytes: number,
): RotatingWriter;
