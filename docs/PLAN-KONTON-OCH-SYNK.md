# Plan: konto med e-post och synk av framsteg (Supabase)

Status: etapp 1 (sammanslagning och synkmotor i `ts/packages/sync`) är byggd. Skrivet 2026-11-27.

## Mål

En elev kan logga in med sin e-post och få samma framsteg på alla sina datorer: klarade uppgifter, prov, XP,
utmärkelser och dagar i rad, plus koden i GP:s inbyggda editor och terminalens filer i Codestead Linux. Allt ska
fortsätta fungera precis som i dag utan konto och utan nät.

**Inte med i första versionen:** elevens egna projektmappar på disken (GP:s "öppna i din IDE"), delning mellan
elever, lärarvy och inloggning med Google, Apple eller GitHub.

## Hur det fungerar i dag

- Varje verktyg sparar små JSON-filer i `%APPDATA%\Codestead\<verktyg>\` (`~/.config/Codestead/<verktyg>/` på
  Linux) genom gränssnittet `Storage` (`ts/packages/ui/src/Storage.ts`), med `FileStorage` i varje app.
- Filerna har samma form som de gamla C#-apparna skrev, och tester kontrollerar det byte för byte. **Synken får inte
  ändra filernas format.** All synkdata läggs därför i egna filer.
- Hubben startar verktygen som egna processer (`ToolStore.spawn`) och vet när de avslutas.
- Det finns ingen server. Det enda som pratar med nätet är hubbens uppdateringskontroll mot GitHub.

## Övergripande upplägg

1. **Hubben sköter konto och synk för alla verktyg.** Eleven loggar in en gång, i hubben. Verktygen behöver inte
   ändras i första versionen.
2. **Inloggning med en sexsiffrig kod via e-post** (Supabase Auth, e-post-OTP), utan lösenord. En kod fungerar bättre
   än en magisk länk i en skrivbordsapp, eftersom länken annars måste kunna öppna appen.
3. **Synken läser och skriver verktygens vanliga filer** när verktyget inte körs: när hubben startar, precis innan
   ett verktyg öppnas, när det stängts och med jämna mellanrum.
4. **Sammanslagning i tre steg i stället för att skriva över.** Hubben sparar den senast synkade versionen av varje
   fil (basen) och jämför både den lokala och den sparade versionen med basen. Det som har ändrats på var sida tas
   med. Då kan man spela offline på två datorer utan att tappa något, och "Radera alla framsteg" fungerar ändå.

## Vad synkas

| Fil | Synkas | Hur |
|---|---|---|
| `<verktyg>/state.json` | ja | Sammanslagning fält för fält (se nedan) |
| `codestead-gp/project.*.json` (koden i editorn) | ja | Hela filen, senast ändrad vinner; den andra sparas som säkerhetskopia |
| `codestead-linux/shell.*.json` (terminalens filer) | ja | Som ovan |
| `<verktyg>/profile.json` | nej | Räknas fram av verktyget ur `state.json` |
| `whatsnew.json` | nej | Hör till datorn |
| `codestead-gp/folders.json`, `ide.json`, `mainfiles.json` | nej | Sökvägar på just den datorn |
| `codestead-hub/state.json` | nej | Datorns inställningar (autostart, tray och så vidare) |

## Sammanslagning av `state.json`

Basen `B` är den senast synkade versionen, `L` den lokala och `R` den på servern. För varje fält gäller:

- **Mängder och listor** (`progress`, `checkpoints`, `read`, `hintSeen`, `game.completedChapters`,
  `game.unaided`, `game.solutionSeen` och de andra listorna i `GameState`): en nyckel finns kvar om den finns i
  `L` eller `R`, utom om den fanns i `B` och någon av sidorna har tagit bort den. Så sprids en återställning.
- **Tal där högst gäller** (`exams`, `attempts`, `game.bestStreak`, `game.stats.longestPipe`): om båda sidor
  ändrat tas det högsta, annars den sida som ändrats.
- **Räknare i `game.stats`** (`commands`, `pipes`, `chapterSeconds` och så vidare): det båda sidor räknat sedan
  basen läggs ihop. Har en sida återställts räknas bara det som kommit till efter det. Utan bas (första synken)
  tas det högsta, eftersom det inte går att veta vad sidorna har gemensamt.
- **`game.achievements`:** som en mängd, och vid krock det tidigaste datumet.
- **`game.streak` och `lastActiveDay`:** de tas från den sida som har senast `lastActiveDay`.
- **`game.xp`:** tas inte med i sammanslagningen. Verktyget räknar fram det igen med `GameRules.sync` när det
  startar.
- **`lang`, `theme`, `distro` och `chapter`:** den senast ändrade sidan vinner.
- **Återställning åt båda håll:** om `L` är helt tom jämfört med `B` (eleven har raderat allt) och `R` inte har
  ändrats sedan `B`, blir resultatet tomt. Har `R` ändrats under tiden tas bara det som är nytt i `R` med.
- **Första inloggningen på en dator** har ingen bas, så allt från båda sidor slås ihop. Inget går förlorat.

Sammanslagningen är rena funktioner utan nät, och det är där testerna läggs.

## Datamodell i Supabase

En enda tabell räcker:

```sql
create table public.documents (
  user_id    uuid        not null references auth.users on delete cascade,
  tool       text        not null,          -- "codestead-gp", "codestead-linux"
  name       text        not null,          -- "state", "project.opengl.introduction"
  content    text        not null,          -- filens text som den är (jsonb skulle sortera om nycklarna)
  revision   bigint      not null default 1,
  device     text,
  updated_at timestamptz not null default now(),
  primary key (user_id, tool, name)
);
alter table public.documents enable row level security;
create policy "own rows" on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
```

- **Skrivning med versionskontroll:** en funktion `put_document(tool, name, content, expected_revision)` skriver
  bara om `revision` fortfarande är den hubben läste. Annars hämtar hubben den nya versionen, slår ihop och försöker
  igen. Då kan två datorer aldrig skriva över varandra.
- **Gränser:** högst cirka 1 MB per dokument, och bara kända värden på `tool` och mönstret för `name`
  (kontrolleras i funktionen).
- **Radera konto:** en Edge Function `delete-account` tar bort användaren. Raderna försvinner med `on delete cascade`.
- Migreringarna läggs i `supabase/migrations/` i repot, så att databasen går att återskapa.

## Säkerhet och GDPR

- Appen innehåller bara projektets URL och den publika `anon`-nyckeln. Det är säkert eftersom RLS bara släpper
  igenom elevens egna rader. `service_role`-nyckeln används aldrig i appen.
- Inloggningen sparas krypterad med Electrons `safeStorage` i hubbens datamapp.
- Projektet läggs i en EU-region, till exempel Stockholm (`eu-north-1`) eller Frankfurt.
- **E-post:** Supabases inbyggda e-postutskick klarar bara några få mejl i timmen och är tänkt för test. Till skarp
  drift behövs egen SMTP (till exempel Resend eller Postmark) med en avsändaradress på en egen domän.
  E-postmallen finns på ett språk. Antingen skrivs den på engelska och svenska i samma mejl, eller så skickas
  språket med och mallen väljer text.
- **Integritetspolicy:** en kort sida om vad som sparas (e-post och framsteg), var det sparas, hur man raderar det och
  vem man kontaktar. Den länkas från inloggningsrutan.
- **Radera konto** finns i hubben. Den lokala datan finns kvar på datorn.

## Gränssnitt i hubben

- Under Inställningar finns ett nytt avsnitt, **Konto**. Utloggad: e-postfält, sedan kodfält. Inloggad:
  e-postadressen, "Senast synkad …", **Synka nu**, **Logga ut** och **Radera konto**.
- En liten statusikon visar om synken är klar, pågår eller saknar nät.
- Efter den första synken på en ny dator visas en kort ruta, till exempel "Dina framsteg från andra datorer har
  hämtats".
- Alla texter skrivs på alla 7 språk.

## Kodens struktur

- **Nytt paket `ts/packages/sync`:**
  - `merge/LearningStateMerge.ts`: sammanslagningen ovan.
  - `merge/WholeFileMerge.ts`: senast ändrad vinner, med säkerhetskopia.
  - `SyncEngine.ts`: går igenom varje verktygs filer, läser basen, hämtar, slår ihop, skriver och laddar upp.
  - `SyncBackend.ts`: ett gränssnitt med två implementationer, `MemoryBackend` för tester och `SupabaseBackend`.
  - Basen sparas i `%LOCALAPPDATA%\Codestead\sync\<verktyg>\<namn>.base.json`, skild från verktygens mappar.
- **Hubben:**
  - `src/core/Account.ts`: inloggning, utloggning och sparad session.
  - Utlösare för synk i `MainWindow.ts` och `ToolStore.ts`.
  - Kontovyn i `MainWindow.Settings.tsx`.
- **Beroende:** `@supabase/supabase-js` i hubben, som sköter förnyelse av inloggningen. Alternativet är tunna
  `fetch`-anrop genom befintliga `Http.ts`, men då får vi själva hantera tokenförnyelse.
- **Konfiguration:** Supabase-URL och `anon`-nyckel byggs in vid bygget, från CI-variabler. Utan dem är kontofunktionen
  dold, vilket också gäller utvecklingsbyggen och forkar.

## Etapper (en PR var)

1. **Sammanslagning och synkmotor** i `packages/sync`, med `MemoryBackend` och enhetstester. Inget nät och inget
   gränssnitt.
2. **Supabase:** migreringar, RLS, `put_document` och `delete-account`, plus ett skript som testar mot ett lokalt
   Supabase (`supabase start`).
3. **Inloggning i hubben:** `Account.ts`, kontovyn och sparad session, bakom en inställning som är avstängd som
   standard.
4. **Synk i hubben:** utlösare, statusikon och rutan efter första synken, med end-to-end-test mot `MemoryBackend`.
5. **Text och lansering:** alla 7 språk, integritetspolicy, ändringslogg för hubben och påslaget som standard.

## Det du behöver göra

- Skapa ett Supabase-projekt i en EU-region och ge mig projektets URL och `anon`-nyckel. Lägg dem som CI-variabler,
  inte i koden.
- Välja en e-posttjänst och en avsändardomän för skarp drift. Supabases egna utskick räcker under utvecklingen.
- Godkänna integritetspolicyns text och bestämma vilken kontaktadress som ska stå där.

## Öppna frågor

1. **Kan verktygen startas utan hubben**, till exempel från en egen genväg? I så fall synkas de först nästa gång
   hubben körs. Räcker det, eller ska verktygen själva kunna synka i en senare version?
2. **Ska språk och tema synkas**, eller ska de höra till datorn som hubbens övriga inställningar?
3. **Konflikter i editorkoden** (`project.*.json`): räcker "senast ändrad vinner, den andra blir säkerhetskopia",
   eller ska eleven få välja?
4. **De gamla C#-apparna** får ingen synk. Är det okej?
