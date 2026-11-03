using System.IO.Pipes;

namespace Codestead.Hub.Core;

/// <summary>
/// Only one hub per user: a second start asks the first one to show its window and exits. The first one listens
/// on a local pipe (a named pipe on Windows, a Unix socket elsewhere).
/// </summary>
public sealed class SingleInstance(string name) : IDisposable
{
    private readonly CancellationTokenSource stop = new();
    private readonly string pipe = $"{name}-{Environment.UserName}";

    /// <summary>Asks a running instance to show itself. True when one answered (this one should exit).</summary>
    public bool NotifyRunning()
    {
        try
        {
            using var client = new NamedPipeClientStream(".", pipe, PipeDirection.Out);
            client.Connect(300);
            client.WriteByte(1);
            return true;
        }
        catch (Exception e) when (e is TimeoutException or IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>Calls <paramref name="onShow"/> (on a background thread) every time another start asks.</summary>
    public void Listen(Action onShow) => _ = Task.Run(async () =>
    {
        while (!stop.IsCancellationRequested)
        {
            try
            {
                await using var server = new NamedPipeServerStream(pipe, PipeDirection.In, 1);
                await server.WaitForConnectionAsync(stop.Token);
                server.ReadByte();
                onShow();
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (IOException)
            {
                await Task.Delay(500);
            }
        }
    });

    public void Dispose()
    {
        stop.Cancel();
        stop.Dispose();
    }
}
