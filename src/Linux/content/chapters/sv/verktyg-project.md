# Projekt: Packa dina dotfiles

Stora nyheter: nästa vecka får du en splitterny dator. Härligt – bortsett från att
allt du har ställt in på den här blir kvar. Dina alias, ditt namn i git, alla små
justeringar. De bor i små dolda filer i hemkatalogen, filer vars namn börjar med en
punkt. Därför kallas de *dotfiles* (punktfiler), och programmerare över hela
världen har sina i ett git-repo: på en ny dator klonar de det, och en minut senare
känner de sig hemma.

Dags att packa dina. Allt du behöver finns i *Fler verktyg* – git, och det du har
lärt dig om skal och deras inställningsfiler. Utmaningen är att sätta ihop det
själv.

## Uppdraget

1. **Skaffa en flyttlåda.** Skapa katalogen `~/{{dotfilesDir}}` och gör den till
   ett git-repo.
2. **Packa det du har.** Kopiera dina bash-inställningar `~/.bashrc` och dina
   git-inställningar `~/.gitconfig` till repot. Behåll punkten i namnet eller ta
   bort den – båda är vanliga.
3. **Lägg till något eget.** Skriv filen `{{aliasFile}}` i repot, med minst två
   alias som du skulle ha nytta av.
4. **Försegla lådan.** Gör en commit som innehåller båda kopiorna och
   `{{aliasFile}}`.
5. **Håll hemligheten utanför.** Lösenordet till wifi:t ska ligga i
   `~/{{dotfilesDir}}/{{secretFile}}` – men det får aldrig hamna i historiken.
   Dotfiles-repon är ofta offentliga! Skapa filen, få git att strunta i den och
   committa det som behövs för det.
6. **Experimentera på en gren.** Skapa grenen `{{aliasBranch}}`, lägg till minst
   ett alias till i `{{aliasFile}}` och committa det på grenen.
7. **Packa upp och använd.** De nya aliasen fungerar, så slå ihop `{{aliasBranch}}`
   med huvudgrenen. Läs sedan in `{{aliasFile}}` i skalet med `source` och kör ett
   av dina alias.

Delmålen i listan bredvid kontrolleras automatiskt när du kör dina kommandon.

## Tips på vägen

- `ls -a` visar de dolda filerna – de vars namn börjar med en punkt.
- Kör `git status` ofta. Den berättar vad som är nytt, vad som har ändrats och vad
  som kommer med i nästa commit.
- Ett alias skrivs `alias ll='ls -la'`, utan mellanslag runt `=`. Vill du skriva
  raden med `echo` sätter du dubbla citattecken utanför och enkla inuti.
- Säger git *Please tell me who you are*? Ställ då först in `user.name` och
  `user.email` med `git config --global`.
- `.gitignore` gäller bara filer som git inte redan följer. Råkade du committa
  lösenordet? `git rm --cached` tar bort det ur repot men låter det ligga kvar på
  disken. Den gamla commiten har det fortfarande – i verkligheten skulle du byta
  lösenord.
- `source` läser in filen i skalet du sitter i. zsh förstår samma alias-rader som
  bash, så filen fungerar i båda.

## Vill du göra mer?

När delmålen är klara finns det mer att packa. Lägg till raden
`source ~/{{dotfilesDir}}/{{aliasFile}}` i slutet av `~/.bashrc`, så att varje ny
terminal får dina alias. Kopiera också `~/.zshrc` eller fish-filen
`~/.config/fish/config.fish`, om du har dem. Och spela ny dator:
`git clone ~/{{dotfilesDir}} ~/ny-dator` – finns allt med? Och saknas
`{{secretFile}}` verkligen? Beundra till sist ditt verk med
`git log --oneline --graph --all`.
