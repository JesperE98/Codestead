// TEMPORARY STUB – needed by Commands/SystemCmd.cs (hostname -I) until network.ts is ported
// (see docs/PORTING.md). Delete this file when Network.cs exists.
namespace Codestead.Shell;

public static partial class NetworkLib
{
    public static string MyIp(Shell sh) => throw new NotImplementedException();
}
