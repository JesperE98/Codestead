/** A graphics API: its id, its short name ("DirectX 12"), its full name ("Direct3D 12") and its shading language. */
export class ApiInfo {
  constructor(readonly id: string, readonly name: string, readonly fullName: string, readonly shadingLanguage: string) {}
}
