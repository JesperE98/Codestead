# Flatpak, Snap e AppImage

Um pacote comum é feito para uma distribuição e uma versão específicas. Para
quem desenvolve um programa de desktop, isso é um problema: o mesmo programa
precisa ser empacotado de novo para Debian, Ubuntu, Fedora, Arch e todas as
versões delas. Os **formatos de pacote universais** resolvem isso colocando
dentro do pacote a maior parte do que o programa precisa – assim um único
pacote funciona em qualquer distribuição.

Os três grandes são **Flatpak**, **Snap** e **AppImage**. Eles não substituem
o gerenciador de pacotes da distribuição, mas o complementam, principalmente
para programas de desktop.

> O simulador só tem um terminal. Quando você inicia um programa gráfico,
> aparece uma linha dizendo que ele teria sido aberto em uma janela.

## Quatro jeitos de instalar um programa

| | Pacote da distribuição | Flatpak | Snap | AppImage |
|---|---|---|---|---|
| Vem de | Repositórios da distribuição | Flathub (ou outros *remotes*) | Snap Store (Canonical) | Site do desenvolvedor |
| Funciona em | Uma distribuição e versão | Todas | Todas que têm `snapd` | Todas (precisa de FUSE) |
| Sandbox | Não | Sim | Sim (menos *classic*) | Não |
| Tamanho | Pequeno – compartilha bibliotecas com o sistema | Grande da primeira vez (runtimes), depois compartilhado | Grande – cada snap e a sua base | Grande – tudo em um arquivo |
| Atualizações | Junto com o sistema (`apt upgrade` …) | `flatpak update` | Automaticamente, em segundo plano | Por sua conta – baixe um arquivo novo |
| Bom para | Programas do sistema, ferramentas de linha de comando, servidores | Programas de desktop | Ubuntu, desktops e servidores | Programas avulsos, testar versões novas |

Uma **sandbox** (caixa de areia) significa que o programa só alcança aquilo
que recebeu permissão para acessar, por exemplo a rede ou a sua pasta de
downloads, em vez do seu diretório pessoal inteiro.

```quiz
Qual formato é atualizado automaticamente em segundo plano?
- [ ] Flatpak
- [x] Snap
- [ ] AppImage
---
Os programas Flatpak são atualizados com `flatpak update`, e um AppImage é
substituído baixando um arquivo novo.
```

## Flatpak

O Flatpak é o formato com que a maioria das distribuições concordou para
programas de desktop. Os programas são baixados de um **remote** – quase
sempre o **Flathub** – e compartilham **runtimes** em comum (por exemplo
`org.gnome.Platform`), para que nem todo programa precise trazer tudo junto.

:::debian
### Instalando o Flatpak

O Flatpak não vem pré-instalado no {{distro}}:

```sh
sudo apt update
sudo apt install flatpak
```
:::

:::arch
### Instalando o Flatpak

O Flatpak está nos repositórios do Arch:

```sh
sudo pacman -S flatpak
```
:::

:::redhat
### Flatpak no {{distro}}

O Fedora Workstation já vem com o Flatpak, com o remote do próprio Fedora,
`fedora`, já adicionado:

```sh
flatpak --version
flatpak remotes
```
:::

### Adicionando o Flathub

```sh
flatpak remote-add --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak remotes
```

`--if-not-exists` faz o comando não falhar se o Flathub já estiver lá – útil
em scripts e guias de instalação.

### Pesquisando, instalando e executando

Todo programa tem um **ID** escrito como um nome de domínio invertido, por
exemplo `org.gimp.GIMP`:

```sh
flatpak search gimp
flatpak install flathub org.gimp.GIMP
```

O Flatpak mostra quais **permissões** o programa quer e quais runtimes vêm
junto. Repare no tamanho: o primeiro programa puxa um runtime de várias
centenas de megabytes, mas o próximo programa que usa o mesmo runtime é
pequeno.

```sh
flatpak list
flatpak run org.gimp.GIMP
flatpak info --show-permissions org.gimp.GIMP
```

### Para o sistema inteiro ou só para você

Sem opções, o Flatpak instala para o **sistema inteiro** (em
`/var/lib/flatpak`). Em um desktop, o Flatpak pede a sua senha em uma janela,
então não é preciso usar sudo. Com `--user`, o programa vai para o seu
diretório pessoal (`~/.local/share/flatpak`) e nenhum outro usuário o vê. A
instalação de usuário tem **os seus próprios remotes**, então o Flathub
também precisa ser adicionado com `--user`:

```sh
flatpak remote-add --user --if-not-exists flathub https://dl.flathub.org/repo/flathub.flatpakrepo
flatpak install --user flathub org.videolan.VLC
flatpak list --user
```

```quiz
O que acontece quando você instala um Flatpak com `--user`?
- [ ] Ele é instalado para o sistema inteiro, em `/var/lib/flatpak`
- [x] Ele vai parar no seu diretório pessoal, e nenhum outro usuário o vê
- [ ] Ele roda sem sandbox
---
Lembre-se de que a instalação de usuário tem os próprios remotes – o Flathub
também precisa ser adicionado com `--user`.
```

### Atualizando e removendo

```sh
flatpak update
flatpak uninstall --user org.videolan.VLC
flatpak uninstall --unused
```

`--unused` remove runtimes que nenhum programa instalado usa mais.

## Snap

O Snap é o formato da **Canonical** e o padrão no Ubuntu – lá, por exemplo, o
Firefox é um snap. Os snaps vêm da **Snap Store**, mantida pela Canonical, e
são gerenciados pelo serviço `snapd`. Eles são atualizados automaticamente em
segundo plano.

:::debian
### Snap no Ubuntu e no Debian

