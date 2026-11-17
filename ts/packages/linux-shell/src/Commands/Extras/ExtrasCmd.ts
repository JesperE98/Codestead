// Port of Commands/Extras/ExtrasCmd.cs – STUB from wave 1.
// C#: Port of src/shell/commands/extras.ts – programs that are not preinstalled but installed with the package manager: tree, htop, fastfetch, cowsay, python3, vim, nano. (curl, wget and ssh live in NetCmd.cs and SshCmd.cs.)
//
// Wave 2 ports this group: the root file (the C# ExtrasCmd.cs: shared helpers and the command list) replaces this
// stub, and each command file ExtrasCmd.<Name>.cs becomes ExtrasCmd.<Name>.ts. See PORTING.md.

import type { CommandDef } from "../../Types/CommandDef.js";

/**
 * The group's commands, in the C# order:
 * Tree, Htop, Fastfetch, Cowsay, Python3, Editor("vim", "Kraftfull texteditor", """ NAMN vim - Vi IMproved, en kraftfull texteditor BESKRIVNING vim har lägen: tryck i för att skriva, Esc för att gå tillbaka, :w för att spara och :q för att avsluta (:q! utan att spara). """), Editor("vi", "Texteditor (oftast vim i ett enklare läge)", """ NAMN vi - den klassiska texteditorn i Unix BESKRIVNING I de flesta distributioner startar vi en enkel variant av vim. Samma knappar gäller: i för att skriva, Esc, :w för att spara och :q för att avsluta (:wq sparar och avslutar). """), Editor("nano", "Enkel texteditor", """ NAMN nano - en enkel texteditor BESKRIVNING Kommandona visas längst ner: ^O betyder Ctrl+O (spara) och ^X betyder Ctrl+X (avsluta). """)
 */
export function all(): CommandDef[] {
  return [];
}
