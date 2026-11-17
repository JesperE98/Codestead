/** A product's name, id, version and releases repository (build/Codestead.props in the C# apps). */
export interface ProductMeta {
  readonly name: string;
  readonly id: string;
  readonly releasesRepo: string;
  readonly version: string;
}
