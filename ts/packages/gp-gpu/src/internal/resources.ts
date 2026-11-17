// The C# project's embedded resources, read from the repository by path (content is shared, never copied): the API
// symbols (src/GP/Codestead.GP.Gpu/symbols/*.txt) and the FreeType glyphs of the course's font (Fonts/*.glyphs.json).
import assimpMethods from "../../../../../src/GP/Codestead.GP.Gpu/symbols/assimp-methods.txt?raw";
import d3d12Methods from "../../../../../src/GP/Codestead.GP.Gpu/symbols/d3d12-methods.txt?raw";
import d3d12 from "../../../../../src/GP/Codestead.GP.Gpu/symbols/d3d12.txt?raw";
import opengl from "../../../../../src/GP/Codestead.GP.Gpu/symbols/opengl.txt?raw";
import vulkan from "../../../../../src/GP/Codestead.GP.Gpu/symbols/vulkan.txt?raw";
import interBold from "../../../../../src/GP/Codestead.GP.Gpu/Fonts/inter-bold.glyphs.json?raw";

/** symbols/&lt;name&gt;.txt as text, or null when there is no such list. */
export function symbolList(name: string): string | null {
  switch (name) {
    case "opengl": return opengl;
    case "vulkan": return vulkan;
    case "d3d12": return d3d12;
    case "d3d12-methods": return d3d12Methods;
    case "assimp-methods": return assimpMethods;
    default: return null;
  }
}

/** The texts of Fonts/*.glyphs.json. */
export const glyphFiles: readonly string[] = [interBold];
