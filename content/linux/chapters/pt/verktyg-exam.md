# Prova: Mais ferramentas

Catorze perguntas sobre o git e outros shells. Você precisa de 80 % de
respostas certas para ser aprovado. As perguntas com comandos começam em um
terminal novo, por isso elas primeiro instalam o programa de que precisam –
o `> /dev/null 2>&1` descarta a saída dessas linhas.

```quiz
Você alterou o `index.html` e criou o arquivo novo `kontakt.html`. Você
executa `git commit -am "Contact page"`. O que entra no commit?
- [x] Só a alteração no `index.html`
- [ ] Só o `kontakt.html`
- [ ] Os dois arquivos
---
O `-a` inclui todos os arquivos alterados que o git já acompanha – mas nunca
arquivos novos. O `kontakt.html` precisa ser adicionado com `git add` antes.
```

```quiz
Você executou `git add` em uma alteração no `style.css`. Qual comando mostra
essa alteração?
- [ ] `git diff`
- [x] `git diff --staged`
- [ ] `git log`
---
O `git diff` compara o diretório de trabalho com o índice, então não mostra
nada quando a alteração já está no índice. O `--staged` mostra o que está
esperando o commit.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "Elev Elevsson"
$ git config --global user.email "elev@example.com"
$ cd ~/projekt-webb && git init > /dev/null 2>&1
$ git add . && git commit -m "Första versionen" > /dev/null
$ git switch -c ny-design > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "Lila rubriker" > /dev/null
$ git switch main > /dev/null 2>&1
$ git merge ny-design > /dev/null
$ git log --oneline | wc -l
2
---
O `main` não tinha mudado desde que o branch foi criado, então o merge foi
um *fast-forward*: o git só avançou o `main` até o commit do `ny-design`.
Nenhum commit de merge foi criado.
```

```quiz
O que é um branch no git, tecnicamente?
- [ ] Uma cópia completa de todos os arquivos do projeto
- [x] Uma etiqueta que aponta para um commit e avança quando você faz novos commits
- [ ] Um repositório separado, com o seu próprio diretório `.git`
---
É por isso que branches são baratos no git – use-os bastante.
```

```quiz
O `git merge` parou com um conflito no `index.html`. Você corrigiu o arquivo
e removeu as linhas de marcação. O que você faz em seguida?
- [ ] Executa `git merge` de novo
- [x] `git add index.html` e depois `git commit`
- [ ] `git restore index.html`
---
O `git add` diz ao git que o conflito foi resolvido, e o `git commit`
conclui o merge. O `git restore` jogaria fora a sua correção.
```

```quiz
O arquivo `fel.log` entrou em um commit por engano. Você acrescenta `*.log`
ao `.gitignore`, mas o git continua acompanhando o arquivo. Como você o
remove do repositório, mas o mantém no disco?
- [ ] `rm fel.log`
- [x] `git rm --cached fel.log`
- [ ] `git restore fel.log`
---
O `.gitignore` só vale para arquivos que o git ainda não acompanha. O
`--cached` remove o arquivo do git, mas o deixa no disco.
```

```quiz
Qual comando busca os commits novos do remote **sem** fazer o merge deles
com os seus?
- [ ] `git pull`
- [x] `git fetch`
- [ ] `git push`
- [ ] `git clone`
---
O `git pull` busca e faz o merge; o `git fetch` só busca.
```

```quiz
Quais destas alterações se perdem para sempre? Escolha todas as que se
aplicam.
- [x] Alterações em um arquivo que nunca entrou em um commit, descartadas com `git restore`
- [x] Alterações que nunca entraram em um commit, descartadas com `git reset --hard`
- [ ] Um commit que você fez ontem, antes de executar `git reset --hard`
---
Tudo o que em algum momento entrou em um commit quase sempre pode ser
recuperado – o `git reflog` mostra por onde você passou.
```

```quiz
Você iniciou o zsh a partir do bash. Qual comando mostra o shell que você
está rodando agora?
- [x] `echo $0`
- [ ] `echo $SHELL`
- [ ] `cat /etc/shells`
---
O `$SHELL` é o seu shell de login – ainda `/bin/bash`. O `/etc/shells` lista
os shells que podem ser usados como shells de login.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'math 10 / 4'
2.5
---
O `math` lida com decimais.
```

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y fish > /dev/null 2>&1
$ fish -c 'false; echo $status'
1
---
No fish, o status de saída do último comando se chama `$status` – o `false`
sempre falha.
```

```quiz
Como você transforma `EDITOR` em uma variável de ambiente com o valor `nano`
no fish?
- [ ] `export EDITOR=nano`
- [ ] `EDITOR=nano`
- [x] `set -x EDITOR nano`
- [ ] `set -e EDITOR nano`
---
O `-x` exporta a variável; o `-e` a apaga.
```

```quiz
Qual arquivo o zsh lê quando inicia?
- [ ] `~/.bashrc`
- [x] `~/.zshrc`
- [ ] `~/.config/fish/config.fish`
- [ ] `/etc/shells`
```

```try
grep elev /etc/passwd
---
O último campo da linha é o seu shell de login – aquele que o `chsh -s` muda.
```
