// TEMPORARY STUB – deleted by the agent that ports the real module (see docs/PORTING.md).
// It only exists so the core compiles before that module has been ported.
namespace Codestead.Shell;

public partial class ServiceState { }

public static partial class ServicesLib
{
    public static ServiceState InitialServices(Shell sh) => new();
}
