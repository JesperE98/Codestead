# Faktagranskning: lankar (Links and file information)

Status: **ogranskad**

Källtext: `content/linux/chapters/en/lankar.md` (inklusive kontrollfrågorna).

| Påstående | Källa | Status | Datum |
|---|---|---|---|
| En fils innehåll, ägare, rättigheter och tider lagras i en inod; katalogen innehåller namn som pekar på inoder | https://man7.org/linux/man-pages/man7/inode.7.html | ogranskad | |
| `ls -i` visar inodnumret | https://man7.org/linux/man-pages/man1/ls.1.html – `-i, --inode` | ogranskad | |
| `ln -s MÅL NAMN` skapar en symbolisk länk; målet först | https://man7.org/linux/man-pages/man1/ln.1.html | ogranskad | |
| `ls -l` visar en länk med `l` och `->`, och länkens rättigheter är `rwxrwxrwx` och används inte | https://man7.org/linux/man-pages/man7/symlink.7.html | ogranskad | |
| En relativ sökväg i en symbolisk länk tolkas från katalogen där länken ligger | https://man7.org/linux/man-pages/man7/symlink.7.html | ogranskad | |
| `cd` följer länken och `pwd` visar den logiska vägen; `pwd -P` den fysiska | https://www.gnu.org/software/bash/manual/bash.html#index-pwd | ogranskad | |
| `readlink` skriver ut länkens innehåll; `realpath` den kanoniska sökvägen | https://man7.org/linux/man-pages/man1/readlink.1.html, https://man7.org/linux/man-pages/man1/realpath.1.html | ogranskad | |
| `cat` på en trasig länk ger *No such file or directory* (kontrollfråga) | | ogranskad | |
| `rm` tar bort länken, inte målet | https://man7.org/linux/man-pages/man2/unlink.2.html | ogranskad | |
| `find -type l` hittar symboliska länkar | https://man7.org/linux/man-pages/man1/find.1.html – `-type c` | ogranskad | |
| `systemctl enable` skapar symboliska länkar till unit-filen | https://www.freedesktop.org/software/systemd/man/latest/systemctl.html – `enable` | ogranskad | |
| `ln` utan `-s` skapar en hård länk; antalet länkar visas i `ls -l` | https://man7.org/linux/man-pages/man1/ln.1.html, https://man7.org/linux/man-pages/man2/link.2.html | ogranskad | |
| Hårda länkar till kataloger är inte tillåtna och kan inte gå mellan filsystem | https://man7.org/linux/man-pages/man2/link.2.html – `EPERM`, `EXDEV` | ogranskad | |
| Innehållet finns kvar så länge filen har minst ett namn | https://man7.org/linux/man-pages/man2/unlink.2.html | ogranskad | |
| `stat` visar storlek, inod, länkar, rättigheter, ägare och tider; `-c` med `%a`, `%U`, `%n` | https://man7.org/linux/man-pages/man1/stat.1.html | ogranskad | |
| `/etc/shadow` har rättigheterna 640 och ägs av root i Ubuntu (kontrollfråga) | | ogranskad | |
| `file` avgör filtypen från innehållet, inte från namnet | https://man7.org/linux/man-pages/man1/file.1.html | ogranskad | |
| Nya filer utgår från 666 och kataloger från 777, minus umask | https://man7.org/linux/man-pages/man2/umask.2.html | ogranskad | |
| `umask` 022 ger 644/755, 027 ger 640/750, 077 ger 600/700 | https://www.gnu.org/software/bash/manual/bash.html#index-umask | ogranskad | |
| umask gäller skalet och det som startas därifrån; läggs i `~/.bashrc` för att gälla varje gång | | ogranskad | |
