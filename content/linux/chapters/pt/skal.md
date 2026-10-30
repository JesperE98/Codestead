# Outros shells: zsh e fish

Até agora você digitou todos os comandos no **bash**. Mas o bash é só um de
vários shells – e muita gente prefere outro. Neste capítulo você instala duas
alternativas populares, o **zsh** e o **fish**, experimenta os dois e vê em
que eles diferem do bash. Você também vai aprender por que os scripts
continuam sendo escritos quase sempre para o bash.

## O que é mesmo um shell?

O **shell** é o programa que lê o que você digita, interpreta e inicia outros
programas. É o shell que entende `|`, `>`, `$VARIÁVEIS`, curingas como
`*.txt` e loops. O terminal é só a janela em que o shell roda.

Programas como `ls`, `grep` e `cat` são programas separados em `/usr/bin` –
eles funcionam igual, seja qual for o shell que você usa. O que muda entre os
shells é **a linguagem em volta deles**: como as variáveis são definidas, como
loops e condições são escritos, como o prompt se parece e quais facilidades
estão disponíveis.

```quiz
Você troca do bash para outro shell. Qual destas coisas continua exatamente igual?
- [ ] Como você define uma variável
- [ ] Como você escreve um loop
- [x] O que o `grep` faz com as opções dele
- [ ] Como o prompt se parece
---
O `grep` é um programa separado em `/usr/bin`. O shell só o inicia – o que muda
entre os shells é a linguagem em volta dele.
```

## A árvore genealógica: sh, bash, zsh e fish

| Shell | Desde | Características |
|---|---|---|
| `sh` | 1979 | O Bourne shell. O `sh` de hoje segue o padrão **POSIX** e é o menor denominador comum. |
| `bash` | 1989 | *Bourne Again SHell*. O padrão em quase todas as distribuições Linux. |
| `zsh` | 1990 | Em grande parte compatível com o bash, mas com mais recursos. O padrão no macOS. |
| `fish` | 2005 | *Friendly interactive shell*. Fácil de usar, mas com **sintaxe própria**. |

**POSIX** é um padrão que descreve como um shell `sh` deve se comportar. Um
script que só usa recursos POSIX funciona em todo shell compatível com `sh`:
bash, zsh, `dash` (que é o `/bin/sh` no Debian e no Ubuntu) e `ash` (em
sistemas pequenos como o Alpine). O fish deliberadamente **não** é compatível
com POSIX – é isso que o torna mais simples, mas também diferente.

## Quais shells estão instalados?

O arquivo `/etc/shells` lista os shells que podem ser usados como shells de
login:

```sh
cat /etc/shells
```

O shell que você recebe ao fazer login é o último campo da sua linha em
`/etc/passwd`, e ele também está na variável `$SHELL`:

```sh
grep elev /etc/passwd
echo $SHELL
```

## zsh – bash com extras

### Instale o zsh

No terminal Ubuntu, você instala o zsh com o apt:

```sh
sudo apt update
sudo apt install zsh
```

Outras distribuições usam o próprio gerenciador de pacotes, como você aprendeu
na parte sobre distribuições e pacotes. Lá o pacote também se chama `zsh`.

Olhe o `/etc/shells` de novo – o pacote acrescentou `/usr/bin/zsh` (e
`/bin/zsh`):

```sh
cat /etc/shells
```

### Inicie o zsh

Um shell é um programa como qualquer outro, então você inicia o zsh digitando
o nome dele:

```sh
zsh
```

Na primeira vez, você é recebido pelo **zsh-newuser-install**, porque ainda
não tem um arquivo de configuração para o zsh. É um menu que ajuda você a
começar:

| Tecla | Faz |
|---|---|
| `q` | Sai sem fazer nada (você recebe a pergunta de novo na próxima vez) |
| `0` | Cria um `~/.zshrc` quase vazio |
| `1` | O menu principal com todas as configurações (não disponível no simulador) |
| `2` | Cria o `~/.zshrc` com as configurações recomendadas |

Responda `2`. O prompt muda para `elev@ubuntu ~ %` – no zsh, `%` é o
sinal habitual para um usuário comum (o root recebe `#`, igual no bash).

Qual shell você está rodando agora? A variável `$0` contém o nome do shell:

```sh
echo $0
ps
```

O `ps` mostra que o zsh roda **dentro** do bash: o bash iniciou o zsh como um
novo processo. Repare também que `$SHELL` continua sendo `/bin/bash` – essa
variável diz qual é o seu *shell de login*, não qual shell você está rodando
neste momento.

