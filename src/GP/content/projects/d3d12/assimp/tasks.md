# assimp – DirectX 12

learnopengl.com "Assimp" has no code: **no tasks**. `edits.txt` is empty; `start/` = `solution/` = the Mesh chapter's
`start/`, so the learner can look at the project the next two chapters work in.

Files: `main.cpp`, `model_loading.hlsl`, and the read-only model in `models/` (`planet.obj`, `planet.mtl`,
`planet_diffuse.png`, `planet_specular.png`, `rings.png`, `rings_specular.png`).

What the project is: the Camera chapter's program (camera globals at (0, 0, 3) looking down -z, yaw -90, pitch 0,
fov 45, WASD / mouse look / wheel zoom, view and projection in the constant buffer, the model matrix as root constants)
set up for a model instead of the cube:
- `model_loading.hlsl` (learnopengl's `1.model_loading.vs/.fs`): `VSMain(float4 position : POSITION, float3 normal :
  NORMAL, float2 texCoords : TEXCOORD)`, `Texture2D texture_diffuse1 : register(t0);`, and `PSMain` returns
  `texture_diffuse1.Sample(wrapSampler, input.texCoords)` – the diffuse texture, no lighting.
- Input layout POSITION / NORMAL / TEXCOORD (byte offsets 0, 12, 24), `CullMode = D3D12_CULL_MODE_NONE` (the ring is a
  single plane), the default depth test, a D32_FLOAT depth buffer.
- Root signature: parameter 0 = root constants (`ModelConstants { XMFLOAT4X4 model; }`, b0), parameter 1 = a table with
  the CBV (b1, `SceneConstantBuffer { view; projection; }`), parameter 2 = a table of **2 SRVs (t0 diffuse, t1
  specular)** – set per mesh when it is drawn; static sampler s0 (linear, wrap).
- CBV/SRV heap: `1 + 2 * MaxMeshes` descriptors (`static const UINT MaxMeshes = 8;`): slot 0 the CBV, then two SRVs per
  mesh.
- Clear colour `{ 0.05f, 0.05f, 0.05f, 1.0f }`; in `PopulateCommandList` the model matrix of learnopengl's
  model_loading.cpp scene: `XMMatrixScaling(0.5f, 0.5f, 0.5f) * XMMatrixRotationAxis(XMVectorSet(1.0f, 0.0f, 0.0f, 0.0f),
  XMConvertToRadians(25.0f)) * XMMatrixTranslation(0.0f, 0.0f, 0.0f)` (= glm translate * rotate(25°, x) * scale(0.5)),
  transposed into the root constants. Nothing is drawn yet.

Picture: only the background, 13,13,13 (0.05) everywhere, e.g. (400,300) and (100,100).
