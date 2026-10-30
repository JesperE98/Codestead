# A família Debian: apt e PPAs

O Debian, o Ubuntu e as distribuições baseadas neles, como o Linux Mint,
formam a **família Debian**. Todas usam o gerenciador de pacotes **apt** e
pacotes no formato `.deb`. Este capítulo sempre roda em uma distribuição da
família Debian – neste momento é o **{{distro}}**. Você pode alternar entre o
Ubuntu e o Debian no menu lá em cima.

## O apt em resumo

| O quê | Comando |
|---|---|
| Atualizar a lista de pacotes | `apt update` |
| Atualizar tudo | `apt upgrade` |
| Instalar | `apt install X` |
| Remover | `apt remove X` |
| Pesquisar | `apt search X` |
| Informações do pacote | `apt show X` |
| Listar instalados | `apt list --installed` |

Os comandos que alteram o sistema exigem root, por isso são executados com
`sudo`.

```quiz
Quais destes comandos alteram o sistema e, portanto, precisam de `sudo`?
- [x] `apt install htop`
- [ ] `apt search htop`
- [x] `apt remove htop`
- [ ] `apt show htop`
---
Pesquisar e mostrar informações só leem as listas de pacotes. Instalar e
remover alteram o sistema.
```

## update e upgrade são coisas diferentes

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

```quiz
O que o `sudo apt update` faz?
- [x] Baixa a lista de pacotes e versões disponíveis
- [ ] Instala versões novas dos pacotes que você já tem
- [ ] Atualiza o próprio apt para a versão mais recente
---
O `apt update` só atualiza a lista. É o `apt upgrade` que instala as versões
novas.
```

## Instalando e removendo

```sh
sudo apt install htop
```

O `apt remove` remove um programa, mas deixa os arquivos de configuração para
trás. O `apt purge` remove esses também. Quando o apt pergunta
`Do you want to continue? [Y/n]`, o `Y` maiúsculo significa que basta
pressionar Enter para responder sim. Com a opção `-y`, o apt responde sim
automaticamente.

Pesquisar não exige root. Experimente:

```try
apt search htop
```

### apt ou apt-get?

O `apt` é a variante moderna e amigável, com barra de progresso e cores. O
`apt-get` e o `apt-cache` são mais antigos, mas têm uma saída mais estável,
por isso ainda são usados em scripts.

### Por baixo dos panos: dpkg e .deb

Os pacotes são arquivos `.deb`, e quem na verdade os desempacota é o programa
`dpkg`. O apt cuida de tudo em volta disso: download, dependências e
atualizações.

## Repositórios extras – práticos, mas por sua conta e risco

Os repositórios da distribuição têm dezenas de milhares de pacotes – mas não
tudo. Um programa de nicho pode simplesmente não estar lá, ou estar só em uma
versão antiga. É para isso que existem os **repositórios extras**, onde
desenvolvedores e usuários compartilham os seus próprios pacotes.

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
depois um Flatpak (no capítulo sobre pacotes universais) e só então em um
repositório extra de alguém em quem você confia.

## PPAs

Um **PPA** (*Personal Package Archive*) é um pequeno repositório no Launchpad,
o serviço da Canonical para o Ubuntu. O desenvolvedor envia o código-fonte e o
Launchpad gera pacotes `.deb` para diferentes versões do Ubuntu. Um PPA é
escrito `ppa:usuário/nome`. Os PPAs não são revisados pela distribuição.

No restante deste capítulo você instala um programa inventado, `moonphase`
(ele mostra a fase da lua no terminal), a partir de um PPA.

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

```quiz
Você adiciona um repositório na mão, criando um arquivo em
`/etc/apt/sources.list.d/`. O que você precisa fazer antes que o apt consiga
instalar pacotes dele?
- [ ] Nada – o apt lê o arquivo sozinho na próxima vez que você instalar algo
- [x] Executar `sudo apt update`
- [ ] Reiniciar o computador
---
O `add-apt-repository` executa `apt update` por você. Quando você mesmo cria o
arquivo, precisa fazer isso você mesmo.
```

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

```quiz
O mesmo pacote está tanto no repositório da distribuição quanto em um PPA que
você adicionou. Qual versão o apt escolhe?
- [ ] Sempre a do repositório da distribuição
- [ ] A do repositório que foi adicionado por último
- [x] A versão mais alta
---
É por isso que um PPA pode substituir um dos pacotes da própria distribuição.
```

### PPAs no Debian?

PPAs são feitos para o Ubuntu, não para o Debian. No Debian eles até podem
funcionar, mas os pacotes podem precisar de versões de bibliotecas diferentes
das que o Debian tem. Uma mistura de pacotes do Debian e do Ubuntu é chamada,
de brincadeira, de *FrankenDebian* e é um jeito comum de quebrar o sistema.
No Debian, é melhor usar *backports*, um Flatpak ou o repositório do próprio
desenvolvedor para o Debian.

### Atualizações e remoção de um PPA

Os pacotes de um PPA são atualizados junto com todo o resto, com
`sudo apt update && sudo apt upgrade`. Para remover o PPA:

```sh
sudo add-apt-repository --remove ppa:lunatool/moonphase
```

O programa continua instalado, mas não recebe mais atualizações. Para se
livrar dele de vez, execute também `sudo apt remove moonphase`.

Cada repositório que você adiciona é mais um remetente em quem você confia.
Mantenha a lista curta e limpe o que você não usa mais.