O Ubuntu já tem o Snap. No Debian, você instala o `snapd` primeiro:

```sh
sudo apt update
sudo apt install snapd
```
:::

:::arch
### Snap no Arch

O Snap não está nos repositórios do Arch – só no AUR. Compile-o como no
capítulo sobre a família Arch:

```sh
sudo pacman -S --needed git base-devel
cd ~
git clone https://aur.archlinux.org/snapd.git
cd snapd
makepkg -si
```

Em um sistema de verdade, você também precisa iniciar o serviço com
`sudo systemctl enable --now snapd.socket`. Isso mostra que o Snap não se
sente em casa no Arch: a maioria das pessoas lá usa Flatpak.
:::

:::redhat
### Snap no Fedora

O Fedora aposta no Flatpak, mas o Snap está nos repositórios:

```sh
sudo dnf install snapd
```
:::

### Usando o snap

```sh
snap list
snap find vlc
sudo snap install hello-world
hello-world
snap info hello-world
```

Os snaps instalados aparecem como programas em `/snap/bin`. Instalar e
remover exige root.

### Strict ou classic

A maioria dos snaps roda de forma **estrita** (*strict*), em uma sandbox.
Programas que precisam de acesso ao sistema inteiro, como editores de código,
são publicados com **classic confinement**. Nesse caso você mesmo precisa
aprovar isso com `--classic`:

```sh
sudo snap install code
sudo snap install code --classic
```

```quiz
Um snap é publicado com classic confinement. O que você precisa acrescentar
para instalá-lo?
- [ ] `--user`
- [x] `--classic`
- [ ] `--channel=edge`
```

### Canais e atualizações

Todo snap tem **canais** (*channels*): `stable`, `candidate`, `beta` e `edge`
(a versão mais recente, não testada). O `snap info` mostra os canais e
`--channel=beta` escolhe outro. As atualizações acontecem automaticamente,
mas você pode forçá-las e remover snaps:

```sh
sudo snap refresh
sudo snap remove hello-world
```

O Snap também tem críticos: a Snap Store é mantida só pela Canonical, as
atualizações automáticas não podem ser desligadas por completo e os programas
podem demorar para abrir da primeira vez.

## AppImage

Um **AppImage** é um programa inteiro em **um único arquivo**. Você o baixa do
site do programa, torna-o executável e o inicia – sem instalação e sem root.
Para se livrar do programa, basta apagar o arquivo.

Já existe um AppImage baixado no seu diretório pessoal, em `~/{{downloads}}`:

```sh
cd ~/{{downloads}}
ls -l
```

```text
total 47184
-rw-r--r-- 1 {{user}} {{user}} 48312832 Oct 30 12:00 {{calculator}}
```

As mensagens de erro do bash têm o formato `bash: CAMINHO: MOTIVO`, e o
caminho aparece do jeito que o bash o vê – com o `~` já substituído por
`/home/{{user}}`. O que acontece se você iniciar o arquivo na hora?

```predict
$ ~/{{downloads}}/{{calculator}}
bash: /home/{{user}}/{{downloads}}/{{calculator}}: Permission denied
---
O arquivo não tem a permissão `x`.
```

Arquivos baixados nunca são executáveis de início. Torne-o executável e
inicie-o:

```sh
chmod +x {{calculator}}
./{{calculator}}
```

```try
chmod +x ~/{{downloads}}/{{calculator}}
---
Agora o arquivo é executável. Confira com `ls -l ~/{{downloads}}`.
```

### FUSE

Um AppImage se monta como um sistema de arquivos usando o **FUSE** e precisa
da versão 2, mais antiga, da biblioteca (`libfuse.so.2`). Sem ela você recebe
o erro *"AppImages require FUSE to run"*.

:::debian
No Ubuntu 24.04 e no Debian 13, o pacote se chama `libfuse2t64` (o *t64* vem
da transição para tempo de 64 bits; em versões mais antigas ele se chamava
`libfuse2`):

```sh
sudo apt update
sudo apt install libfuse2t64
./{{calculator}}
```

> **Não** instale o pacote `fuse` no Ubuntu – ele substitui o `fuse3`, de que
> o desktop precisa.
:::

:::arch
No Arch, o pacote se chama `fuse2`:

```sh
sudo pacman -S fuse2
./{{calculator}}
```
:::

:::redhat
No Fedora, o pacote se chama `fuse-libs`:

```sh
sudo dnf install fuse-libs
./{{calculator}}
```
:::

### Olhando por dentro

Um AppImage também pode ser descompactado. Isso funciona até sem FUSE:

```sh
./{{calculator}} --appimage-extract
ls squashfs-root
./squashfs-root/AppRun
```

`--appimage-extract-and-run` descompacta temporariamente e inicia na hora.

### Tenha em mente

- O AppImage **não tem sandbox** – o programa roda como você e alcança tudo
  que você alcança. Só baixe do site oficial do programa.
- **Não há atualizações automáticas.** Você baixa um arquivo novo quando sai
  uma versão nova (alguns programas conseguem se atualizar sozinhos).
- O programa não aparece sozinho no menu de aplicativos. Ferramentas como o
  *Gear Lever* ou o *AppImageLauncher* resolvem isso.

## Qual devo escolher?

1. **Os pacotes da distribuição** para programas do sistema e de linha de
   comando – eles são os menores e mais rápidos, e são atualizados junto com
   o resto do sistema.
2. **Flatpak** para programas de desktop, quando você quer uma versão mais
   nova ou um programa que não está nos repositórios.
3. **Snap** se você usa Ubuntu, ou quando o programa só existe como snap.
4. **AppImage** para testar um programa rapidinho, ou quando o desenvolvedor
   só oferece esse formato.
