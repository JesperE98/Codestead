// The simulated GPU of Codestead GP: readers, GLSL/HLSL interpreter, rasterizer. Port of Codestead.GP.Gpu; see
// docs/TYPESCRIPT-MIGRATION.md and PORTING.md (how the readers are ported).
export { ApiInfo } from "./ApiInfo.js";
export { Apis } from "./Apis.js";
export { GpuProject } from "./GpuProject.js";
export { Simulator } from "./Simulator.js";

export { ApiSymbols } from "./Build/ApiSymbols.js";
export { BuildChecker } from "./Build/BuildChecker.js";
export { BuildResult } from "./Build/BuildResult.js";
export { Diagnostic } from "./Build/Diagnostic.js";

export { FreeTypeGlyphs, type Glyph } from "./Fonts/FreeTypeGlyphs.js";

export { GltfModel, type GltfAnimation, type GltfBone, type GltfChannel, type GltfNode } from "./Models/GltfModel.js";
export { ModelFiles } from "./Models/ModelFiles.js";
export { ObjMaterial } from "./Models/ObjMaterial.js";
export { ObjMesh } from "./Models/ObjMesh.js";
export { ObjModel } from "./Models/ObjModel.js";

export { Frame } from "./Raster/Frame.js";
export { Framebuffer } from "./Raster/Framebuffer.js";
export { Rasterizer } from "./Raster/Rasterizer.js";
export { RenderContext } from "./Raster/RenderContext.js";
export { ShadedVertex } from "./Raster/ShadedVertex.js";
export { SrgbCurve } from "./Raster/SrgbCurve.js";
export { Stages, TextureReads, setUniform } from "./Raster/Stages.js";
export { StorageImage } from "./Raster/StorageImage.js";
export { Tessellator, type Mesh } from "./Raster/Tessellator.js";

export { CppCall } from "./Readers/CppCall.js";
export { CppExec, type CppHook } from "./Readers/CppExec.js";
export { CppSource, Parameter, type FieldAssignment, type Range } from "./Readers/CppSource.js";
export { DrawTextures } from "./Readers/DrawTextures.js";
export { FormatChannels } from "./Readers/FormatChannels.js";
export { SpacePressFrame, SpaceReleaseFrame } from "./Readers/FrameConstants.js";
export { FrameRecorder, RecordedDraw, type RecordedDrawOptions } from "./Readers/FrameRecorder.js";
export { GameFrames } from "./Readers/GameFrames.js";
export type { IDeviceModel } from "./Readers/IDeviceModel.js";
export { PipelineInfo, type PipelineInfoOptions } from "./Readers/PipelineInfo.js";
export { Fixed, PipelineState } from "./Readers/PipelineState.js";
export { readerFor, registerReader, type ReadProgram } from "./Readers/ReaderRegistry.js";
export { StbImage } from "./Readers/StbImage.js";
export { StructLayout, type StructField } from "./Readers/StructLayout.js";
export { TextureBinding } from "./Readers/TextureBinding.js";

export { BlendFactor } from "./Scene/BlendFactor.js";
export { BlendOp } from "./Scene/BlendOp.js";
export { BlendState } from "./Scene/BlendState.js";
export { CompareFunc } from "./Scene/CompareFunc.js";
export { CullMode } from "./Scene/CullMode.js";
export { DrawCall, type DrawCallInit, type VertexData } from "./Scene/DrawCall.js";
export { ClearOp, CopyOp, FrameOp } from "./Scene/FrameOp.js";
export { NoteLevel } from "./Scene/NoteLevel.js";
export { RenderTarget, type RenderTargetOptions } from "./Scene/RenderTarget.js";
export { Scene } from "./Scene/Scene.js";
export { SimNote } from "./Scene/SimNote.js";
export { StencilOp } from "./Scene/StencilOp.js";
export { StencilState } from "./Scene/StencilState.js";
export { Topology } from "./Scene/Topology.js";

export { GlibcRandom } from "./Shading/GlibcRandom.js";
export { MapIterator } from "./Shading/MapIterator.js";
export * as ShaderAst from "./Shading/ShaderAst.js";
export { ShaderRuntimeException, ShaderSyntaxException } from "./Shading/ShaderErrors.js";
export { ShaderLexer } from "./Shading/ShaderLexer.js";
export { ShaderParser } from "./Shading/ShaderParser.js";
export { ShaderProgram } from "./Shading/ShaderProgram.js";
export { ShaderRunner, matrixMultiply, sequenceEqual, type Footprint, type ShaderRunnerInit } from "./Shading/ShaderRunner.js";
export { ShaderToken, ShaderTokenKind } from "./Shading/ShaderToken.js";
export { ShaderValue, type ShaderValueInit } from "./Shading/ShaderValue.js";
export { SortedMap } from "./Shading/SortedMap.js";

export { CubeTexture } from "./Textures/CubeTexture.js";
export { Image } from "./Textures/Image.js";
export { Png } from "./Textures/Png.js";
export { RadianceHdr } from "./Textures/RadianceHdr.js";
export { SamplerState } from "./Textures/SamplerState.js";
export { Texture, type TextureInit } from "./Textures/Texture.js";
export { Wrap } from "./Textures/Wrap.js";

// The per-API readers register themselves when imported (wave 2 adds one line each):
import "./Readers/GlReader.js";
export { GlReader } from "./Readers/GlReader.js";
export { CppStatement } from "./Readers/CppStatement.js";
export { CppStatements } from "./Readers/CppStatements.js";
// import "./Readers/VulkanReader.js";
// import "./Readers/D3D12Reader.js";
