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

Fique à vontade para trocar de distribuição no menu lá em cima e refazer as
tarefas – você vai ver as diferenças na hora.

## O que é igual em todo lugar?

- **O kernel Linux** – embora em versões diferentes.
- **O shell bash** e as ferramentas básicas (`ls`, `cp`, `grep` ...) do GNU.
- **A estrutura de diretórios** – `/etc`, `/home`, `/usr/bin` e assim por
  diante.
- **O systemd**, que inicia o sistema e gerencia os serviços, em quase todas
  as grandes distribuições.

## O que é diferente?

| | Família Debian | Família Arch | Família Red Hat |
|---|---|---|---|
| Gerenciador de pacotes | `apt` | `pacman` | `dnf` |
| Formato de pacote | `.deb` | `.pkg.tar.zst` | `.rpm` |
| Ferramenta de baixo nível | `dpkg` | (pacman) | `rpm` |
| Grupo do sudo | `sudo` | `wheel` | `wheel` |
| Lançamentos | Versões estáveis | Contínuos (*rolling*) | Uma versão nova a cada 6 meses (Fedora) |

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