```sh
echo $SHELL
```

### A maioria das coisas funciona como no bash

O zsh entende quase toda a sintaxe do bash. Pipes, redirecionamento,
variáveis, `if`, `for` e funções funcionam do jeito que você está acostumado:

```sh
for f in ~/dokument/*.txt; do wc -l $f; done
```

### Recurso 1: `**` busca em todos os subdiretórios

No zsh, `**/` significa "todos os diretórios, em todos os níveis". Isto lista
todos os arquivos `.txt` no seu diretório pessoal e em tudo o que está abaixo
dele:

```sh
ls ~/**/*.txt
```

No bash, `**` funciona como um `*` simples – a menos que você o ative antes
com `shopt -s globstar`.

### Recurso 2: autocd

Com a opção `autocd` (parte das configurações recomendadas) você só precisa
digitar o nome de um diretório para ir até ele – sem `cd`:

```sh
dokument
..
```

As opções são ligadas e desligadas com `setopt` e `unsetopt`:

```sh
setopt
unsetopt autocd
setopt autocd
```

### Uma diferença para ficar de olho: variáveis não são divididas

No bash, uma variável sem aspas é dividida nos espaços. No zsh, não:

```sh
filer="a.txt b.txt"
for f in $filer; do echo "[$f]"; done
```

O bash imprime `[a.txt]` e `[b.txt]` – o zsh imprime `[a.txt b.txt]`. O jeito
do zsh normalmente é o que você quer, mas significa que um script de bash nem
sempre faz a mesma coisa no zsh. (Com `setopt shwordsplit`, o zsh se comporta
como o bash.)

Você não precisa iniciar um shell para testar um único comando nele. Com `-c`,
o shell executa o comando e sai na hora – `zsh -c 'echo $0'` imprime `zsh`, e
depois você continua no bash.

A pergunta abaixo começa em um terminal novo, então primeiro instala o zsh.
O `> /dev/null 2>&1` joga fora a saída dessa linha. O que o último comando
imprime?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ zsh -c 'filer="x.txt y.txt z.txt"; for f in $filer; do echo "<$f>"; done'
<x.txt y.txt z.txt>
---
O zsh não divide a variável nos espaços, então o loop roda uma vez com o valor
inteiro. No bash, o mesmo loop imprimiria três linhas: `<x.txt>`, `<y.txt>` e
`<z.txt>`.
```

### ~/.zshrc e o prompt

O bash lê o `~/.bashrc` quando inicia – o zsh lê o `~/.zshrc`. Olhe o arquivo
que o zsh-newuser-install criou:

```sh
cat ~/.zshrc
```

O prompt é definido pela variável `PROMPT` e usa códigos com `%`:

| Código | Significa |
|---|---|
| `%n` | O nome de usuário |
| `%m` | O nome do computador |
| `%~` | O diretório inteiro (com `~` para o seu diretório pessoal) |
| `%1~` | Só a última parte do diretório |
| `%#` | `%` para usuários comuns, `#` para o root |
| `%F{green}` … `%f` | Cor (red, green, blue, yellow …) |

Experimente:

```sh
PROMPT='%F{green}%n%f:%~ %# '
```

A alteração só dura até você sair do zsh. Se quiser que ela valha sempre,
coloque a linha no `~/.zshrc`.

### Oh My Zsh

Muitos usuários de zsh instalam o **Oh My Zsh**, uma coleção de temas e
plugins – por exemplo, informações do Git no prompt, um autocompletar com Tab
melhor e sugestões enquanto você digita. Ele é instalado com um script do
site do projeto e configurado no `~/.zshrc`. Ele não está disponível no
simulador, mas agora você sabe do que as pessoas estão falando quando o
mencionam.

### De volta ao bash

O zsh é um processo rodando dentro do bash. Saia dele com `exit` e você volta
ao bash – onde as variáveis, os aliases e as mudanças de diretório feitas no
zsh não existem mais:

```sh
exit
echo $0
```

## fish – o shell interativo amigável

O fish quer ser fácil de usar logo de cara, sem configuração: cores,
autocompletar com Tab e **autossugestões** – o fish sugere o resto do comando
em texto cinza, com base no seu histórico, e você aceita a sugestão com a
seta para a direita. (O simulador não mostra sugestões, mas a sintaxe
funciona.)

### Instale e inicie o fish

O fish é instalado com o apt do mesmo jeito – em outras distribuições, com o
próprio gerenciador de pacotes delas:

