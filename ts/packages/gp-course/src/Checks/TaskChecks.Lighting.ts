import { type Rgba } from "../CheckContext.js";
import { type ChapterChecks } from "./TaskChecks.PerApi.js";

// Lighting: the picture where it tells the steps apart (the coral object, the white lamp, how many draws), and the
// shader code otherwise – GLSL and HLSL use the same names for this (reflect, pow, Material, cutOff …).

export function coral(p: Rgba): boolean {
  return Math.abs(p[0] - 1.0) < 0.03 && Math.abs(p[1] - 0.5) < 0.03 && Math.abs(p[2] - 0.31) < 0.03;
}

export function white(p: Rgba): boolean {
  return p[0] > 0.97 && p[1] > 0.97 && p[2] > 0.97;
}

export function lighting(): ChapterChecks {
  return [
    ["colors", {
        "object-color": c => c.anyDrawnPixel(coral) && c.hasInShaders("lightColor \\* (?:\\w+\\.)?objectColor|objectColor \\* (?:\\w+\\.)?lightColor"),
        "lamp-shader": c => c.built && c.hasInShaders("vec4 \\( 1\\.0 \\)|vec4 \\( 1\\.0f?(?: , 1\\.0f?){3} \\)|float4 \\( 1\\.0f?(?: , 1\\.0f?){3} \\)"),
        "lamp": c => (c.scene?.draws.length ?? -1) >= 2 && c.anyDrawnPixel(white),
    }],
    ["basic-lighting", {
        "ambient": c => c.drew && c.hasInShaders("ambientStrength"),
        "normals": c => c.built && c.hasInShaders("\\bin vec3 \\w*[Nn]ormal ;|: ?NORMAL\\b"),
        "diffuse": c => c.drew && c.hasInShaders("max \\( dot \\("),
        "normal-matrix": c => c.drew && c.hasInShaders("(?i)inverse|normalMatrix"),
        "specular": c => c.drew && c.hasInShaders("reflect \\(") && c.hasInShaders("pow \\("),
        "moving-light": c => c.drew && c.changesOverTime && c.has("(?i)lightPos") && c.has("\\b(?:sin|cos) \\("),
    }],
    ["materials", {
        "material": c => c.drew && c.hasInShaders("struct Material") && c.hasInShaders("shininess"),
        "light": c => c.drew && c.hasInShaders("struct Light"),
        "light-color": c => c.drew && c.changesOverTime && c.hasInShaders("struct Light"),
    }],
    ["lighting-maps", {
        "texcoords": c => c.built && c.hasInShaders("(?i)(in vec2 \\w*tex\\w*|: ?TEXCOORD)"),
        "diffuse-map": c => c.drew && c.has("container2\\.png") && c.hasInShaders("(?i)(texture \\( (?:material\\.diffuse|diffuseMap)|diffuseMap\\.Sample \\()"),
        "specular-map": c => c.drew && c.has("container2_specular\\.png"),
        "emission": c => c.drew && c.has("matrix\\.png"),
    }],
    ["light-casters", {
        "directional": c => c.drew && c.hasInShaders("(?i)light\\.direction|lightDirection"),
        "point-light": c => c.drew && c.hasInShaders("quadratic"),
        "spotlight": c => c.drew && c.hasInShaders("cutOff"),
        "soft-edges": c => c.drew && c.hasInShaders("outerCutOff"),
    }],
    ["multiple-lights", {
        "dir-light": c => c.drew && c.hasInShaders("CalcDirLight"),
        "point-lights": c => c.drew && c.hasInShaders("CalcPointLight"),
        "spot-light": c => c.drew && c.hasInShaders("CalcSpotLight"),
        "lamps": c => (c.scene?.draws.length ?? -1) >= 14,
    }],
  ];
}
