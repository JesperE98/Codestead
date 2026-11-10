using Codestead.GP.Gpu.Shading;
using static Codestead.GP.Gpu.Shading.ShaderAst;

namespace Codestead.GP.Gpu.Readers;

// The debug layer (learnopengl's "Debugging" in Direct3D 12): the messages it makes for the two mistakes the chapter's
// program has (a descriptor table set while no descriptor heap is, and a shader resource view with 0 mip levels), the
// info queue that stores them (ID3D12InfoQueue), the callback it calls right away (ID3D12InfoQueue1::
// RegisterMessageCallback) and the names objects get with SetName – in the debug layer's own wording.
internal sealed partial class D3D12Device
{
    private sealed record DebugMessage(string Category, string Severity, int Id, string Description);

    private readonly List<DebugMessage> storedMessages = new();
    private readonly Dictionary<string, string> objectNames = new(StringComparer.Ordinal);
    private readonly HashSet<long> invalidSrvs = new();
    private bool debugLayer, heapsSet, tablesWithoutHeap;
    private string? messageCallback;
    private int infoQueues;

    private const string InfoQueueHandle = "infoqueue:";

    /// <summary>The debug layer's calls and the info queue's; null: not one of them.</summary>
    private ShaderValue? DebugLayerCall(string name, IReadOnlyList<Expr> args)
    {
        bool OnQueue() => args.Count >= 1 && Eval(Strip(args[0]))?.Text?.StartsWith(InfoQueueHandle, StringComparison.Ordinal) == true;
        switch (name)
        {
            case ".EnableDebugLayer":
                debugLayer = true;
                return ShaderValue.Scalar(0);
            case ".As" when args.Count >= 2 && OutTarget(args[1]) is { } target && TargetType(target)?.Contains("InfoQueue", StringComparison.Ordinal) == true:
            {
                // The device's info queue exists only with the debug layer (otherwise As fails and the pointer stays empty).
                if (!debugLayer && !src.Uses("EnableDebugLayer")) return ShaderValue.Str("E_NOINTERFACE");
                exec!.Runner.Assign(target, ShaderValue.Str(InfoQueueHandle + ++infoQueues));
                return ShaderValue.Str("S_OK");
            }
            case "SUCCEEDED" when args.Count >= 1:
                return ShaderValue.Scalar(Succeeded(Eval(args[0])) ? 1 : 0);
            case "FAILED" when args.Count >= 1:
                return ShaderValue.Scalar(Succeeded(Eval(args[0])) ? 0 : 1);
            case "IsDebuggerPresent":
                // The simulator is no debugger: a break on a severity would end the program.
                return ShaderValue.Scalar(0);
            case ".SetBreakOnSeverity" or ".SetBreakOnCategory" or ".SetBreakOnID" or ".PushStorageFilter" or ".UnregisterMessageCallback" when OnQueue():
                return ShaderValue.Str("S_OK");
            case ".RegisterMessageCallback" when OnQueue() && args.Count >= 2:
            {
                messageCallback = Strip(args[1]) is Name { Id: var fn } && src.Functions.ContainsKey(fn) ? fn : null;
                if (args.Count >= 5) Set(args[4], ShaderValue.Integer(1));
                return ShaderValue.Str("S_OK");
            }
            case ".GetNumStoredMessages" when OnQueue():
                return ShaderValue.Integer(storedMessages.Count);
            case ".GetMessage" when OnQueue() && args.Count >= 4:
            {
                int index = (int)Num(args[1]);
                if (index < 0 || index >= storedMessages.Count) return ShaderValue.Str("E_INVALIDARG");
                var m = storedMessages[index];
                // First call (no message yet): the size of the D3D12_MESSAGE with its text after it.
                Set(args[3], ShaderValue.Integer(32 + m.Description.Length + 1));
                if (args[2] is not Name { Id: "nullptr" or "NULL" })
                    Set(args[2], Desc(("Category", ShaderValue.Str(m.Category)), ("Severity", ShaderValue.Str(m.Severity)), ("ID", ShaderValue.Integer(m.Id)),
                        ("pDescription", ShaderValue.Str(m.Description)), ("DescriptionByteLength", ShaderValue.Integer(m.Description.Length + 1))));
                return ShaderValue.Str("S_OK");
            }
            case ".ClearStoredMessages" when OnQueue():
                storedMessages.Clear();
                return ShaderValue.Scalar(0);
            case ".SetName" when args.Count >= 2:
            {
                if (Eval(args[1])?.Text is not { } label) return ShaderValue.Str("S_OK");
                objectNames[ObjectKey(args[0])] = label;
                return ShaderValue.Str("S_OK");
            }
            case ".SetDescriptorHeaps":
                heapsSet = true;
                return null;
            case ".Reset" when args.Count >= 3:
                // A command list's Reset(allocator, pipeline state): no heap and no tables set any more.
                heapsSet = tablesWithoutHeap = false;
                return null;
        }
        return null;
    }

