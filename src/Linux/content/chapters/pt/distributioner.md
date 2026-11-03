# Distribuições e famílias

Agora você já conhece o básico, e ele funciona igual em todas as
distribuições. Então, o que as diferencia?

:::debian
Neste momento você está usando **{{distro}}**, da **família Debian**.
:::

:::arch
Neste momento você está usando **{{distro}}**, da **família Arch**.
:::

:::redhat
Neste momento você está usando **{{distro}}**, da **família Red Hat**.
:::

Este capítulo é uma visão geral. Fique à vontade para trocar de distribuição
no menu lá em cima e refazer as tarefas – você vai ver as diferenças na hora.
Depois deste capítulo vem um capítulo para cada família: a **família Debian**
(apt), a **família Arch** (pacman) e a **família Red Hat** (dnf). Cada um
deles sempre roda em uma distribuição daquela família, então você pode fazer
os três.

## O que é igual em todo lugar?

- **O kernel Linux** – embora em versões diferentes.
- **O shell bash** e as ferramentas básicas (`ls`, `cp`, `grep` ...) do GNU.
- **A estrutura de diretórios** – `/etc`, `/home`, `/usr/bin` e assim por
  diante.
- **O systemd**, que inicia o sistema e gerencia os serviços, em quase todas
  as grandes distribuições.

A variável `SHELL` guarda o caminho completo do shell com que você faz login –
no caso do bash, o mesmo caminho que você escreve na linha do shebang de um
script.

```predict
$ echo $SHELL
/bin/bash
---
O shell é o bash em todas as distribuições do simulador – seja qual for a que
você escolheu.
```

## O que é diferente?

| | Família Debian | Família Arch | Família Red Hat |
|---|---|---|---|
| Gerenciador de pacotes | `apt` | `pacman` | `dnf` |
| Formato de pacote | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Ferramenta de baixo nível | `dpkg` | (pacman) | `rpm` |
| Grupo do sudo | `sudo` | `wheel` | `wheel` |
| Lançamentos | Versões estáveis | Contínuos (*rolling*) | Uma versão nova a cada 6 meses (Fedora) |

```quiz
Em quais famílias o grupo que pode usar o sudo se chama `wheel`?
- [ ] A família Debian
- [x] A família Arch
- [x] A família Red Hat
---
A família Debian chama o grupo de `sudo`; o Arch e o Red Hat o chamam de `wheel`.
```

### Modelos de lançamento

- **Estável, com versões fixas** – o Debian lança uma versão nova mais ou
  menos a cada dois anos, e o Ubuntu LTS (*Long Term Support*) sai a cada dois
  anos com cinco anos de suporte. Os programas recebem correções de segurança,
  mas raramente são trocados por versões mais novas. Ótimo para servidores.
- **Contínuo** (*rolling*) – o Arch não tem versões. Você atualiza o tempo
  todo e sempre recebe o mais recente. Exige um pouco mais de você como
  usuário.
- **Ágil** – o Fedora lança uma versão nova a cada seis meses, mais ou menos,
  e serve como uma espécie de campo de testes para o Red Hat Enterprise Linux
  (RHEL), que por sua vez tem dez anos de suporte e é usado por empresas.

```quiz
Qual distribuição não tem versões, mas é atualizada continuamente
(*rolling*)?
- [ ] Debian
- [ ] Ubuntu LTS
- [x] Arch
- [ ] Fedora
```

## Qual distribuição estou usando?

O arquivo `/etc/os-release` existe em todas as distribuições modernas e
informa o nome e a versão:

```sh
cat /etc/os-release
```

A versão do kernel é mostrada com `uname -r`:

```sh
uname -r
```

```try
cat /etc/os-release
---
As linhas `NAME` e `PRETTY_NAME` dizem qual distribuição é.
```

## Pacotes, repositórios e dependências

No Windows e no macOS, muitas vezes você baixa programas de um site. No Linux,
em vez disso, você instala quase tudo com um **gerenciador de pacotes**. Essa
é a maior diferença entre as famílias de distribuições.

- Um **pacote** é um programa (ou biblioteca) empacotado em um arquivo, junto
  com informações sobre a versão e sobre aquilo de que ele precisa.
- Um **repositório** é um servidor onde a distribuição publica todos os seus
  pacotes. Eles são testados e assinados, então você sabe que ninguém mexeu
  neles.
- Uma **dependência** é outro pacote necessário. O gerenciador de pacotes
  instala as dependências automaticamente.

O gerenciador de pacotes também controla o que está instalado e consegue
atualizar *tudo* no computador com um único comando. Os comandos que alteram
o sistema exigem root, por isso são executados com `sudo`.

```quiz
Um pacote precisa de outro pacote que você não tem. O que acontece quando você
o instala com o gerenciador de pacotes?
- [ ] A instalação para, e você mesmo precisa encontrar o outro pacote
- [x] O gerenciador de pacotes instala a dependência automaticamente
- [ ] O pacote é instalado, mas não funciona até você baixar o outro
```

### Mesmo programa, nomes diferentes

Os pacotes costumam ter o mesmo nome em todo lugar – mas nem sempre. Alguns
exemplos:

| Programa | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Vim | `vim` | `vim` | `vim-enhanced` |
| Python 3 | `python3` | `python` | `python3` |
| Cliente SSH | `openssh-client` | `openssh` | `openssh-clients` |

Sempre pesquise com o gerenciador de pacotes se não tiver certeza do nome.

## A configuração do gerenciador de pacotes

:::debian
Na família Debian, os arquivos em `/etc/apt/sources.list.d/` indicam de quais
*repositórios* o apt baixa os pacotes:

```sh
ls /etc/apt/sources.list.d
```
:::

:::arch
Na família Arch, o pacman é configurado pelo `/etc/pacman.conf`, e a lista de
servidores espelho fica em `/etc/pacman.d/mirrorlist`:

```sh
cat /etc/pacman.conf
```
:::

:::redhat
Na família Red Hat, as configurações do dnf ficam em `/etc/dnf/dnf.conf`, e os
*repositórios* são descritos por arquivos em `/etc/yum.repos.d/`:

```sh
ls /etc/yum.repos.d
```
:::

## Qual devo escolher?

Não existe resposta certa, mas aqui vai uma regra prática:

- **Novo no Linux?** Ubuntu, Linux Mint ou Fedora.
- **Um servidor?** Debian, Ubuntu LTS ou um clone do RHEL, como o Rocky Linux.
- **Quer aprender como tudo se encaixa?** Arch – e a sua excelente wiki.