```sh
sudo apt update
sudo apt install fish
```

```sh
fish
```

O fish dá as boas-vindas e o prompt vira `elev@ubuntu ~>`. Desça alguns
diretórios e veja como o fish encurta o caminho no prompt:

```sh
mkdir -p ~/dokument/projekt
cd ~/dokument/projekt
cd ~
```

No diretório `~/dokument/projekt` o prompt mostra `~/d/projekt>` – todos os
diretórios, menos o último, são encurtados para uma letra.

### O fish tem sintaxe própria

É aqui que o fish mais se diferencia do bash e do zsh:

| Isto | bash e zsh | fish |
|---|---|---|
| Definir uma variável | `frukt=äpple` | `set frukt äpple` |
| Variável de ambiente | `export EDITOR=nano` | `set -x EDITOR nano` |
| Remover uma variável | `unset frukt` | `set -e frukt` |
| Substituição de comando | `$(pwd)` | `(pwd)` |
| Último status de saída | `$?` | `$status` |
| Argumentos do script | `$@`, `$1` | `$argv`, `$argv[1]` |
| Condição | `if …; then …; fi` | `if …; …; end` |
| Loop | `for …; do …; done` | `for …; …; end` |
| Função | `hej() { …; }` | `function hej; …; end` |
| Aritmética | `$((17 * 23))` | `math 17 x 23` |

### Variáveis com set

Tente definir uma variável do jeito do bash (`frukt` é "fruta" em sueco, e
`äpple`, "maçã"):

```sh
frukt=äpple
```

O fish se recusa e diz como escrever:

```text
fish: Unsupported use of '='. In fish, please use 'set frukt äpple'.
```

É assim que se faz no fish:

```sh
set frukt äpple
echo $frukt
set -x EDITOR nano
set -e frukt
```

O `-x` (*export*) transforma a variável em uma variável de ambiente que os
programas que você inicia conseguem ver, e o `-e` (*erase*) a remove.

No fish, toda variável é uma **lista**. Os elementos são numerados a partir
de 1:

```sh
set frukter äpple päron banan
echo $frukter[2]
count $frukter
```

