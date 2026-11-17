# Porting a reader of Codestead.GP.Gpu to TypeScript

Wave 1 ported the core of the simulated GPU (`src/GP/Codestead.GP.Gpu` except the per-API readers) to this package. Wave 2
ports the three readers – OpenGL, Vulkan, Direct3D 12 – into the same package, in parallel. This file tells you what is
already here, the conventions the port follows and how to plug a reader in. Read `docs/TYPESCRIPT-MIGRATION.md` and the
brief first.

## What is yours

| Reader | C# files (src/GP/Codestead.GP.Gpu/Readers/) | Port to (src/Readers/) |
|---|---|---|
| OpenGL | `GlReader.cs`, `GlReader.*.cs` (Advanced, Calls, Debug, Draw, Dsa, Frames, Textures), `GlState.cs`, `CppStatement.cs`, `CppStatements.cs` | `GlReader*.ts`, `GlState.ts`, `CppStatement.ts`, `CppStatements.ts` |
| Vulkan | `VulkanReader*.cs` (Device, Frame, Pipelines), `VulkanDevice*.cs` (Compute, Debug, Memory) | `VulkanReader*.ts`, `VulkanDevice*.ts` |
| Direct3D 12 | `D3D12Reader*.cs` (Draw, Pipelines), `D3D12Device*.cs` (Compute, Debug, Pipelines) | `D3D12Reader*.ts`, `D3D12Device*.ts` |

`CppStatement(s)` are only used by the OpenGL reader, so they are the OpenGL agent's. Everything else under `Readers/`
is shared and already ported – do not change its behaviour; if you find a bug in it, fix it in a separate, small commit
and say so in your report (the other two reader agents use it too).

## Plugging a reader in

C#'s `Simulator.Read` calls `GlReader.Read`, `VulkanReader.Read`, `D3D12Reader.Read` directly. The core must compile
without the readers, so the port has a registry (`src/Readers/ReaderRegistry.ts`). At the end of your reader's main
module:

```ts
registerReader(Apis.OpenGL, (project, time) => GlReader.read(project, time));
```

and in `src/index.ts` replace the comment line for your reader with `import "./Readers/GlReader.js";` plus the exports
the next waves need (`export { GlReader } from "./Readers/GlReader.js";`). Those are the only lines of shared files you
touch (three agents add one line each there – expect a trivial merge).

`GlReader.SpacePressFrame` / `SpaceReleaseFrame` live in `src/Readers/FrameConstants.ts` (GameFrames needs them and must
not import the GL reader); give `GlReader` static members that return them.

## Tests

`test/SimulatorTests.test.ts` holds `it.todo`s for `SimulatorTests.cs`: they build finished course projects with
`GpCourse` (the gp-course package, which depends on this one), so they belong where both are available – the gp-course
agent (or whoever ports `GpCourse`) should port them there and delete the todos here. `TaskTests`, `PictureTests` and
`ContentTests` (tests/GP/Codestead.GP.Tests) run the readers over every task and exercise: they are the real proof of a
reader, and they belong to gp-course too. Until then, test your reader the way wave 1 tested the core (below).

## Conventions of the port (follow them, the shared code does)

* **One file per C# file**, same folder layout, the same names in camelCase (members) and PascalCase (types). A C#
  partial class split over several files (`GlReader.Calls.cs` …) can be one class in `GlReader.ts` with the other parts
  as modules of functions that take the reader (`export function calls(r: GlReader, …)`): mark the members they need
  `/** @internal */` instead of `private`. Keep the doc comments.
* **Records** are classes with `readonly` fields and a constructor in the record's parameter order; optional parameters
  and `init` properties go in a trailing options object (`new RenderTarget(id, { width: 512, float: true })`,
  `new DrawCall({ vertexShader, fragmentShader, … })`, `new RecordedDraw(indexed, count, …, { stencilRef, bound })`).
  `record with { … }` is a `with({ … })` method where one is needed (`Image.with`, `StbImage.with`, `ClearOp.with`,
  `BlendState.with`, `DrawCall.with`). Value equality is explicit (`BlendState.equals`, `StencilState.equals`,
  `SamplerState.equals`): never compare records with `===` where C# uses `==`.
