# AUR, PPA e COPR

Os repositórios da distribuição têm dezenas de milhares de pacotes – mas não
tudo. Um programa de nicho pode simplesmente não estar lá, ou estar só em uma
versão antiga. É para isso que existem os **repositórios extras**, onde
desenvolvedores e usuários compartilham os seus próprios pacotes. Cada família
tem o seu: **PPA** no Ubuntu, o **AUR** no Arch e o **COPR** no Fedora.

Neste capítulo você instala o mesmo programa inventado, `moonphase` (ele
mostra a fase da lua no terminal), a partir do repositório extra no
{{distro}}. Troque de distribuição no menu se quiser comparar como funciona
nas outras famílias.

## Prático – mas por sua conta e risco

Os pacotes dos repositórios da própria distribuição são testados em conjunto,
assinados e revisados pelos desenvolvedores da distribuição. Já um repositório
extra pode ser criado por qualquer pessoa. Tenha isso em mente antes de
adicionar um:

- **Os pacotes são instalados como root.** Um pacote pode fazer qualquer coisa
  com o computador. Você confia em quem o empacotou tanto quanto confia na
  distribuição.
- **Pode dar conflito.** Um pacote de um repositório extra pode substituir
  bibliotecas do próprio sistema ou precisar de versões diferentes das que você
  tem.
- **Ele pode deixar de ser atualizado.** Se a pessoa que mantém o repositório
  perder o interesse, você não recebe mais atualizações de segurança para o
  programa.

Uma boa regra prática: procure primeiro nos repositórios da distribuição,
depois um Flatpak (próximo capítulo) e só então em um repositório extra de
alguém em quem você confia.

## Três famílias, três soluções

| | PPA | AUR | COPR |
|---|---|---|---|
| Família | Ubuntu (e, por exemplo, Linux Mint) | Arch (e, por exemplo, Manjaro, EndeavourOS) | Fedora (e a família RHEL) |
| Site | launchpad.net | aur.archlinux.org | copr.fedorainfracloud.org |
| O que você baixa | Pacotes `.deb` prontos | Uma receita de build (`PKGBUILD`) – você mesmo compila | Pacotes `.rpm` prontos |
| Como adicionar | `add-apt-repository ppa:…` | `git clone …` e `makepkg -si` | `dnf copr enable …` |
| Revisado pela distribuição | Não | Não | Não |

:::debian
## PPAs no {{distro}}

Um **PPA** (*Personal Package Archive*) é um pequeno repositório no Launchpad,
o serviço da Canonical para o Ubuntu. O desenvolvedor envia o código-fonte e o
Launchpad gera pacotes `.deb` para diferentes versões do Ubuntu. Um PPA é
escrito `ppa:usuário/nome`.

### A ferramenta add-apt-repository

PPAs são adicionados com o `add-apt-repository`, que fica no pacote
`software-properties-common`. Ele vem pré-instalado no Ubuntu, mas não no
Debian:

```sh
sudo apt update
sudo apt install software-properties-common
```

### Adicionando o PPA

```sh
sudo add-apt-repository ppa:lunatool/moonphase
```

Você vê o que está sendo adicionado e uma descrição do PPA. Pressione Enter
para continuar (com `-y` você pula a pergunta). Duas coisas acontecem:

1. Um arquivo é criado em `/etc/apt/sources.list.d/`. Ele diz onde fica o
   repositório e contém a chave com que os pacotes são assinados.
2. O `add-apt-repository` executa `apt update` por você – senão o apt não
   saberia dos pacotes novos. Se você adicionar uma fonte na mão (criando um
   arquivo), precisa executar `sudo apt update` você mesmo depois.

Olhe o arquivo:

```sh
ls /etc/apt/sources.list.d
cat /etc/apt/sources.list.d/lunatool-ubuntu-moonphase-noble.sources
```

Repare em `Suites: noble` – os pacotes foram gerados para o Ubuntu 24.04.

### Instalando e executando

Agora o pacote é instalado como qualquer outro:

```sh
sudo apt install moonphase
moonphase
```

### De onde vem o pacote?

O `apt policy` mostra em quais repositórios um pacote está e qual deles
vence:

```sh
apt policy moonphase
```

`***` marca a versão instalada. O número `500` é a prioridade do repositório
e `100` significa “o que já está instalado”. Se o mesmo pacote estiver em
vários repositórios, o apt escolhe a versão mais alta – então um PPA pode
substituir um dos pacotes da própria distribuição pela sua própria versão.

### PPAs no Debian?

PPAs são feitos para o Ubuntu, não para o Debian. No Debian eles até podem
funcionar, mas os pacotes podem precisar de versões de bibliotecas diferentes
das que o Debian tem. Uma mistura de pacotes do Debian e do Ubuntu é chamada,
de brincadeira, de *FrankenDebian* e é um jeito comum de quebrar o sistema.
No Debian, é melhor usar *backports*, um Flatpak ou o repositório do próprio
desenvolvedor para o Debian.

### Removendo um PPA

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

O programa continua instalado, mas não recebe mais atualizações. Para se
livrar dele de vez, execute também `sudo apt remove moonphase`.
:::

:::arch
## O AUR no {{distro}}

