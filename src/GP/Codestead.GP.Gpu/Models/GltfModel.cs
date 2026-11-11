using System.Text.Json;
using Codestead.GP.Gpu.Shading;

namespace Codestead.GP.Gpu.Models;

/// <summary>
/// A glTF 2.0 model (.gltf with its .bin buffers and images next to it) read the way assimp 5 reads it: its meshes as
/// <see cref="ObjModel"/> meshes (with the skin's bone ids and weights per vertex), the node tree, the skin's bones and
/// the animations – and as the aiScene a program walks (<see cref="Scene"/>): mRootNode, mMeshes with mBones,
/// mAnimations with their aiNodeAnim channels (key times in milliseconds, mTicksPerSecond 1000), mMaterials.
/// </summary>
public sealed class GltfModel
{
    public sealed record Node(string Name, double[] Translation, double[] Rotation, double[] Scale, double[]? Matrix, int[] Children, int? Mesh);

    /// <summary>A bone of the skin: its node's name and its inverse bind matrix (column-major, glTF's own order).</summary>
    public sealed record Bone(string Name, double[] OffsetMatrix);

    public sealed record Channel(string Node, double[] Times, List<double[]>? Positions, double[] PositionTimes, List<double[]>? Rotations, double[] RotationTimes, List<double[]>? Scales, double[] ScaleTimes);

    public sealed record Animation(string Name, double Duration, List<Channel> Channels);

    public ObjModel Model { get; }

    private GltfModel() => Model = new ObjModel { Gltf = this };
    public List<Node> Nodes { get; } = new();
    public int RootNode { get; private set; }
    public List<Bone> Bones { get; } = new();
    public List<Animation> Animations { get; } = new();
    /// <summary>The mesh of each glTF mesh (one per primitive).</summary>
    private readonly List<List<int>> meshPrimitives = new();

    public static bool IsGltf(string path) => path.EndsWith(".gltf", StringComparison.OrdinalIgnoreCase);

    /// <summary>The model at a path of the project, or null (missing, not glTF).</summary>
    public static GltfModel? Load(GpuProject project, string path) => Load(project.FindAsset, path);

    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<byte[], GltfModel> Cache = new();

    public static GltfModel? Load(Func<string, byte[]?> readBytes, string path)
    {
        var bytes = readBytes(path);
        if (bytes is null) return null;
        if (Cache.TryGetValue(bytes, out var cached)) return cached;
        try
        {
            var model = Read(readBytes, path, bytes);
            Cache.AddOrUpdate(bytes, model);
            return model;
        }
        catch (Exception e) when (e is JsonException or KeyNotFoundException or InvalidOperationException or IndexOutOfRangeException or ArgumentException or FormatException)
        {
            return null;
        }
    }