    private void Set(Expr target, ShaderValue value)
    {
        try
        {
            exec!.Runner.Assign(Strip(target), value);
        }
        catch (ShaderRuntimeException)
        {
        }
    }

    private static bool Succeeded(ShaderValue? v) =>
        v?.Text is { } t ? t is "S_OK" or "S_FALSE" || !t.StartsWith("E_", StringComparison.Ordinal) && !t.StartsWith("DXGI_ERROR", StringComparison.Ordinal)
        : v?.V is not { Length: > 0 } n || n[0] >= 0;

    private string? TargetType(Expr target) => target switch
    {
        Name n => src.DeclaredType(n.Id),
        Member m => src.DeclaredType(m.Field),
        _ => null,
    };

    /// <summary>What SetName names: a resource by its id, anything else (a heap, the root signature) by its variable.</summary>
    private string ObjectKey(Expr e) => ResourceOf(e) is { } r ? "res:" + r.Id : HeapName(e);

    /// <summary>The debug layer reports a message: stored in the info queue, and given to the callback right away.</summary>
    private void Report(string category, string severity, int id, string description)
    {
        if (!debugLayer && !src.Uses("EnableDebugLayer")) return;
        storedMessages.Add(new DebugMessage(category, severity, id, description));
        if (messageCallback is null) return;
        var text = description.Replace("\\", "\\\\").Replace("\"", "\\\"");
        exec!.Run($"{messageCallback}({category}, {severity}, {id}, \"{text}\", nullptr);");
    }

    /// <summary>A descriptor table set while the command list has no descriptor heap: message #708, and nothing drawn.</summary>
    private void TableWithoutHeap(long handle)
    {
        tablesWithoutHeap = true;
        var heap = heaps.FirstOrDefault(h => handle >= h.Value && handle < h.Value + HeapUnit).Key ?? "heap";
        var heapName = objectNames.TryGetValue(heap, out var n) ? n : "Unnamed ID3D12DescriptorHeap Object";
        long heapAddress = 0x0000020B6E3A4F10L + (long)(heaps.GetValueOrDefault(heap) / HeapUnit) * 0x10000;
        long handleAddress = 0x0000020B6E5B3000L + (long)(handle % HeapUnit) * 32;
        Report("D3D12_MESSAGE_CATEGORY_EXECUTION", "D3D12_MESSAGE_SEVERITY_ERROR", 708,
            $"CGraphicsCommandList::SetGraphicsRootDescriptorTable: The descriptor heap (0x{heapAddress:X16}:'{heapName}') containing handle 0x{handleAddress:X16} is different from currently set descriptor heap 0x0000000000000000:'(nullptr)'.");
    }

    /// <summary>A 2D shader resource view with 0 mip levels (a zeroed description): message #31, and the view reads 0.</summary>
    private void CheckSrv(ShaderValue? desc, long handle)
    {
        invalidSrvs.Remove(handle);
        if (desc?.Fields is not { } f || f.GetValueOrDefault("ViewDimension")?.Text is not "D3D12_SRV_DIMENSION_TEXTURE2D") return;
        var mips = f.GetValueOrDefault("Texture2D")?.Fields?.GetValueOrDefault("MipLevels");
        if (mips is { V: { Length: > 0 } v } && v[0] != 0 || mips?.Text is not null) return;
        invalidSrvs.Add(handle);
        Report("D3D12_MESSAGE_CATEGORY_STATE_CREATION", "D3D12_MESSAGE_SEVERITY_ERROR", 31,
            "ID3D12Device::CreateShaderResourceView: The Dimensions of the View are invalid due to at least one of the following conditions. MostDetailedMip (value = 0) must be between 0 and MipLevels-1 of the Texture Resource, 0, inclusively. With the current MostDetailedMip, MipLevels (value = 0) must be between 1 and 1, inclusively, or -1 to default to all mips from MostDetailedMip, in order that the View fit on the Texture.");
    }
}
