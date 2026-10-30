# Välkommen till Linux-shell

Den här guiden lär dig använda Linux från kommandoraden – från de allra första
kommandona till pakethantering i olika distributioner. Varje kapitel förklarar
ett område och avslutas med **uppgifter** som du löser i terminalen till höger.
Uppgifterna bockas av automatiskt när du gjort rätt. Det bästa sättet att lära
sig är att *göra*: läs, prova, gör fel, prova igen.

## Vad är Linux?

Strikt taget är **Linux** bara *kärnan* (engelska *kernel*): programmet som
pratar med hårdvaran och låter andra program dela på processor, minne och
diskar. Kärnan skapades av Linus Torvalds 1991 och är fri programvara.

För att få ett användbart system behövs mycket mer: ett skal, verktyg för att
hantera filer, en pakethanterare, kanske ett skrivbord. En **distribution**
(*distro*) är ett färdigt paket av allt detta. Du kör just nu **{{distro}}**.

Distributionerna delas in i *familjer* som bygger på varandra och delar
pakethanterare:

| Familj | Pakethanterare | Exempel |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

Det mesta du lär dig i den här guiden fungerar likadant överallt. Det som
skiljer – främst pakethanteringen – har egna kapitel. Du kan byta distribution
när som helst i menyn högst upp.

## Vad är ett shell?

Ett **shell** (*skal*) är programmet som läser kommandona du skriver och kör
dem. Det vanligaste skalet heter **bash** och är standard i nästan alla
distributioner. Andra populära skal är **zsh** (standard på macOS) och
**fish**. Grunderna är desamma i alla.

Lägg märke till skillnaden mellan *terminal* och *shell*: terminalen är
fönstret som visar text, skalet är programmet som körs inuti det.

## Prompten

När skalet väntar på ett kommando visar det en **prompt**. I {{distro}} ser den
ut ungefär så här:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

Den berättar vem du är (`elev`), vilken dator du är på (`{{hostname}}`) och var
i filsystemet du står (`~` betyder din hemkatalog). Tecknet `$` visar att du
är en vanlig användare. Är du administratör (*root*) visas `#` i stället.

## Ditt första kommando

Klicka i terminalen, skriv kommandot nedan och tryck **Enter**:

```sh
echo Hej världen
```

`echo` skriver helt enkelt ut det du ger det. De flesta kommandon har samma
uppbyggnad:

```text
kommando  -flaggor  argument
ls        -l        /etc
```

*Kommandot* är programmet som ska köras, *flaggor* (eller *optioner*) ändrar
hur det beter sig och *argumenten* är det som kommandot ska arbeta med.

## Så fungerar simulatorn

Terminalen här är en **simulator** som körs helt i din webbläsare. Den beter
sig som en riktig Linux-dator, men inget du gör kan skada din egen dator – och
gör du något dumt kan du alltid återställa den med knappen *Återställ*.

- **Klicka på ett kodexempel** så hamnar kommandot i terminalen.
- **Tab** kompletterar kommandon och filnamn.
- **Pil upp/ned** bläddrar bland tidigare kommandon.
- **Ctrl+L** rensar skärmen och **Ctrl+C** avbryter raden du skriver på.
- `help` listar alla kommandon och `man kommando` visar en manual.
