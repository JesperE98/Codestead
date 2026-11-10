using System.Text.RegularExpressions;
using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// The validation layer (learnopengl's "Debugging" in Vulkan): vulkan-tutorial's debug messenger gets the layer's
// messages through the program's own callback – the loader's verbose lines when the messenger is made, and the error
// of a pipeline whose vertex shader reads an input location no attribute description gives (VUID-…-Input-07904), with
// the names objects got from vkSetDebugUtilsObjectNameEXT – in the layer's own wording.
internal sealed partial class VulkanDevice
{
    private string? messengerCallback;
    private int messengerSeverities;
    private readonly Queue<string> shaderFiles = new();
    private readonly Dictionary<string, string> moduleFiles = new(StringComparer.Ordinal);
    private readonly Dictionary<string, string> objectNames = new(StringComparer.Ordinal);

    private const int Verbose = 0x1, Error = 0x1000, General = 0x1, Validation = 0x2;

    /// <summary>The debug-utils calls and the shader module bookkeeping; null: not one of them (or the call goes on).</summary>
    private ShaderValue? ValidationCall(string name, IReadOnlyList<Expr> args)
    {
        switch (name)
        {
            case "readFile" when args.Count >= 1 && Eval(args[0])?.Text is { } file && file.EndsWith(".spv", StringComparison.Ordinal):
                // The SPIR-V file a shader module is made of next (vulkan-tutorial reads both, then makes both modules).
                shaderFiles.Enqueue(file);
                return null;
            case "vkCreateShaderModule" when args.Count >= 4:
            {
                var module = New("shader");
                if (shaderFiles.Count > 0) moduleFiles[module] = shaderFiles.Dequeue();
                Set(args[3], ShaderValue.Str(module));
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "CreateDebugUtilsMessengerEXT" or "vkCreateDebugUtilsMessengerEXT" when args.Count >= 4:
            {
                // The callback and the severities it asks for (createInfo.pfnUserCallback, createInfo.messageSeverity).
                var callback = Regex.Match(src.Code, @"\.pfnUserCallback\s*=\s*(?:\(\s*\w+\s*\)\s*)?&?\s*(\w+)\s*;");
                messengerCallback = callback.Success && src.Functions.ContainsKey(callback.Groups[1].Value) ? callback.Groups[1].Value : null;
                var severity = Eval(Strip(args[1]))?.Fields?.GetValueOrDefault("messageSeverity");
                messengerSeverities = severity is { V: { Length: > 0 } bits } ? (int)bits[0] : Verbose | 0x10 | 0x100 | Error;
                Set(args[3], ShaderValue.Str(New("messenger")));
                // The loader's and the layer's first messages (lavapipe's start with these too).
                Message(Verbose, General, "Searching for ICD drivers named libvulkan_codestead.so (the simulated GPU)", null, 0, []);
                Message(Verbose, General, "Loading layer library libVkLayer_khronos_validation.so", null, 0, []);
                return ShaderValue.Str("VK_SUCCESS");
            }
            case "SetDebugUtilsObjectNameEXT" or "vkSetDebugUtilsObjectNameEXT" when args.Count >= 2:
            {
                var info = Eval(Strip(args[^1]));
                if (info?.Fields is { } f && f.GetValueOrDefault("pObjectName")?.Text is { } label && HandleKey(f.GetValueOrDefault("objectHandle")) is { } key)
                    objectNames[key] = label;
                return ShaderValue.Str("VK_SUCCESS");
            }
        }
        return null;
    }

    /// <summary>A handle as the program passes it ((uint64_t) module keeps the handle's name).</summary>
    private static string? HandleKey(ShaderValue? v) => v?.Text is { Length: > 0 } t ? t : null;

    /// <summary>vkCreateGraphicsPipelines: every input location of the vertex shader needs an attribute description.</summary>
    private void CheckVertexInputs(ShaderValue info, List<Attribute> attributes, int index)
    {
        if (messengerCallback is null) return;
        var vertexModule = Items(Field(info, "pStages")).Take((int)(Number(info, "stageCount") ?? int.MaxValue))
            .Where(st => Text(st, "stage")?.Contains("VERTEX", StringComparison.Ordinal) == true).Select(st => Text(st, "module")).FirstOrDefault();
        if (vertexModule is null || !moduleFiles.TryGetValue(vertexModule, out var spv)) return;
        // The shader's GLSL next to its SPIR-V name (shaders/debugging.vert.spv ← shaders/debugging.vert).
        var glsl = project.Find(spv[..^4]);
        if (glsl is null) return;
        var described = attributes.Select(a => a.Location).ToHashSet();
        var inputs = Regex.Matches(CppSource.BlankComments(glsl), @"layout\s*\(\s*location\s*=\s*(\d+)\s*\)\s*in\s+\w+\s+\w+").Select(m => int.Parse(m.Groups[1].Value)).Distinct().Order();
        foreach (var location in inputs.Where(l => !described.Contains(l)))
            Message(Error, Validation,
                $"vkCreateGraphicsPipelines(): pCreateInfos[{index}].pVertexInputState->pVertexAttributeDescriptions does not have a Location {location} but vertex shader has an input variable at that Location. The Vulkan spec states: If the pipeline is being created with vertex input state and pVertexInputState is not dynamic, then all variables with the Input storage class decorated with Location in the Vertex Execution Model OpEntryPoint must contain a location in VkVertexInputAttributeDescription::location (https://www.khronos.org/registry/vulkan/specs/1.3-extensions/html/vkspec.html#VUID-VkGraphicsPipelineCreateInfo-Input-07904)",
                "VUID-VkGraphicsPipelineCreateInfo-Input-07904", unchecked((int)0xcc9c32be), [(vertexModule, "VK_OBJECT_TYPE_SHADER_MODULE")]);
    }

    /// <summary>
    /// The layer reports a message: the program's callback gets it (when the messenger asks for its severity), with the
    /// text as the layer formats it – "Validation Error: [ VUID ] Object 0: handle = …, name = …, type = …; | MessageID = … | …".
    /// </summary>
    private void Message(int severity, int type, string text, string? vuid, int id, (string Handle, string Type)[] objects)
    {
        if (messengerCallback is null || (messengerSeverities & severity) == 0) return;
        var message = text;
        if (vuid is not null)
        {
            var described = string.Join(" ", objects.Select((o, i) =>
                $"Object {i}: handle = 0x{HandleNumber(o.Handle):x}, {(objectNames.TryGetValue(o.Handle, out var n) ? "name = " + n + ", " : "")}type = {o.Type};"));
            message = $"{(severity == Error ? "Validation Error" : "Validation Warning")}: [ {vuid} ] {described} | MessageID = 0x{unchecked((uint)id):x} | {text}";
        }
        var data = ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
        {
            ["pMessage"] = ShaderValue.Str(message),
            ["pMessageIdName"] = ShaderValue.Str(vuid ?? ""),
            ["messageIdNumber"] = ShaderValue.Integer(id),
            ["objectCount"] = ShaderValue.Integer(objects.Length),
            ["pObjects"] = ShaderValue.Array(objects.Select(o => ShaderValue.Struct(new Dictionary<string, ShaderValue>(StringComparer.Ordinal)
            {
                ["objectType"] = ShaderValue.Str(o.Type),
                ["objectHandle"] = ShaderValue.Str(o.Handle),
                ["pObjectName"] = ShaderValue.Str(objectNames.GetValueOrDefault(o.Handle) ?? ""),
            })).ToArray()),
        });
        exec!.Runner.Globals["__vkCallbackData"] = data;
        exec.Run($"{messengerCallback}({severity}, {type}, &__vkCallbackData, nullptr);");
    }

    /// <summary>A handle's number as a driver shows it: "shader:15" → 0xf000000000f.</summary>
    private static long HandleNumber(string handle) =>
        int.TryParse(handle[(handle.IndexOf(':') + 1)..], out var n) ? ((long)n << 40) | (long)n : 0;
}