    private static GltfModel Read(Func<string, byte[]?> readBytes, string path, byte[] bytes)
    {
        var model = new GltfModel();
        using var doc = JsonDocument.Parse(bytes);
        var root = doc.RootElement;
        var dir = Path.GetDirectoryName(path.Replace('\\', '/'))?.Replace('\\', '/') ?? "";
        string Near(string uri) => dir.Length > 0 ? dir + "/" + uri : uri;
        var buffers = new List<byte[]>();
        if (root.TryGetProperty("buffers", out var bufs))
            foreach (var b in bufs.EnumerateArray())
            {
                var uri = b.TryGetProperty("uri", out var u) ? u.GetString() ?? "" : "";
                if (uri.StartsWith("data:", StringComparison.Ordinal)) buffers.Add(Convert.FromBase64String(uri[(uri.IndexOf(',') + 1)..]));
                else buffers.Add(readBytes(Near(uri)) ?? []);
            }
        var views = root.TryGetProperty("bufferViews", out var bv) ? bv.EnumerateArray().ToList() : [];
        var accessors = root.TryGetProperty("accessors", out var acc) ? acc.EnumerateArray().ToList() : [];
        static int Int(JsonElement e, string name, int fallback = 0) => e.TryGetProperty(name, out var v) ? v.GetInt32() : fallback;

        // An accessor's elements as numbers (normalised integers stay integers: joint ids).
        List<double[]> Read(int index)
        {
            var a = accessors[index];
            int count = Int(a, "count");
            int comps = (a.GetProperty("type").GetString() ?? "SCALAR") switch { "VEC2" => 2, "VEC3" => 3, "VEC4" => 4, "MAT4" => 16, "MAT3" => 9, "MAT2" => 4, _ => 1 };
            int type = Int(a, "componentType", 5126);
            int size = type switch { 5120 or 5121 => 1, 5122 or 5123 => 2, _ => 4 };
            var result = new List<double[]>(count);
            if (!a.TryGetProperty("bufferView", out var viewIndex))
            {
                for (int i = 0; i < count; i++) result.Add(new double[comps]);
                return result;
            }
            var view = views[viewIndex.GetInt32()];
            var data = buffers[Int(view, "buffer")];
            int start = Int(view, "byteOffset") + Int(a, "byteOffset");
            int stride = Int(view, "byteStride", comps * size);
            if (stride == 0) stride = comps * size;
            for (int i = 0; i < count; i++)
            {
                var v = new double[comps];
                for (int k = 0; k < comps; k++)
                {
                    int at = start + i * stride + k * size;
                    v[k] = type switch
                    {
                        5120 => (sbyte)data[at],
                        5121 => data[at],
                        5122 => BitConverter.ToInt16(data, at),
                        5123 => BitConverter.ToUInt16(data, at),
                        5125 => BitConverter.ToUInt32(data, at),
                        _ => BitConverter.ToSingle(data, at),
                    };
                }
                result.Add(v);
            }
            return result;
        }

        // Materials: the base colour texture's image.
        var images = root.TryGetProperty("images", out var im) ? im.EnumerateArray().Select(i => i.TryGetProperty("uri", out var u) ? u.GetString() : null).ToList() : [];
        var textures = root.TryGetProperty("textures", out var tx) ? tx.EnumerateArray().Select(t => Int(t, "source", -1)).ToList() : [];
        var materials = new List<ObjMaterial>();
        if (root.TryGetProperty("materials", out var mats))
            foreach (var m in mats.EnumerateArray())
            {
                string? map = null;
                double[] color = [1, 1, 1];
                if (m.TryGetProperty("pbrMetallicRoughness", out var pbr))
                {
                    if (pbr.TryGetProperty("baseColorTexture", out var bct) && Int(bct, "index", -1) is int ti and >= 0 && ti < textures.Count && textures[ti] is int ii and >= 0 && ii < images.Count)
                        map = images[ii];
                    if (pbr.TryGetProperty("baseColorFactor", out var f)) color = f.EnumerateArray().Take(3).Select(x => x.GetDouble()).ToArray();
                }
                var name = m.TryGetProperty("name", out var n) ? n.GetString() ?? "" : "";
                var material = new ObjMaterial { Name = name, Index = materials.Count, Diffuse = color, DiffuseMap = map };
                materials.Add(material);
                model.Model.Materials[name.Length > 0 ? name : "material" + materials.Count] = material;
            }

        // Meshes: one model mesh per primitive. assimp turns glTF's texture coordinates to v-up (v = 1 - v).
        if (root.TryGetProperty("meshes", out var meshes))
            foreach (var mesh in meshes.EnumerateArray())
            {
                var list = new List<int>();
                var meshName = mesh.TryGetProperty("name", out var mn) ? mn.GetString() ?? "" : "";
                foreach (var prim in mesh.GetProperty("primitives").EnumerateArray())
                {
                    var attrs = prim.GetProperty("attributes");
                    var positions = Read(Int(attrs, "POSITION"));
                    var normals = attrs.TryGetProperty("NORMAL", out var ni) ? Read(ni.GetInt32()) : null;
                    var uvs = attrs.TryGetProperty("TEXCOORD_0", out var ui) ? Read(ui.GetInt32()) : null;
                    var joints = attrs.TryGetProperty("JOINTS_0", out var ji) ? Read(ji.GetInt32()) : null;
                    var weights = attrs.TryGetProperty("WEIGHTS_0", out var wi) ? Read(wi.GetInt32()) : null;
                    var indices = prim.TryGetProperty("indices", out var ix) ? Read(ix.GetInt32()).Select(v => (int)v[0]).ToList() : Enumerable.Range(0, positions.Count).ToList();
                    int materialIndex = Int(prim, "material", -1);
                    var objMesh = new ObjMesh { Name = meshName, Material = materialIndex >= 0 && materialIndex < materials.Count ? materials[materialIndex] : null };
                    for (int v = 0; v < positions.Count; v++)
                    {
                        objMesh.Positions.Add(positions[v]);
                        objMesh.Normals.Add(normals is not null ? normals[v] : [0, 0, 0]);
                        objMesh.TexCoords.Add(uvs is not null ? [uvs[v][0], 1 - uvs[v][1]] : [0, 0]);
                    }
                    if (joints is not null && weights is not null)
                    {
                        objMesh.Joints = joints.Select(j => j.Select(x => (int)x).ToArray()).ToList();
                        objMesh.Weights = weights;
                    }
                    objMesh.Indices.AddRange(indices);
                    list.Add(model.Model.Meshes.Count);
                    model.Model.Meshes.Add(objMesh);
                }
                model.meshPrimitives.Add(list);
            }

        // Nodes.
        if (root.TryGetProperty("nodes", out var nodes))
            foreach (var n in nodes.EnumerateArray())
            {
                double[] Vec(string name, double[] fallback) => n.TryGetProperty(name, out var p) ? p.EnumerateArray().Select(x => x.GetDouble()).ToArray() : fallback;
                model.Nodes.Add(new Node(n.TryGetProperty("name", out var nn) ? nn.GetString() ?? "" : "",
                    Vec("translation", [0, 0, 0]), Vec("rotation", [0, 0, 0, 1]), Vec("scale", [1, 1, 1]),
                    n.TryGetProperty("matrix", out var mx) ? mx.EnumerateArray().Select(x => x.GetDouble()).ToArray() : null,
                    n.TryGetProperty("children", out var ch) ? ch.EnumerateArray().Select(x => x.GetInt32()).ToArray() : [],
                    n.TryGetProperty("mesh", out var me) ? me.GetInt32() : null));
            }
        var sceneIndex = Int(root, "scene");
        var rootNodes = root.TryGetProperty("scenes", out var scenes) && sceneIndex < scenes.GetArrayLength() && scenes[sceneIndex].TryGetProperty("nodes", out var sn)
            ? sn.EnumerateArray().Select(x => x.GetInt32()).ToList() : [];
        if (rootNodes.Count == 1) model.RootNode = rootNodes[0];
        else
        {
            // Several roots: assimp makes a ROOT node above them.
            model.Nodes.Add(new Node("ROOT", [0, 0, 0], [0, 0, 0, 1], [1, 1, 1], null, rootNodes.ToArray(), null));
            model.RootNode = model.Nodes.Count - 1;
        }

        // The skin's bones in its joint order, their inverse bind matrices.
        if (root.TryGetProperty("skins", out var skins) && skins.GetArrayLength() > 0)
        {
            var skin = skins[0];
            var jointNodes = skin.GetProperty("joints").EnumerateArray().Select(x => x.GetInt32()).ToList();
            var ibm = skin.TryGetProperty("inverseBindMatrices", out var ib) ? Read(ib.GetInt32()) : null;
            for (int j = 0; j < jointNodes.Count; j++)
                model.Bones.Add(new Bone(model.Nodes[jointNodes[j]].Name, ibm is not null && j < ibm.Count ? ibm[j] : Identity()));
        }

        // Animations: one channel per animated node (assimp's order: the last node first), times in seconds here.
        if (root.TryGetProperty("animations", out var anims))
            foreach (var a in anims.EnumerateArray())
            {
                var samplers = a.GetProperty("samplers").EnumerateArray().ToList();
                var byNode = new SortedDictionary<int, Dictionary<string, (double[] Times, List<double[]> Values)>>();
                double duration = 0;
                foreach (var c in a.GetProperty("channels").EnumerateArray())
                {
                    var target = c.GetProperty("target");
                    if (!target.TryGetProperty("node", out var node)) continue;
                    var sampler = samplers[Int(c, "sampler")];
                    var times = Read(Int(sampler, "input")).Select(t => t[0]).ToArray();
                    var values = Read(Int(sampler, "output"));
                    duration = Math.Max(duration, times.DefaultIfEmpty(0).Max());
                    if (!byNode.TryGetValue(node.GetInt32(), out var tracks)) byNode[node.GetInt32()] = tracks = new();
                    tracks[target.GetProperty("path").GetString() ?? ""] = (times, values);
                }
                var channels = new List<Channel>();
                foreach (var (node, tracks) in byNode.Reverse())
                {
                    tracks.TryGetValue("translation", out var tr);
                    tracks.TryGetValue("rotation", out var ro);
                    tracks.TryGetValue("scale", out var sc);
                    channels.Add(new Channel(model.Nodes[node].Name, [], tr.Values, tr.Times ?? [], ro.Values, ro.Times ?? [], sc.Values, sc.Times ?? []));
                }
                model.Animations.Add(new Animation(a.TryGetProperty("name", out var an) ? an.GetString() ?? "" : "", duration, channels));
            }
        model.Model.Meshes.RemoveAll(m => m.Indices.Count == 0);
        return model;
    }