O `-c` também funciona no fish. O que o último comando imprime?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'set frukter äpple päron banan; echo $frukter[3]'
banan
---
Os elementos de uma lista do fish são numerados a partir de 1, então `[3]` é o
terceiro e último elemento.
```

### Substituição de comando e $status

No fish, a substituição de comando é escrita com parênteses simples:

```sh
echo "Estou em" (pwd)
```

Dentro de aspas, parênteses são texto comum – é por isso que o `(pwd)` fica
de fora. O status de saída do último comando se chama `$status`:

```sh
false
echo $status
```

### and, or e not

O fish tem comandos próprios para encadear condições:

```sh
test -f ~/.bashrc; and echo exists
test -f ~/missing.txt; or echo missing
```

Versões mais novas do fish (3.0 em diante) também entendem `&&` e `||`, e a
partir da 3.4 o `$(...)` também funciona. Mas `X=1`, `$?` e `$((...))`
continuam não funcionando – eles dão erros que mostram o jeito do fish.

### Blocos terminam com end

No fish, todo bloco – `if`, `for`, `while`, `switch` e `function` – termina
com `end`. Não existe `then`, `do`, `done` nem `fi`:

```sh
for i in 1 2 3; echo $i; end
if test -f ~/.bashrc; echo exists; else; echo missing; end
```

Você também pode escrever o bloco em várias linhas. O shell espera pelo
`end` antes de executar o loop:

```sh
for f in ~/dokument/*.txt
echo (basename $f)
end
```

As funções recebem os argumentos na lista `$argv`:

```sh
function hello; echo "Olá, $argv!"; end
hello Kim
```

### Aritmética com math

O fish não tem `$((...))`. No lugar existe o comando `math`, que também lida
com decimais:

```sh
math 17 x 23
math 10 / 4
```

Escreva `x` (ou `"17 * 23"` entre aspas) para multiplicação – um `*` sozinho
é um curinga no fish, igual no bash.

### Configurações do fish

O fish lê o `~/.config/fish/config.fish` quando inicia. Se quiser se livrar
da mensagem de boas-vindas, esvazie a variável `fish_greeting`. Com `-U` a
variável se torna **universal**: ela é salva em
`~/.config/fish/fish_variables` e vale em todos os shells fish, mesmo depois
de reiniciar.

```sh
cat ~/.config/fish/config.fish
set -U fish_greeting ""
```

Saia do fish com `exit`:

```sh
exit
```

## Por que os scripts continuam sendo escritos para o bash

Qual shell você usa no terminal é questão de gosto. Mas os **scripts** são
quase sempre escritos para o bash (ou para o `sh` POSIX):

- O bash está instalado em praticamente todo sistema Linux – o zsh e o fish,
  não.
- A sintaxe do fish não funciona no bash, e vice-versa.
- A linha `#!` no topo do script decide qual shell o executa –
  **independentemente** de qual shell você está usando.

Experimente escrever um script de bash e executá-lo a partir do fish:

```sh
cat > ~/hej.sh << 'SLUT'
#!/bin/bash
name=Kim
echo "Olá, $name, quem me executa é o bash"
SLUT
chmod +x ~/hej.sh
fish
~/hej.sh
exit
```

O script funciona no fish, mesmo que `name=Kim` seja proibido lá – porque
quem o executa é o bash. É por isso que o `#!/bin/bash` (ou
`#!/usr/bin/env bash`) importa tanto. Um script que precisa funcionar em todo
lugar, até onde não há bash, é escrito com `#!/bin/sh` e só com sintaxe
POSIX.

```quiz
Você está no fish e executa um script que começa com `#!/bin/bash` e
contém a linha `count=3`. O que acontece?
- [ ] O fish se recusa, porque `count=3` não é permitido no fish
- [x] Funciona – o bash executa o script, seja qual for o shell em que você está
- [ ] Só funciona se você primeiro mudar o seu shell de login para o bash com `chsh`
---
A linha `#!` decide qual shell executa o script. O fish só o inicia.
```

## Mudando o seu shell padrão com chsh

Digitar `zsh` toda vez que você abre um terminal cansa. Com o `chsh` (*change
shell*) você muda o seu **shell de login** – o que está em `/etc/passwd`:

```sh
chsh -s /usr/bin/zsh
grep elev /etc/passwd
```

- O shell precisa ser informado com o caminho completo e estar listado em
  `/etc/shells`.
- O `chsh` pede a sua senha (o simulador pula essa parte).
- A alteração vale a partir do **próximo login**. O terminal que você tem
  aberto mantém o shell antigo, e o `$SHELL` só muda depois que você fizer
  login de novo.
- O root pode mudar o shell de outros: `sudo chsh -s /usr/bin/fish kim`.

Para voltar ao bash, faça a mesma coisa:

```sh
chsh -s /bin/bash
```

Um conselho comum para o fish é manter o bash como shell de login e deixar o
programa de terminal iniciar o fish – assim tudo o que espera um shell POSIX
no login continua funcionando.

A pergunta começa em um terminal novo, instala o zsh e o torna o shell de
login. O que o último comando imprime?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y zsh > /dev/null 2>&1
$ chsh -s /usr/bin/zsh > /dev/null 2>&1
$ echo $SHELL
/bin/bash
---
O `chsh` alterou a sua linha em `/etc/passwd`, mas a alteração vale a partir do
próximo login. O terminal que você tem aberto mantém o bash, e o `$SHELL` também.
```

## Qual shell escolher?

- **bash** – o padrão em todo lugar. O que você aprende aqui funciona em
  qualquer servidor em que você vier a fazer login. Escreva os seus scripts
  para o bash.
- **zsh** – para quem quer mais conforto, mas sem abrir mão da sintaxe do
  bash. O Oh My Zsh traz temas e plugins.
- **fish** – a melhor experiência logo de cara, mas com uma sintaxe
  diferente. Comandos que você copia da web nem sempre funcionam.
- **sh/dash** – para scripts que precisam funcionar em todo lugar, e em
  sistemas pequenos.

## Resumo

| Comando | Faz |
|---|---|
| `cat /etc/shells` | Lista os shells que podem ser usados |
| `echo $0` / `ps` | Mostra qual shell você está rodando agora |
| `echo $SHELL` | Mostra o seu shell de login |
| `zsh` / `fish` / `exit` | Inicia outro shell / volta |
| `ls ~/**/*.txt` | Busca em todos os subdiretórios (zsh, fish) |
| `setopt autocd` | Liga uma opção do zsh |
| `set frukt äpple` | Define uma variável no fish |
| `set -x NOME valor` | Define uma variável de ambiente no fish |
| `chsh -s /usr/bin/zsh` | Muda o seu shell de login |

Os arquivos de configuração: `~/.bashrc` (bash), `~/.zshrc` (zsh) e
`~/.config/fish/config.fish` (fish).