* **Enums** are TypeScript enums with the C# members in the same order (`Topology.Triangles`, `CompareFunc.Less`).
* **Dictionaries** are `Map`s (insertion order = C#'s enumeration order when nothing is removed); `HashSet` is `Set`.
  `SortedDictionary<double, …>` is `SortedMap` (src/Shading/SortedMap.ts).
* **Bytes** are `Uint8Array` (project assets, image RGBA). Doubles are numbers; `double[]` is `number[]` (Framebuffer
  uses `Float64Array`).
* **Names that are reserved words** got a suffix: `ShaderAst.Call.function_`, `If.else_`, `Conditional.else_`,
  `Field.default_`, `Parameter.default_`.
* **Exceptions**: C# catches `ShaderRuntimeException` / `ShaderSyntaxException` by type – do the same with `instanceof`
  and rethrow everything else (`catch (e) { if (!(e instanceof ShaderRuntimeException)) throw e; … }`). A C# `when
  (Lenient)` filter is part of that condition.

## .NET semantics: use src/internal/dotnet.ts and src/internal/regex.ts

The pictures are compared pixel by pixel, so the port computes exactly what C# computes. The helpers:

| C# | TypeScript |
|---|---|
| `Math.Round(x)` (to even!) | `roundEven(x)` |
| `(int)x`, `(uint)x`, `(long)x`, `(byte)x` of a double (saturating since .NET 9, NaN → 0) | `toInt`, `toUint`, `toLong` / `toLongBig`, `toByte` |
| `(byte)Math.Round(Math.Clamp(v, 0, 1) * 255)` | `toByte(roundEven(clamp(v, 0, 1) * 255))` |
| int division `a / b` | `Math.trunc(a / b)` (or `idiv`) |
| `Math.Clamp`, `Math.Sign` | `clamp` (NaN passes, min > max throws), `sign` (NaN throws) |
| `long` `&` `\|` `^` `<<` `>>` `~` | `and64`, `or64`, `xor64`, `shl32` (the runner's `(uint)(x << y)`), `sar64`, `notU32` |
| `double.Parse` / `TryParse`, `int.Parse` / `TryParse` (invariant) | `parseDouble`, `tryParseDouble`, `parseInt32`, `tryParseInt` |
| `x.ToString()` / `"R"` | `formatDouble` |
| `"0.###"`, `"0.000000"` (custom formats round to 15 digits first!) | `formatCustom(x, 3, true)`, `formatCustom(x, 6, false)` |
| `"F6"`, `"G6"`, `"e6"`, `long.ToString("x")` | `formatFixed`, `formatG`, `formatE`, `hex64` |
| `char.IsLetter` / `IsDigit` / `IsLetterOrDigit` / `IsUpper` / `IsWhiteSpace`, `string.Trim()` | `isLetter`, `isDigit`, `isLetterOrDigit`, `isUpper`, `isWhiteSpace`, `trimNet` |
| `Split(c, RemoveEmptyEntries)`, `Trim(chars)` | `splitNoEmpty`, `trimChars` |
| `Regex.Escape`, `Regex.Matches`, `Regex.Match(s, startat)`, `Regex.Unescape` | `escapeRegex`, `matchesAll`, `matchFrom`, `regexUnescape` |

Regular expressions: the C# patterns translate to JavaScript as written (lookbehind, named groups `(?<n>…)` →
`m.groups.n`), with three differences to watch: JavaScript's `\w`/`\d` are ASCII; `.` also stops at `\r` (write
`[^\n]` where the text may hold one); `$` without the `m` flag matches only at the very end (.NET also before a final
`\n`). `RegexOptions.Singleline` is the `s` flag, `Multiline` the `m` flag. A `Regex.Replace` replacement string with `$`
in it is a pattern in both – pass a function when the replacement is data.

LINQ: `OrderBy` is stable and so is `Array.prototype.sort`; C#'s `List.Sort` / `Array.Sort` are **not** stable – if a
reader sorts with them and keys can tie, check which order C# really produces. `Sum` adds left to right from 0.
`Distinct`/`Union` keep first-seen order (`[...new Set(…)]`). `FirstOrDefault` of a tuple gives a default tuple, not
null – check what the C# code does with it.

Maths: `Math.Sin`, `Pow`, `Exp`, `Log2` … are the C runtime's in .NET and V8's own in JavaScript; they can differ in the
last bit. The core's frames matched C# byte for byte over every course shader (below); if a reader's picture is off by
one in a pixel, suspect this first.

## The shared API you will use (C# → TypeScript)

* `GpuProject`: `files` / `assets` (Maps), `find`, `findAsset`, `pathOf`, `mainText()`, `mainFile`, `cppFiles`, `clone()`.
* `CppSource`: `code`, `text`, `fileName`, `lineAt`, `calls(name, from?, to?)` (→ `CppCall` with `arg(i)`), `hasCall`,
  `functions` (Map name → `{ start, end }`), `functionBody`, `expandedBody`, `expandMacros`, `functionAt`,
  `stringValue`, `overloadsOf`, `chooseOverload`, `parametersOf` (→ `Parameter { name, ref, default_, type }`),
  `callsApi`, `isPureLoop`, `passesDeltaTime`, **`callsFunction(caller, callee)`** (C#'s `Calls(string, string)`
  overload), `initializer`, `statementEnd`, `declaredType`, `fieldAssignments` (→ `{ target, field, value, offset }`),
  `fieldValueBefore`, `lastFieldValue`, `uses`, `evaluate`, `numbers`, `int`, `usedTime`, `extra`; statics
  `blankComments`, `matchBracket`, `splitArgs`, `stringArg`, `prepare`.
* `CppExec`: `runner`, `getters`, `addGetters`, `apiValue`, `tryEval`, `run`, `runFunction`, `eval`, `int`, `numbers`,
  static `flatten(v, into, rowMajor)`. Its hook type is `CppHook` = `(name, args: Expr[]) => ShaderValue | null`.
* `FrameRecorder(src, time, scene, blocks, transposeMatrices, device?, project?)` – C#'s init-only `Project` is the last
  constructor argument. `draws` (`RecordedDraw`), `setupDraws`, `setupOps`, `runner`, `run`, `setup`, `skip`,
  `onPollEvents`, `runCode`, `bufferContents()`.
* `IDeviceModel` (`attach`, `hook`, `snapshot`, `ops`, `offscreen`, `drawCount`), `GameFrames` (`lastFrame`, `runGlfw`,
  `runWin32`), `PipelineInfo(name, vs, fs, vsEntry, fsEntry, cull, frontCcw, wireframe, depthTest, topology, { state,
  gs, gsEntry, tcs, tes, tcsEntry, tesEntry, patchPoints })` and `PipelineInfo.merged`, `PipelineState.vulkan` /
  `.d3d12` (→ `Fixed`), `DrawTextures` (`any`, `vulkanSet`, `d3d12Slot`, `slotImage`, `hasSlots`), `TextureBinding`
  (`shaderTextures`, `bind`, `fromFields`), `StbImage` (`load`, `byte`, `fileChannels`, `decode`, `all`, `inLoadOrder`,
  `wrapOf`), `StructLayout` (`fields` → `{ type, name, floats }`, `defaults` → Map, `floatsOf`), `FormatChannels`
  (`of`, `list`).
* `ShaderValue`: fields `v`, `cols`, `fields` (Map), `text`, `offset`, `map`, `iterator`, `int`, `shared`; getters
  `items` (makes packed / appended elements an array, as C#'s `Items` does), `packed`, `isArray`, `count`, `x`, `size`,
  `isMatrix`; `append`, `padded`, `clone`, `toString`; statics `scalar`, `integer`, `vec(...n)`, **`vecOf(array)`** (C#
  `Vec(array)`: the array itself), `str`, `struct(Map)`, `array`, `matrix`, `identity`, `packedArray`, `mapKey`,
  `fromMapKey`, `isIntType`. `new ShaderValue({ v, cols, … })` is C#'s object initializer.
* `ShaderRunner(program, { lenient, time, hook, resolve, … })` – the init object is applied after the constructor, as
  C#'s object initializer is. `globals` (Map), `call`, `evaluate`, `evalArg`, `assign`, `runStatements`, `runBody` (→
  `{ value, scope }`), `default`, `asStructArray`, `discarded` / `clearDiscard`, statics `componentCount`, `matrixSize`,
  `swizzle`, `emptyStream`, `forExpressions`.
* `ShaderParser.parseProgram` / `parseExpression` / `parseStatementsLenient`; `ShaderAst` (import `* as A from
  "../Shading/ShaderAst.js"`; the runner switches on `kind`, use `instanceof` elsewhere).
* Scene: `new Scene({ api, … })` with `draws`, `targets` (Map), `ops`, `notes`, `log` …; `SimNote.error(key, ["file",
  f])` (pairs as tuples).
* Raster: `Rasterizer.render`, `Rasterizer.targetImage`, `Rasterizer.dispatch(program, entry, hlsl, uniforms: Map,
  images: Map, [x, y, z], time, textures?, textureImages?)`, `StorageImage`, `Stages.setUniform` (also exported as
  `setUniform`), `Stages.semantic`.
* Textures: `new Texture(image | () => image, sampler, { components, srgb, mipmapped, mipLinear })`, `texture.with({…})`
  for C#'s initializer on a copy, `CubeTexture(faces, { mips })` with `sample(x, y, z, lod?)`, `Image(width, height,
  channels, rgba, floats?, { programWidth, programHeight })`.
* Models: `ObjModel.load`, `GltfModel.load` / `loadFrom` (`scene`, `boneInfoMap`, `localMatrix`, `vertexBones`),
  `ModelFiles` (`path`, `flipUVs`, `texture`).

## What is different from C# (on purpose)

* No threads: C# shades a draw's fragments on every core in bands of rows that meet the primitives in draw order ("the
  same frame as on one core"); the port shades them in order on one thread. Compute dispatches run their rows of work
  groups in order with one runner. `Texture.footprint` and the render context are module state instead of
  `[ThreadStatic]`.
* Embedded resources are read from the repository: `symbols/*.txt` and `Fonts/*.json` through Vite `?raw` imports
  (src/internal/resources.ts). PNG is inflated by src/internal/inflate.ts (C#: `ZLibStream`), fonts hashed by
  src/internal/sha256.ts (C#: `SHA256`) – no npm dependency.
* `Rasterizer`'s setup cache key hashes the shader sources with FNV-1a instead of `string.GetHashCode` (C#'s differs
  from run to run anyway).

## How wave 1 checked the port against C#

Besides the ported xUnit tests, a throwaway C# console program (referencing `Codestead.GP.Gpu.csproj`) and a matching
Vitest file printed the same facts for the whole course and the outputs were diffed: `BuildChecker` over every start
and solution project (216 + start folders), `mainFile` / `mainText`, every GLSL and HLSL fragment shader of the solutions
rendered on a quad with procedural textures, cube maps and 4× MSAA (SHA-256 of the pixels), every PNG / HDR the course
ships (dimensions and pixel hashes), the OBJ and glTF models (meshes, the aiScene), the FreeType glyph table, and for
every solution: `CppSource.evaluate`, `declaredType`, `CppExec.eval` of each declared variable, `functions`,
`callsApi`, `parametersOf`, `StbImage.all`. All identical. Do the same for a reader: print the scene a C# reader makes
(draw count, notes, each draw's state and vertex data, a hash of the rendered frame) for every task and exercise, print
the same in TypeScript, diff. Delete the bin/ and obj/ folders `dotnet run` leaves under src/ afterwards.
