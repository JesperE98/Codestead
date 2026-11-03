# Resumo: Mais ferramentas

Nesta parte você conheceu duas ferramentas que vai usar pelo resto da vida
no terminal: o git, que guarda o histórico dos seus arquivos, e outros shells
além do bash. Aqui está o que você deve lembrar antes da prova.

## Git no terminal

O **git** é um sistema de controle de versão: ele salva retratos do projeto
inteiro, lembra quem alterou o quê e por quê, e permite voltar no tempo. No
Ubuntu você o instala com `sudo apt install git`; outras distribuições usam o
seu próprio gerenciador de pacotes.

- Antes do seu primeiro commit, você diz ao git quem você é com
  `git config --global user.name` e `user.email`. `--global` significa todos
  os seus projetos; as configurações vão parar em `~/.gitconfig`.
- O `git init` transforma um diretório em um **repositório**. Todo o
  histórico fica no diretório oculto `.git`.
- Uma alteração passa por três lugares: o **diretório de trabalho** (os
  arquivos que você vê), o **índice** (o que vai entrar no próximo commit) e
  o **histórico** (os commits). O `git add` leva alterações para o índice, e o
  `git commit` salva o índice como um novo commit.
- O `git commit -a` inclui todos os arquivos alterados que o git já
  acompanha – mas nunca arquivos novos.
- O `git diff` mostra alterações que ainda não estão no índice; o
  `git diff --staged` mostra o que está no índice.
- Um **branch** é uma etiqueta que aponta para um commit e avança junto com
  os novos commits. Quando você muda de branch, o git reescreve o diretório
  de trabalho.
- O `git merge` traz um branch para aquele em que você está. Se os dois
  branches alteraram as mesmas linhas, você recebe um **conflito**: corrija o
  arquivo, faça `git add` nele e termine com `git commit`.
- O `.gitignore` lista arquivos que o git não deve acompanhar. Ele só vale
  para arquivos que o git ainda não acompanha.
- Um **remote** é uma cópia do repositório em outro lugar, normalmente
  chamada de `origin`. O `git pull` busca e faz o merge, e o `git push` envia
  os seus commits.

| Comando | O que faz |
|---|---|
| `git config --global user.name "…"` | Diz ao git o seu nome (e `user.email`) |
| `git init` | Transforma o diretório em um repositório |
| `git status` | Mostra onde está cada alteração |
| `git add FILE` / `git add .` | Coloca alterações no índice |
| `git commit -m "…"` | Salva o índice como um novo commit |
| `git commit -am "…"` | Inclui todos os arquivos acompanhados e faz o commit em um passo |
| `git diff` / `git diff --staged` | Mostra alterações que não estão no commit |
| `git log --oneline --graph --all` | Mostra o histórico |
| `git restore FILE` | Descarta as alterações em um arquivo |
| `git restore --staged FILE` | Tira um arquivo do índice |
| `git switch -c BRANCH` / `git switch BRANCH` | Cria um branch / muda de branch |
| `git merge BRANCH` | Faz o merge de um branch naquele em que você está |
| `git branch -d BRANCH` | Apaga um branch que já passou pelo merge |
| `git rm --cached FILE` | Para de acompanhar um arquivo, mas o mantém no disco |
| `git clone`, `git pull`, `git push` | Colabora por meio de um remote |

## Outros shells: zsh e fish

O **shell** lê o que você digita e inicia outros programas. Programas como
`ls` e `grep` funcionam igual em todos os shells – o que muda é a linguagem
em volta deles: variáveis, loops, condições e o prompt.

- O `/etc/shells` lista os shells que podem ser shells de login. O seu shell
  de login é o último campo da sua linha em `/etc/passwd` e também está em
  `$SHELL`. O `$0` guarda o shell que você está rodando agora.
- O **zsh** entende quase toda a sintaxe do bash e acrescenta comodidades: o
  `**/` procura em todos os subdiretórios, e com o `autocd` você vai para um
  diretório só digitando o nome dele. As opções são ligadas e desligadas com
  `setopt` e `unsetopt`. Diferentemente do bash, o zsh não divide variáveis
  sem aspas nos espaços.
- O **fish** é fácil de usar desde o começo, mas tem **a sua própria
  sintaxe**: `set` em vez de `=`, `$status` em vez de `$?`, `math` em vez de
  `$((...))`, e todo bloco termina com `end`. Toda variável é uma lista,
  numerada a partir de 1.
- Um shell iniciado roda **dentro** do bash; o `exit` leva você de volta. Com
  `-c`, um shell executa um comando e termina.
- Os scripts continuam sendo escritos para o bash (ou para o `sh` POSIX): a
  linha `#!` decide qual shell executa um script, seja qual for o shell em que
  você estiver.
- O `chsh -s` muda o seu shell de login. A mudança vale a partir do próximo
  login.

| Comando | O que faz |
|---|---|
| `cat /etc/shells` | Lista os shells que podem ser usados |
| `echo $0` / `ps` | Mostra qual shell você está rodando agora |
| `echo $SHELL` | Mostra o seu shell de login |
| `zsh` / `fish` / `exit` | Inicia outro shell / volta |
| `zsh -c '…'` / `fish -c '…'` | Executa um comando em outro shell |
| `setopt autocd` / `unsetopt autocd` | Liga / desliga uma opção do zsh |
| `set {{fruitVar}} {{fruitWord}}` / `set -e {{fruitVar}}` | Define / remove uma variável no fish |
| `set -x NAME value` | Define uma variável de ambiente no fish |
| `math 17 x 23` | Aritmética no fish |
| `chsh -s /usr/bin/zsh` | Muda o seu shell de login |

Os arquivos de configuração: `~/.bashrc` (bash), `~/.zshrc` (zsh) e
`~/.config/fish/config.fish` (fish).