O **AUR** (*Arch User Repository*) é diferente dos outros: ele não tem
pacotes prontos, só **receitas de build**. Uma receita se chama `PKGBUILD` e é
um pequeno script bash que diz onde está o código-fonte e como o programa é
compilado. Você baixa a receita, gera o pacote você mesmo e o instala com o
pacman. O AUR é enorme – quase tudo que existe para Linux está lá –, mas
qualquer pessoa pode enviar uma receita.

### Preparativos

Para baixar receitas e gerar pacotes, você precisa do `git` e do `base-devel`
(um compilador, `make`, `fakeroot` e mais):

```sh
sudo pacman -S --needed git base-devel
```

`--needed` pula o que já está instalado.

### Baixando a receita

Cada pacote do AUR é um repositório git próprio:

```sh
cd ~
git clone https://aur.archlinux.org/moonphase.git
cd moonphase
ls
```

> Se você digitar o nome do pacote errado, o git diz *"You appear to have
> cloned an empty repository"* e o diretório fica vazio. O AUR deixa você
> clonar qualquer coisa!

### Leia o PKGBUILD – todas as vezes

```sh
less PKGBUILD
```

O `PKGBUILD` é um script que roda no seu computador. No mínimo, verifique:

- se o `source=` baixa do site verdadeiro do programa,
- se `build()` e `package()` só compilam e copiam arquivos – e não, por
  exemplo, baixam e executam outra coisa (`curl … | sh`),
- se o pacote parece bem mantido (datas, comentários em aur.archlinux.org).

### Compilando e instalando

```sh
makepkg -si
```

O `makepkg` lê o `PKGBUILD`, baixa o código-fonte, compila e empacota um
arquivo `.pkg.tar.zst`. `-s` instala as dependências que faltam e `-i`
instala o pacote com o pacman quando termina. **Não** execute o makepkg com
sudo – ele se recusa a rodar como root e usa o sudo sozinho quando
necessário.

```sh
ls
moonphase
```

### Pacotes “estrangeiros”

O pacman não sabe nada sobre o AUR. Pacotes que não vêm dos repositórios são
chamados de *foreign* (estrangeiros) e são listados com:

```sh
pacman -Qm
```

Isso também significa que o `sudo pacman -Syu` **não** atualiza pacotes do
AUR. Você precisa baixar a receita nova você mesmo (`git pull`) e compilar de
novo – ou deixar um AUR helper fazer isso.

### O AUR helper yay

Um AUR helper faz tudo isso por você: pesquisa, baixa, mostra o `PKGBUILD`,
compila e instala. O mais comum é o **yay** (outro é o *paru*). O próprio yay
só existe no AUR, então ele é instalado na mão uma vez. O pacote `yay-bin` já
vem compilado e é o mais rápido:

```sh
cd ~
git clone https://aur.archlinux.org/yay-bin.git
cd yay-bin
makepkg -si
```

Depois disso o yay é usado mais ou menos como o pacman – mas sem sudo:

```sh
yay -Ss snowfall
yay -S snowfall
snowfall
yay -Syu
```

`yay -Syu` (ou só `yay`) atualiza tanto os pacotes dos repositórios quanto os
seus pacotes do AUR. Comodidade não significa que você pode parar de ler as
receitas!
:::

:::redhat
## COPR no {{distro}}

O **COPR** (*Cool Other Package Repo*) é o serviço de build do Fedora.
Qualquer pessoa com uma conta no Fedora pode gerar pacotes `.rpm` lá, e cada
projeto vira um repositório próprio chamado `usuário/projeto`.

### Os repositórios que você tem agora

```sh
dnf repolist
```

### Ativando um repositório COPR

```sh
sudo dnf copr enable lunatool/moonphase
```

O dnf lembra você de que o repositório não faz parte do Fedora e de que a
qualidade pode variar. O padrão da pergunta é **não**, então responda `y`. Um
arquivo novo é criado em `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
dnf copr list
dnf repolist
```

### Instalando e executando

O dnf busca sozinho as informações do repositório novo, então o pacote pode
ser instalado na hora:

```sh
sudo dnf install moonphase
moonphase
```

### De onde vem o pacote?

```sh
dnf info moonphase
```

A linha `From repository` mostra que o pacote veio do COPR. Pacotes do COPR
são atualizados normalmente com `sudo dnf upgrade`.

### Desativando ou removendo

```sh
sudo dnf copr disable lunatool/moonphase
dnf copr list
```

O `disable` deixa o arquivo no lugar, mas desliga o repositório; o `remove`
o apaga completamente. O programa continua instalado, mas não recebe mais
atualizações.

### RPM Fusion

Outro repositório extra comum para o Fedora é o **RPM Fusion**. Ele tem
coisas que o Fedora não pode ou não quer incluir, como certos codecs de mídia
e drivers. É um projeto grande e coletivo – não o repositório de um único
usuário, como no COPR.
:::

## Atualizações e manutenção

| | Atualizado com | Remover o repositório |
|---|---|---|
| PPA | `sudo apt update && sudo apt upgrade` | `sudo add-apt-repository --remove ppa:…` |
| AUR | `yay -Syu` – ou compilando você mesmo | – (não há repositório para remover) |
| COPR | `sudo dnf upgrade` | `sudo dnf copr remove …` |

Repositórios extras são uma ferramenta poderosa, mas cada repositório que
você adiciona é mais um remetente em quem você confia. Mantenha a lista curta
e limpe o que você não usa mais.
