using System.Text.Json;
using System.Text.Json.Serialization;

namespace Codestead.Common;

/// <summary>The JSON settings of every saved file (camelCase, nulls left out), so all apps read each other's files.</summary>
public static class JsonDefaults
{
    public static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = null,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = false,
        IncludeFields = false,
    };
}
