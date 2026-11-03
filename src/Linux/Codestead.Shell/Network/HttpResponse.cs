namespace Codestead.Shell;

// Network model: an HTTP response.

public partial class HttpResponse
{
    public int Status { get; set; }
    public string Reason { get; set; } = "";
    /// <summary>"HTTP/1.1", "HTTP/1.0" or "HTTP/2".</summary>
    public string Version { get; set; } = "";
    public List<(string Key, string Value)> Headers { get; set; } = new();
    public string Body { get; set; } = "";
}
