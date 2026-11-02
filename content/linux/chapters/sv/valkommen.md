# Välkommen till Linux-shell

Den här guiden lär dig använda Linux från kommandoraden – från de allra första
kommandona till pakethantering i olika distributioner. Varje kapitel förklarar
ett område. Längs vägen finns korta **frågor** i texten; svara på dem så låses
terminalen till höger och kapitlets **uppgifter** upp. Uppgifterna bockas av
automatiskt när du gjort rätt. Det bästa sättet att lära sig är att *göra*:
läs, prova, gör fel, prova igen.

## Vad är Linux?

Strikt taget är **Linux** bara *kärnan* (engelska *kernel*): programmet som
pratar med hårdvaran och låter andra program dela på processor, minne och
diskar. Kärnan skapades av Linus Torvalds 1991 och är fri programvara.

För att få ett användbart system behövs mycket mer: ett skal, verktyg för att
hantera filer, en pakethanterare, kanske ett skrivbord. En **distribution**
(*distro*) är ett färdigt paket av allt detta. Debian, Ubuntu, Arch Linux och
Fedora är några kända exempel.

Det mesta du lär dig i den här guiden fungerar likadant i alla distributioner,
så det är där kursen börjar. Terminalen här kör **Ubuntu 24.04 LTS**.
Distributionerna skiljer sig främst i hur man installerar program – det kommer
i kapitlet om distributioner.

## Vad är ett shell?

Ett **shell** (*skal*) är programmet som läser kommandona du skriver och kör
dem. Det vanligaste skalet heter **bash** och är standard i nästan alla
distributioner. Andra populära skal är **zsh** (standard på macOS) och
**fish**. Grunderna är desamma i alla.

Lägg märke till skillnaden mellan *terminal* och *shell*: terminalen är
fönstret som visar text, skalet är programmet som körs inuti det.

```quiz
Du skriver `ls` och trycker Enter. Vilket program läser kommandot och kör det?
- [ ] Terminalen
- [x] Skalet
- [ ] Kärnan
---
Terminalen visar bara texten. Skalet (här bash) läser det du skriver och kör
det.
```

## Prompten

När skalet väntar på ett kommando visar det en **prompt**. I terminalen här ser
den ut så här:

```text
{{user}}@ubuntu:~$
```

Den berättar vem du är (`{{user}}`), vilken dator du är på (`ubuntu`) och var i
filsystemet du står (`~` betyder din hemkatalog). Tecknet `$` visar att du är
en vanlig användare. Är du administratör (*root*) visas `#` i stället.

```quiz
Prompten slutar med `#` i stället för `$`. Vad betyder det?
- [ ] Du står i din hemkatalog
- [ ] Det förra kommandot misslyckades
- [x] Du är administratören, root
```

## Ditt första kommando

Klicka i terminalen, skriv kommandot nedan och tryck **Enter**:

```sh
echo {{helloWorld}}
```

`echo` skriver helt enkelt ut det du ger det. De flesta kommandon har samma
uppbyggnad:

```text
kommando  -flaggor  argument
ls        -l        /etc
```

*Kommandot* är programmet som ska köras, *flaggor* (eller *optioner*) ändrar
hur det beter sig och *argumenten* är det som kommandot ska arbeta med.

```quiz
Vilken del av kommandot `ls -l /etc` är **flaggan**?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` är kommandot, `-l` ändrar hur det beter sig och `/etc` är argumentet –
det som `ls` ska arbeta med.
```

Prova `echo` med en egen text:

```try
echo Linux is fun
---
`echo` skrev ut precis de ord du gav det.
```

## Vem och var är jag?

Två små kommandon berättar om systemet du är på. `whoami` skriver ut namnet på
användaren du är inloggad som. Filen `/etc/os-release` beskriver
distributionen, och `cat` skriver ut en fil (mer om `cat` i ett senare kapitel):

```sh
whoami
cat /etc/os-release
```

## Så fungerar simulatorn

Terminalen här är en **simulator** som körs helt inuti den här appen. Den beter
sig som en riktig Linux-dator, men inget du gör kan skada din egen dator – och
gör du något dumt kan du alltid börja om med *Återställ terminalen* i
inställningarna.

- **Klicka på ett kodexempel** så hamnar kommandot i terminalen.
- **Tab** kompletterar kommandon och filnamn.
- **Pil upp/ned** bläddrar bland tidigare kommandon.
- **Ctrl+L** rensar skärmen och **Ctrl+C** avbryter raden du skriver på.
- `help` listar alla kommandon och `man kommando` visar en manual.

```quiz
Du har skrivit `ech` och trycker **Tab**. Vad händer?
- [ ] Raden avbryts
- [x] Skalet försöker fylla i resten av namnet
- [ ] Skärmen rensas
---
Tab kompletterar kommandon och filnamn. **Ctrl+C** avbryter raden och
**Ctrl+L** rensar skärmen.
```
