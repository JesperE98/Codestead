# Resumo: Distribuições e pacotes

## Famílias

O básico é igual em todas as distribuições: o kernel Linux, o bash e as
ferramentas GNU, a estrutura de diretórios e (quase em todo lugar) o systemd.
O que diferencia as famílias é principalmente a forma de instalar programas.

| | Família Debian | Família Arch | Família Red Hat |
|---|---|---|---|
| Exemplos | Debian, Ubuntu, Linux Mint | Arch, Manjaro, EndeavourOS | Fedora, RHEL, Rocky Linux |
| Gerenciador de pacotes | `apt` | `pacman` | `dnf` |
| Formato de pacote | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Ferramenta de baixo nível | `dpkg` | (pacman) | `rpm` |
| Grupo do sudo | `sudo` | `wheel` | `wheel` |
| Lançamentos | Versões estáveis | Contínuos (*rolling*) | Uma versão nova a cada 6 meses (Fedora) |

- O `cat /etc/os-release` mostra qual distribuição você está usando, e o
  `uname -r` mostra a versão do kernel.
- Um **pacote** é um programa empacotado em um arquivo, um **repositório** é
  um servidor com os pacotes testados e assinados da distribuição, e uma
  **dependência** é outro pacote que é necessário – o gerenciador de pacotes
  o instala automaticamente.
- Comandos que alteram o sistema exigem root, por isso são executados com
  `sudo`.

## A mesma coisa – três dialetos

| O quê | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Atualizar a lista de pacotes | `apt update` | `pacman -Sy` | `dnf check-update` |
| Atualizar tudo | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Instalar | `apt install X` | `pacman -S X` | `dnf install X` |
| Remover | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Pesquisar | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Informações do pacote | `apt show X` | `pacman -Si X` | `dnf info X` |
| Listar os instalados | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Para lembrar:

- **apt**: o `apt update` só baixa a lista de pacotes – o `apt upgrade`
  instala as versões novas. Execute o `update` primeiro. `[Y/n]` significa
  que o Enter responde sim.
- **pacman**: a letra maiúscula é a operação (`-S`, `-R`, `-Q`) e as letras
  minúsculas são modificadores. Atualize sempre com `-Syu` – nunca `-Sy`
  seguido de `-S pacote` (uma atualização parcial pode quebrar o sistema).
- **dnf**: busca as informações dos pacotes sozinho. O `dnf check-update`
  termina com `100` quando há atualizações. `[y/N]` significa que o Enter
  responde **não**.

Os nomes dos pacotes costumam ser os mesmos em todo lugar, mas nem sempre – o
Vim se chama `vim-enhanced` no Fedora. Pesquise se estiver em dúvida.

## Repositórios extras

| | PPA | AUR | COPR |
|---|---|---|---|
| Família | Ubuntu (e, por exemplo, Linux Mint) | Arch (e, por exemplo, Manjaro, EndeavourOS) | Fedora (e a família RHEL) |
| O que você baixa | Pacotes `.deb` prontos | Uma receita de build (`PKGBUILD`) – você mesmo compila | Pacotes `.rpm` prontos |
| Como adicionar | `add-apt-repository ppa:…` | `git clone …` e `makepkg -si` | `dnf copr enable …` |
| Atualizado com | `sudo apt update && sudo apt upgrade` | `yay -Syu` – ou compilando de novo você mesmo | `sudo dnf upgrade` |
| Remover o repositório | `sudo add-apt-repository --remove ppa:…` | – (não há repositório para remover) | `sudo dnf copr remove …` |
| Revisado pela distribuição | Não | Não | Não |

- Pacotes de um repositório extra são instalados como root, podem entrar em
  conflito com os pacotes do próprio sistema e podem deixar de receber
  atualizações. Procure primeiro nos repositórios da distribuição, depois um
  Flatpak, e só depois disso em um repositório extra de alguém em quem você
  confia.
- O `apt policy` mostra de onde vem um pacote; o apt escolhe a versão mais
  alta.
- Leia sempre o `PKGBUILD` antes de compilar. Não execute o `makepkg` com
  sudo. O `pacman -Qm` lista os pacotes *foreign* (estrangeiros), e o
  `pacman -Syu` não os atualiza – um AUR helper como o `yay` faz isso.

## Pacotes universais

| | Flatpak | Snap | AppImage |
|---|---|---|---|
| Vem de | Flathub (ou outros *remotes*) | Snap Store (Canonical) | O site do desenvolvedor |
| Sandbox | Sim | Sim (menos *classic*) | Não |
| Atualizações | `flatpak update` | Automaticamente em segundo plano | Você mesmo – baixe um arquivo novo |
| Instalar | `flatpak install flathub ID` | `sudo snap install name` | `chmod +x file` e execute |

- Os programas Flatpak têm um ID escrito como um nome de domínio invertido
  (`org.gimp.GIMP`) e são iniciados com `flatpak run`. O `--user` instala no
  seu diretório pessoal, com os seus próprios remotes.
- O Snap é o padrão no Ubuntu. Snaps com classic confinement precisam de
  `--classic`, e todo snap tem canais como `stable` e `edge`.
- Um AppImage precisa do FUSE 2 (`libfuse2t64` no Ubuntu 24.04 e no
  Debian 13, `fuse2` no Arch, `fuse-libs` no Fedora) e não tem sandbox nem
  atualizações automáticas.

**Regra prática:** os pacotes da distribuição para programas do sistema e de
linha de comando, Flatpak para programas de desktop, Snap no Ubuntu ou quando
um programa só existe como snap, e AppImage para experimentar um programa
rapidamente.