    private static double[] Identity() => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

    /// <summary>A node's own transform, column-major: its matrix, or translation × rotation × scale.</summary>
    public static double[] LocalMatrix(Node n)
    {
        if (n.Matrix is { Length: 16 } m) return m;
        double x = n.Rotation[0], y = n.Rotation[1], z = n.Rotation[2], w = n.Rotation[3];
        double[][] r =
        [
            [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
            [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
            [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
        ];
        var result = new double[16];
        for (int col = 0; col < 3; col++)
            for (int row = 0; row < 3; row++) result[col * 4 + row] = r[row][col] * n.Scale[col];
        result[12] = n.Translation[0];
        result[13] = n.Translation[1];
        result[14] = n.Translation[2];
        result[15] = 1;
        return result;
    }

    // ---------- the aiScene a program walks ----------

    private static ShaderValue S(Dictionary<string, ShaderValue> fields) => ShaderValue.Struct(fields);
    private static ShaderValue Vec3(double[] v) => S(new(StringComparer.Ordinal) { ["x"] = ShaderValue.Scalar(v[0]), ["y"] = ShaderValue.Scalar(v[1]), ["z"] = ShaderValue.Scalar(v.Length > 2 ? v[2] : 0) });

    /// <summary>assimp's aiMatrix4x4 (a1 … d4, row by row) from a column-major matrix.</summary>
    private static ShaderValue AiMatrix(double[] m)
    {
        var f = new Dictionary<string, ShaderValue>(StringComparer.Ordinal);
        for (int row = 0; row < 4; row++)
            for (int col = 0; col < 4; col++) f[$"{(char)('a' + row)}{col + 1}"] = ShaderValue.Scalar(m[col * 4 + row]);
        return S(f);
    }

    /// <summary>
    /// The aiScene of assimp's ReadFile: flipUVs is aiProcess_FlipUVs (the texture coordinates back to v-down). Shared:
    /// the program's pointers into it are not copies.
    /// </summary>
    public ShaderValue Scene(bool flipUvs)
    {
        ShaderValue NodeValue(int index, int depth)
        {
            var n = Nodes[index];
            var meshes = n.Mesh is int mi && mi < meshPrimitives.Count ? meshPrimitives[mi] : [];
            var children = depth > 64 ? [] : n.Children.Where(c => c >= 0 && c < Nodes.Count).Select(c => NodeValue(c, depth + 1)).ToArray();
            return S(new(StringComparer.Ordinal)
            {
                ["mName"] = ShaderValue.Str(n.Name),
                ["mTransformation"] = AiMatrix(LocalMatrix(n)),
                ["mNumChildren"] = ShaderValue.Integer(children.Length),
                ["mChildren"] = ShaderValue.Array(children),
                ["mNumMeshes"] = ShaderValue.Integer(meshes.Count),
                ["mMeshes"] = ShaderValue.Array(meshes.Select(m => ShaderValue.Integer(m)).ToArray()),
            });
        }
        var meshValues = Model.Meshes.Select(mesh =>
        {
            var bones = new List<ShaderValue>();
            for (int b = 0; b < Bones.Count && mesh.Joints is not null; b++)
            {
                var weights = new List<ShaderValue>();
                for (int v = 0; v < mesh.Positions.Count; v++)
                    for (int k = 0; k < 4; k++)
                        if (mesh.Joints[v][k] == b && mesh.Weights![v][k] > 0)
                            weights.Add(S(new(StringComparer.Ordinal) { ["mVertexId"] = ShaderValue.Integer(v), ["mWeight"] = ShaderValue.Scalar(mesh.Weights[v][k]) }));
                bones.Add(S(new(StringComparer.Ordinal)
                {
                    ["mName"] = ShaderValue.Str(Bones[b].Name),
                    ["mOffsetMatrix"] = AiMatrix(Bones[b].OffsetMatrix),
                    ["mNumWeights"] = ShaderValue.Integer(weights.Count),
                    ["mWeights"] = ShaderValue.Array(weights.ToArray()),
                }));
            }
            var uvs = mesh.TexCoords.Select(t => Vec3([t[0], flipUvs ? 1 - t[1] : t[1], 0])).ToArray();
            return S(new(StringComparer.Ordinal)
            {
                ["mName"] = ShaderValue.Str(mesh.Name),
                ["mNumVertices"] = ShaderValue.Integer(mesh.Positions.Count),
                ["mVertices"] = ShaderValue.Array(mesh.Positions.Select(Vec3).ToArray()),
                ["mNormals"] = ShaderValue.Array(mesh.Normals.Select(Vec3).ToArray()),
                ["mTangents"] = ShaderValue.Array(mesh.Positions.Select(_ => Vec3([1, 0, 0])).ToArray()),
                ["mBitangents"] = ShaderValue.Array(mesh.Positions.Select(_ => Vec3([0, 0, 1])).ToArray()),
                ["mTextureCoords"] = ShaderValue.Array([ShaderValue.Array(uvs), .. Enumerable.Range(0, 7).Select(_ => ShaderValue.Scalar(0))]),
                ["mNumFaces"] = ShaderValue.Integer(mesh.Indices.Count / 3),
                ["mFaces"] = ShaderValue.Array(Enumerable.Range(0, mesh.Indices.Count / 3).Select(f => S(new(StringComparer.Ordinal)
                {
                    ["mNumIndices"] = ShaderValue.Integer(3),
                    ["mIndices"] = ShaderValue.Array([ShaderValue.Integer(mesh.Indices[f * 3]), ShaderValue.Integer(mesh.Indices[f * 3 + 1]), ShaderValue.Integer(mesh.Indices[f * 3 + 2])]),
                })).ToArray()),
                ["mMaterialIndex"] = ShaderValue.Integer(mesh.Material?.Index ?? 0),
                ["mNumBones"] = ShaderValue.Integer(bones.Count),
                ["mBones"] = ShaderValue.Array(bones.ToArray()),
            });
        }).ToArray();
        var materials = Model.Materials.Values.OrderBy(m => m.Index).Select(m => S(new(StringComparer.Ordinal)
        {
            ["mName"] = ShaderValue.Str(m.Name),
            // What GetTextureCount / GetTexture answer: the files by texture type.
            [MaterialTextures] = S(new(StringComparer.Ordinal)
            {
                ["aiTextureType_DIFFUSE"] = ShaderValue.Array(m.DiffuseMap is { } d ? [ShaderValue.Str(d)] : []),
                ["aiTextureType_BASE_COLOR"] = ShaderValue.Array(m.DiffuseMap is { } d2 ? [ShaderValue.Str(d2)] : []),
            }),
        })).ToArray();
        // Times in milliseconds, 1000 ticks per second (assimp 5's glTF importer).
        ShaderValue Keys(List<double[]>? values, double[] times, bool quaternion) => ShaderValue.Array((values ?? []).Select((v, i) => S(new(StringComparer.Ordinal)
        {
            ["mTime"] = ShaderValue.Scalar(i < times.Length ? times[i] * 1000 : 0),
            ["mValue"] = quaternion
                ? S(new(StringComparer.Ordinal) { ["x"] = ShaderValue.Scalar(v[0]), ["y"] = ShaderValue.Scalar(v[1]), ["z"] = ShaderValue.Scalar(v[2]), ["w"] = ShaderValue.Scalar(v[3]) })
                : Vec3(v),
        })).ToArray());
        var animations = Animations.Select(a => S(new(StringComparer.Ordinal)
        {
            ["mName"] = ShaderValue.Str(a.Name),
            ["mDuration"] = ShaderValue.Scalar(a.Duration * 1000),
            ["mTicksPerSecond"] = ShaderValue.Scalar(1000),
            ["mNumChannels"] = ShaderValue.Integer(a.Channels.Count),
            ["mChannels"] = ShaderValue.Array(a.Channels.Select(c => S(new(StringComparer.Ordinal)
            {
                ["mNodeName"] = ShaderValue.Str(c.Node),
                ["mNumPositionKeys"] = ShaderValue.Integer(c.Positions?.Count ?? 0),
                ["mPositionKeys"] = Keys(c.Positions, c.PositionTimes, false),
                ["mNumRotationKeys"] = ShaderValue.Integer(c.Rotations?.Count ?? 0),
                ["mRotationKeys"] = Keys(c.Rotations, c.RotationTimes, true),
                ["mNumScalingKeys"] = ShaderValue.Integer(c.Scales?.Count ?? 0),
                ["mScalingKeys"] = Keys(c.Scales, c.ScaleTimes, false),
            })).ToArray()),
        })).ToArray();
        return new ShaderValue
        {
            Fields = new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["mFlags"] = ShaderValue.Integer(0),
                ["mRootNode"] = NodeValue(RootNode, 0),
                ["mNumMeshes"] = ShaderValue.Integer(meshValues.Length),
                ["mMeshes"] = ShaderValue.Array(meshValues),
                ["mNumMaterials"] = ShaderValue.Integer(materials.Length),
                ["mMaterials"] = ShaderValue.Array(materials),
                ["mNumAnimations"] = ShaderValue.Integer(animations.Length),
                ["mAnimations"] = ShaderValue.Array(animations),
            },
            Shared = true,
        };
    }

    /// <summary>
    /// A vertex's bones as learnopengl's ExtractBoneWeightForVertices leaves them: the bones (ids = their place in the
    /// skin) in the order assimp lists them, each in the next free slot, at most four; the rest -1 with weight 0.
    /// </summary>
    public static (double[] Ids, double[] Weights) VertexBones(ObjMesh mesh, int v)
    {
        double[] ids = [-1, -1, -1, -1], weights = [0, 0, 0, 0];
        if (mesh.Joints is null || mesh.Weights is null) return (ids, weights);
        var influences = Enumerable.Range(0, 4).Where(k => mesh.Weights[v][k] > 0).Select(k => (Bone: mesh.Joints[v][k], Weight: mesh.Weights[v][k]))
            .GroupBy(x => x.Bone).Select(g => (Bone: g.Key, Weight: g.First().Weight)).OrderBy(x => x.Bone).Take(4).ToList();
        for (int k = 0; k < influences.Count; k++)
        {
            ids[k] = influences[k].Bone;
            weights[k] = influences[k].Weight;
        }
        return (ids, weights);
    }

    /// <summary>
    /// The model's m_BoneInfoMap as learnopengl's Model fills it: bone name → BoneInfo { id, offset } – the offset as
    /// GLM's column-major matrix, or (directX) as DirectXMath's row-vector one.
    /// </summary>
    public ShaderValue BoneInfoMap(bool directX)
    {
        var map = new SortedDictionary<double, ShaderValue>();
        for (int b = 0; b < Bones.Count; b++)
        {
            var m = Bones[b].OffsetMatrix;
            var offset = directX ? Enumerable.Range(0, 16).Select(i => m[i % 4 * 4 + i / 4]).ToArray() : (double[])m.Clone();
            map[ShaderValue.MapKey(ShaderValue.Str(Bones[b].Name))] = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["id"] = ShaderValue.Integer(b),
                ["offset"] = ShaderValue.Matrix(4, offset),
            });
        }
        return new ShaderValue { Map = map };
    }

    /// <summary>The field of an aiMaterial value that holds its texture files by type.</summary>
    public const string MaterialTextures = "\u0001textures";
}
