# Gerenciamento de pacotes

No Windows e no macOS, muitas vezes você baixa programas de um site. No Linux,
em vez disso, você instala quase tudo com um **gerenciador de pacotes**. Essa
é a maior diferença entre as famílias de distribuições – e este capítulo muda
conforme a distribuição que você escolheu. Neste momento é o **{{pm}}** no
{{distro}}.

## Pacotes, repositórios e dependências

- Um **pacote** é um programa (ou biblioteca) empacotado em um arquivo, junto
  com informações sobre a versão e sobre aquilo de que ele precisa.
- Um **repositório** é um servidor onde a distribuição publica todos os seus
  pacotes. Eles são testados e assinados, então você sabe que ninguém mexeu
  neles.
- Uma **dependência** é outro pacote necessário. O gerenciador de pacotes
  instala as dependências automaticamente.

O gerenciador de pacotes também controla o que está instalado e consegue
atualizar *tudo* no computador com um único comando.

## A mesma coisa – três dialetos

| O quê | apt (Debian) | pacman (Arch) | dnf (Red Hat) |
|---|---|---|---|
| Atualizar a lista de pacotes | `apt update` | `pacman -Sy` | `dnf check-update` |
| Atualizar tudo | `apt upgrade` | `pacman -Syu` | `dnf upgrade` |
| Instalar | `apt install X` | `pacman -S X` | `dnf install X` |
| Remover | `apt remove X` | `pacman -R X` | `dnf remove X` |
| Pesquisar | `apt search X` | `pacman -Ss X` | `dnf search X` |
| Informações do pacote | `apt show X` | `pacman -Si X` | `dnf info X` |
| Listar instalados | `apt list --installed` | `pacman -Q` | `dnf list --installed` |

Os comandos que alteram o sistema exigem root, por isso são executados com
`sudo`.

:::debian
## apt no {{distro}}

### update e upgrade são coisas diferentes

Isso confunde quase todo mundo no começo:

- O `apt update` baixa a **lista** de pacotes e versões disponíveis. Ele não
  instala nada.
- O `apt upgrade` **instala** versões novas do que você já tem.

Então sempre execute o `update` primeiro. A forma mais comum de atualizar o
sistema é:

```sh
sudo apt update && sudo apt upgrade
```

Antes de você executar o `apt update` (em um servidor recém-instalado, por
exemplo), a lista de pacotes está vazia e o apt não encontra pacote nenhum.

### Instalando e removendo

```sh
sudo apt install htop
```

O `apt remove` remove um programa, mas deixa os arquivos de configuração para
trás. O `apt purge` remove esses também. Quando o apt pergunta
`Do you want to continue? [Y/n]`, o `Y` maiúsculo significa que basta
pressionar Enter para responder sim. Com a opção `-y`, o apt responde sim
automaticamente.

### apt ou apt-get?

O `apt` é a variante moderna e amigável, com barra de progresso e cores. O
`apt-get` e o `apt-cache` são mais antigos, mas têm uma saída mais estável,
por isso ainda são usados em scripts.

### Por baixo dos panos: dpkg e .deb

Os pacotes são arquivos `.deb`, e quem na verdade os desempacota é o programa
`dpkg`. O apt cuida de tudo em volta disso: download, dependências e
atualizações.
:::

:::arch
## pacman no {{distro}}

O pacman usa opções curtas em que a **letra maiúscula** é a operação e as
letras minúsculas são modificadores:

| Opção | Significa |
|---|---|
| `-S` | Sync – instala a partir dos repositórios |
| `-R` | Remove |
| `-Q` | Query – consulta os pacotes instalados |
| `y` | Atualiza o banco de dados de pacotes |
| `u` | Atualiza todos os pacotes |
| `s` | Pesquisa (com -S e -Q) ou remove dependências (com -R) |
| `i` | Informações |

### Atualizando o sistema

```sh
sudo pacman -Syu
```

`-Syu` significa: sincronizar (`S`), atualizar o banco de dados (`y`) e
atualizar tudo (`u`). O Arch é uma *rolling release*, então você vai executar
isso com frequência.

> **Importante!** Nunca execute só `pacman -Sy` seguido de `pacman -S pacote`.
> O pacote novo pode precisar de bibliotecas mais novas do que as que você
> tem – é a chamada *atualização parcial* (*partial upgrade*), que pode
> quebrar o seu sistema. Sempre use `-Syu`.

### Instalando e removendo

```sh
sudo pacman -S htop
```

O `pacman -R pacote` remove um pacote, e o `pacman -Rs pacote` também remove
as dependências de que mais nada precisa.

### O AUR

Além dos repositórios oficiais, existe o **AUR** (*Arch User Repository*),
onde os usuários compartilham receitas de compilação para milhares de
programas. É comum usar um ajudante como o `yay` ou o `paru` para instalar a
partir dele. Os pacotes do AUR não são revisados pelo Arch – sempre leia a
receita de compilação (o PKGBUILD) antes.
:::

:::redhat
## dnf no {{distro}}

### Metadados automáticos

O dnf busca sozinho as informações novas dos pacotes quando precisa, então
não existe uma etapa separada como o `apt update`. Se quiser ver quais
atualizações estão disponíveis, execute:

```sh
dnf check-update
```

O código de saída é `100` se houver atualizações – útil em scripts.

### Instalando e removendo

```sh
sudo dnf install htop
```

Repare na pergunta `Is this ok [y/N]`. O `N` maiúsculo significa que **não**
é o padrão – se você só pressionar Enter, a instalação é cancelada. Digite
`y` e Enter, ou use `-y`.

### Atualizando o sistema

```sh
sudo dnf upgrade
```

### Por baixo dos panos: rpm

Os pacotes são arquivos `.rpm` e a ferramenta de baixo nível se chama `rpm`.
O dnf substituiu o antigo `yum`, e o Fedora 41 trouxe a nova versão **dnf5**,
que é bem mais rápida. No RHEL, no Rocky e no AlmaLinux o comando também se
chama `dnf`.
:::

## Mesmo programa, nomes diferentes

Os pacotes costumam ter o mesmo nome em todo lugar – mas nem sempre. Alguns
exemplos:

| Programa | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Cliente SSH | `openssh-client` | `openssh` | `openssh-clients` |

Sempre pesquise com o gerenciador de pacotes se não tiver certeza do nome.

## Formatos de pacote universais

Também existem formatos que funcionam em todas as distribuições: **Flatpak**
(comum para aplicativos de desktop, via Flathub), **Snap** (da Canonical, o
padrão no Ubuntu) e **AppImage** (um único arquivo executável). Eles têm
comandos próprios e complementam o gerenciador de pacotes da distribuição.
