namespace Codestead.GP.Course.Ide;

/// <summary>
/// Watches the learner's project folder in the background: a FileSystemWatcher (changes are seen within a fraction of
/// a second) and, in case it misses something or cannot watch the folder (network drives, too many watches), a scan
/// every <see cref="ScanInterval"/>. While the program is built but not yet run, the running processes are looked at
/// every <see cref="ProcessInterval"/>. <see cref="Changed"/> is raised on a thread-pool thread.
/// </summary>
public sealed class ProjectWatcher : IDisposable
{
    private readonly IProcessProbe probe;
    private readonly ExecutableCache cache = new();
    private readonly CancellationTokenSource stop = new();
    private readonly SemaphoreSlim wake = new(0, 1);
    private readonly object gate = new();
    private FileSystemWatcher? fsw;
    private DateTime? lastProcessStart;
    private DateTime? ranByHand;
    private volatile bool rescan = true;
    private WatchStatus status = WatchStatus.None;
    private ProjectScan scan = ProjectScan.Empty;

    public string Folder { get; }
    public TimeSpan ScanInterval { get; }
    public TimeSpan ProcessInterval { get; }

    /// <summary>The status changed (thread pool).</summary>
    public event Action<WatchStatus>? Changed;

    public ProjectWatcher(string folder, IProcessProbe? probe = null, TimeSpan? scanInterval = null, TimeSpan? processInterval = null)
    {
        Folder = Path.GetFullPath(folder);
        this.probe = probe ?? new SystemProcessProbe();
        ScanInterval = scanInterval ?? TimeSpan.FromSeconds(2);
        ProcessInterval = processInterval ?? TimeSpan.FromMilliseconds(300);
        StartFileWatcher();
        _ = Task.Run(Loop);
    }

    public WatchStatus Status
    {
        get
        {
            lock (gate) return status;
        }
    }

    /// <summary>The last scan (the times shown).</summary>
    public ProjectScan Scan
    {
        get
        {
            lock (gate) return scan;
        }
    }

    /// <summary>"I ran it": the learner ran the program in a way the app cannot see (WSL, a remote machine, a sandbox).</summary>
    public void MarkRan()
    {
        lock (gate) ranByHand = DateTime.UtcNow;
        Refresh();
    }

    /// <summary>Look again now (after the app wrote files, or when the window gets focus).</summary>
    public void Refresh()
    {
        rescan = true;
        try
        {
            wake.Release();
        }
        catch (SemaphoreFullException)
        {
            // Already woken.
        }
    }

    private void StartFileWatcher()
    {
        try
        {
            if (!Directory.Exists(Folder)) return;
            fsw = new FileSystemWatcher(Folder)
            {
                IncludeSubdirectories = true,
                NotifyFilter = NotifyFilters.FileName | NotifyFilters.DirectoryName | NotifyFilters.LastWrite | NotifyFilters.Size,
                InternalBufferSize = 64 * 1024,
            };
            FileSystemEventHandler changed = (_, _) => Refresh();
            fsw.Changed += changed;
            fsw.Created += changed;
            fsw.Deleted += changed;
            fsw.Renamed += (_, _) => Refresh();
            fsw.Error += (_, _) => Refresh();
            fsw.EnableRaisingEvents = true;
        }
        catch (Exception e) when (e is IOException or ArgumentException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            // Polling alone, then.
            fsw?.Dispose();
            fsw = null;
        }
    }

    private async Task Loop()
    {
        var lastScan = DateTime.MinValue;
        while (!stop.IsCancellationRequested)
        {
            try
            {
                if (rescan || DateTime.UtcNow - lastScan >= ScanInterval)
                {
                    // Let a burst of changes (an IDE saving several files, a build writing many) settle first.
                    if (rescan) await Task.Delay(150, stop.Token);
                    rescan = false;
                    var s = ProjectScan.Of(Folder, cache);
                    lock (gate) scan = s;
                    lastScan = DateTime.UtcNow;
                    if (fsw is null && s.FolderExists) StartFileWatcher();
                }
                var current = Scan;
                var before = Status;
                // Processes: often while the program is built and waiting to be run, else at the scan interval.
                if (current.Executables.Count > 0)
                {
                    var starts = probe.StartTimes(current.Executables);
                    if (starts.Count > 0)
                    {
                        var latest = starts.Max();
                        lock (gate)
                            if (lastProcessStart is not { } l || latest > l) lastProcessStart = latest;
                    }
                }
                WatchStatus next;
                lock (gate) next = status = WatchStatus.Evaluate(current, lastProcessStart, ranByHand);
                if (next != before) Changed?.Invoke(next);
                var wait = next.Built && !next.Ran ? ProcessInterval : ScanInterval;
                await wake.WaitAsync(wait, stop.Token);
            }
            catch (OperationCanceledException)
            {
                return;
            }
            catch (Exception e) when (e is IOException or UnauthorizedAccessException or InvalidOperationException)
            {
                try
                {
                    await Task.Delay(ScanInterval, stop.Token);
                }
                catch (OperationCanceledException)
                {
                    return;
                }
            }
        }
    }

    public void Dispose()
    {
        stop.Cancel();
        fsw?.Dispose();
    }
}
