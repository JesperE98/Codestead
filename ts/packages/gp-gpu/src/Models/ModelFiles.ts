import type { GpuProject } from "../GpuProject.js";
import { CppSource } from "../Readers/CppSource.js";
import { StbImage } from "../Readers/StbImage.js";
import { SamplerState } from "../Textures/SamplerState.js";
import { Texture } from "../Textures/Texture.js";
import { directoryOf } from "./ObjModel.js";

/** Finding and loading the course's model in a program, and its textures. */
export const ModelFiles = {
  /** The first .obj file the code names ("planet.obj", MODEL_PATH = "models/planet.obj"). */
  path(src: CppSource): string | null {
    return /"([^"\n]+\.(?:obj|gltf))"/.exec(src.code)?.[1] ?? null;
  },

  /** Assimp's aiProcess_FlipUVs (in main.cpp or a header such as learnopengl's model.h): v becomes 1 - v. */
  flipUVs(src: CppSource, project: GpuProject): boolean {
    return src.uses("aiProcess_FlipUVs") || [...project.files].some(([k, v]) => (k.endsWith(".h") || k.endsWith(".hpp") || k.endsWith(".cpp"))
      && /\baiProcess_FlipUVs\b/.test(CppSource.blankComments(v)));
  },

  /**
   * A texture of a material, next to the model, loaded like the program's stb_image calls. Mipmapped: learnopengl's
   * model.h (TextureFromFile) calls glGenerateMipmap and sets GL_LINEAR_MIPMAP_LINEAR.
   */
  texture(project: GpuProject, modelPath: string, file: string | null, flip: boolean, mipmapped = false): Texture | null {
    if (file === null) return null;
    const dir = directoryOf(modelPath);
    const image = StbImage.load(project, dir.length > 0 ? dir + "/" + file : file, flip, 0);
    return image === null ? null : new Texture(image, SamplerState.Default, { components: image.channels === 4 ? 4 : 3, mipmapped });
  },
};
