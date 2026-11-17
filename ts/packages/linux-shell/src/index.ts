// The simulated Linux shell: parser, file system, commands, terminal. Port of Codestead.Shell and the logic of
// Codestead.Terminal; see docs/TYPESCRIPT-MIGRATION.md and PORTING.md.
//
// Classes and types are exported by name; the static C# classes (VfsLib, ParserLib, UsersLib ...) as namespaces,
// so that code reads like the C#: VfsLib.normalizePath(...), ServicesLib.startUnit(...).

export { Js, NetRegex, type Obj } from "./Js.js";
export { parseJson, stringifyJson, toMap } from "./Json.js";
export { World } from "./World.js";
export * as ShellI18n from "./ShellI18n.js";
export * as WorldMigration from "./WorldMigration.js";
export * as InitfsLib from "./InitfsLib.js";
export * as KnownCommands from "./KnownCommands.js";

export { ArithError } from "./Arith/ArithError.js";
export type { ArithVars } from "./Arith/ArithVars.js";
export * as ArithLib from "./Arith/ArithLib.js";

export type { Block } from "./Disks/Block.js";
export { isDisk, type Disk } from "./Disks/Disk.js";
export type { DiskState } from "./Disks/DiskState.js";
export { copyFsFrom, type FsInfo } from "./Disks/FsInfo.js";
export type { Mount } from "./Disks/Mount.js";
export { isPartition, type Partition } from "./Disks/Partition.js";
export type { Usage } from "./Disks/Usage.js";
export * as DisksLib from "./Disks/DisksLib.js";

export type { Distro, Family } from "./Distros/Distro.js";
export type { FamilyInfo } from "./Distros/FamilyInfo.js";
export * as DistrosLib from "./Distros/DistrosLib.js";

export type { Copr } from "./Extrarepo/Copr.js";
export type { Ppa } from "./Extrarepo/Ppa.js";
export * as ExtrarepoLib from "./Extrarepo/ExtrarepoLib.js";

export * as FishLib from "./Fish/FishLib.js";

export type { DnsAnswer } from "./Network/DnsAnswer.js";
export type { HttpResponse } from "./Network/HttpResponse.js";
export type { Iface } from "./Network/Iface.js";
export type { IfaceInet } from "./Network/IfaceInet.js";
export type { IfaceInet6 } from "./Network/IfaceInet6.js";
export type { Listener } from "./Network/Listener.js";
export type { Page } from "./Network/Page.js";
export type { Resolved } from "./Network/Resolved.js";
export type { ResolvedFail } from "./Network/ResolvedFail.js";
export type { ResolvedOk } from "./Network/ResolvedOk.js";
export * as NetworkLib from "./Network/NetworkLib.js";

export type { PackageDef } from "./Packages/PackageDef.js";
export * as PackagesLib from "./Packages/PackagesLib.js";

export type * from "./Parser/Ast/index.js";
export type { Tok } from "./Parser/Tokens/Tok.js";
export { isCompound } from "./Parser/Ast/CompoundNode.js";
export { ParseError } from "./Parser/ParseError.js";
export * as ParserLib from "./Parser/ParserLib.js";

export type { Job } from "./Procs/Job.js";
export type { Proc } from "./Procs/Proc.js";
export type { ProcState } from "./Procs/ProcState.js";
export * as ProcsLib from "./Procs/ProcsLib.js";

export type { BootRecord } from "./Services/BootRecord.js";
export type { JournalCatalog } from "./Services/JournalCatalog.js";
export type { JournalEntry } from "./Services/JournalEntry.js";
export type { LinkChange } from "./Services/LinkChange.js";
export type { ParsedUnit } from "./Services/ParsedUnit.js";
export type { ServiceState } from "./Services/ServiceState.js";
export type { StartResult } from "./Services/StartResult.js";
export type { UnitRt } from "./Services/UnitRt.js";
export * as ServicesLib from "./Services/ServicesLib.js";

export type { ExecResult } from "./Shell/ExecResult.js";
export { ExpansionError } from "./Shell/ExpansionError.js";
export type { Pending } from "./Shell/Pending.js";
export type { ResolvedCommand } from "./Shell/ResolvedCommand.js";
export { Shell, type ExpandOptions } from "./Shell/Shell.js";
export * as ShellLib from "./Shell/ShellLib.js";
export { snapshotFromJson, snapshotToJson, type ShellSnapshot } from "./Shell/ShellSnapshot.js";
export { XIO } from "./Shell/XIO.js";

export type { ShellFrame, ShellMode } from "./Shellmode/ShellFrame.js";
export type { ShellFrameSaved } from "./Shellmode/ShellFrameSaved.js";
export * as ShellmodeLib from "./Shellmode/ShellmodeLib.js";

export { ControlSignal } from "./Signals/ControlSignal.js";
export { ExitSignal } from "./Signals/ExitSignal.js";
export { LimitError } from "./Signals/LimitError.js";
export { LoopSignal } from "./Signals/LoopSignal.js";
export { ReturnSignal } from "./Signals/ReturnSignal.js";
export * as SignalsLib from "./Signals/SignalsLib.js";

export { CmdCtx } from "./Types/CmdCtx.js";
export { withDef, type CommandDef, type CommandDefOverrides } from "./Types/CommandDef.js";
export { IO } from "./Types/IO.js";
export { Reader } from "./Types/Reader.js";
export { Sink } from "./Types/Sink.js";

export type { GroupEntry } from "./Users/GroupEntry.js";
export type { PasswdEntry } from "./Users/PasswdEntry.js";
export type { ShadowEntry } from "./Users/ShadowEntry.js";
export type { UserDb } from "./Users/UserDb.js";
export * as UsersLib from "./Users/UsersLib.js";

export { FsError, type FsErrorCode } from "./Vfs/FsError.js";
export type { FsNode } from "./Vfs/FsNode.js";
export type { User } from "./Vfs/User.js";
export { VFS } from "./Vfs/VFS.js";
export * as VfsLib from "./Vfs/VfsLib.js";

export * as IndexCmd from "./Commands/IndexCmd.js";
export * as RegexCmd from "./Commands/RegexCmd.js";
export * as UtilCmd from "./Commands/Util/UtilCmd.js";
export type { Input } from "./Commands/Util/Input.js";
export type { OptSpec } from "./Commands/Util/OptSpec.js";
export type { Opts } from "./Commands/Util/Opts.js";
export * as ManEnCmd from "./Commands/Man/ManEnCmd.js";

export * as Ansi from "./Terminal/Ansi.js";
export type { AnsiSegment } from "./Terminal/AnsiSegment.js";
export { ShellSandbox } from "./Terminal/ShellSandbox.js";
