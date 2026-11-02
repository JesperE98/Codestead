# Git no terminal

Você já salvou arquivos chamados `report-final.txt`, `report-final-2.txt` e
`report-REALLY-final.txt`? Então você já fez *controle de versão* na mão. Um
sistema de controle de versão faz a mesma coisa do jeito certo: ele salva
retratos (*snapshots*) do projeto inteiro, lembra quem mudou o quê e por quê,
deixa você voltar no tempo e permite que muitas pessoas trabalhem nos mesmos
arquivos ao mesmo tempo.

O **Git** é, de longe, o sistema de controle de versão mais usado. Ele foi
escrito em 2005 por Linus Torvalds – a mesma pessoa que escreveu o kernel
Linux – para gerenciar o código-fonte do kernel. Hoje o git é usado em quase
todo software, mas funciona igualmente bem para sites, arquivos de
configuração, anotações e livros. Qualquer coisa que seja texto combina
perfeitamente com ele.

O git foi feito para o terminal. Programas gráficos e editores têm botões de
git, mas por baixo dos panos eles executam os mesmos comandos que você vai
aprender aqui.

## Instalando o git

O git nem sempre vem pré-instalado. No terminal Ubuntu, você o instala com o
apt:

```sh
sudo apt update
sudo apt install git
```

Outras distribuições o instalam com o próprio gerenciador de pacotes, como
você aprendeu na parte sobre distribuições e pacotes – lá o pacote também se
chama `git`. Verifique se ele funciona:

```sh
git --version
```

Todos os comandos do git têm a forma `git COMANDO`, por exemplo `git status`
ou `git log`. O manual está disponível com `man git`.

## Diga ao git quem você é

Cada versão salva no git contém o nome e o endereço de e-mail de quem a fez.
Por isso o git quer saber quem você é antes que você possa salvar qualquer
coisa. Você configura isso uma vez por computador:

```sh
git config --global user.name "{{gitName}}"
git config --global user.email "{{user}}@example.com"
```

Fique à vontade para usar o seu próprio nome. `--global` significa que a
configuração vale para todos os seus projetos. Ela é guardada no arquivo de
texto comum `~/.gitconfig`:

```sh
cat ~/.gitconfig
```

```text
[user]
	name = {{gitName}}
	email = {{user}}@example.com
```

Se você esquecer esse passo, o git reclama quando você tentar salvar:
`*** Please tell me who you are.` – e sugere exatamente esses dois comandos.

> **Dica:** Execute também `git config --global init.defaultBranch main`.
> Assim o branch principal de todo projeto novo se chama `main` em todos os
> seus computadores. Versões mais antigas do git o chamam de `master`, e você
> vai ver os dois nomes por aí.

## Um repositório novo

O seu diretório pessoal contém um pequeno projeto web, `~/{{webProject}}`,
com três arquivos. Vá até lá e dê uma olhada:

```sh
cd ~/{{webProject}}
ls
```

Para que o git comece a acompanhar o diretório, transforme-o em um
**repositório** (*repo*, para abreviar):

```sh
git init
```

```text
Initialized empty Git repository in /home/{{user}}/{{webProject}}/.git/
```

A única coisa que aconteceu é que um diretório oculto, `.git`, foi criado. É
ali que o git guarda todo o histórico. O git não mexe nos seus arquivos.

```sh
ls -a
ls .git
```

Nunca apague o `.git`, a menos que você queira perder o histórico – e não
edite os arquivos dentro dele na mão. Se você quiser parar de usar o git em
um projeto, basta remover o `.git`; os seus arquivos comuns continuam lá.

```quiz
Você quer parar de usar o git em um projeto, mas manter todos os seus arquivos. O que você faz?
- [ ] Executa `git init` de novo
- [x] Remove o diretório oculto `.git`
- [ ] Remove todos os arquivos, menos o `.git`
---
Todo o histórico fica no `.git`, e o git não mexe nos seus arquivos comuns.
Sem o `.git` os arquivos continuam lá – só o histórico some.
```

## Três lugares: diretório de trabalho, índice e histórico

A coisa mais importante para entender no git é que uma alteração passa por
três lugares:

```text
 diretório de trabalho  ──git add──▶  índice  ──git commit──▶  histórico
 (os arquivos que você vê)        (próximo commit)              (.git)
```

- O **diretório de trabalho** (*working tree*) são os arquivos como estão
  agora, os que você edita.
- O **índice** (também chamado de *staging area*, ou área de preparação) é
  uma espécie de mesa de embalagem. É ali que você coloca o que deve entrar na
  próxima versão salva.
- O **histórico** é formado por **commits**. Um commit é um retrato salvo de
  todos os arquivos, com uma mensagem, um autor e uma data.

Por que o passo do meio? Para que você possa escolher. Se você alterou cinco
arquivos, mas só dois têm a ver um com o outro, você pode colocar esses dois
no índice, fazer o commit deles e deixar o resto para um commit separado.

```quiz
Você alterou cinco arquivos, mas só duas das alterações têm a ver uma com a
outra. Como você salva só essas duas em um commit?
- [ ] Executa `git commit` primeiro e `git add` nos dois arquivos depois
- [x] Executa `git add` nos dois arquivos e depois `git commit`
- [ ] Faz o commit dos cinco – um commit sempre leva todos os arquivos alterados
---
Um commit salva o que está no índice. As outras três alterações ficam no
diretório de trabalho até você adicioná-las.
```

## O `git status` é a sua bússola

O comando que você vai executar com mais frequência é o `git status`. Ele diz
onde está cada alteração – e muitas vezes sugere o que fazer em seguida.
Na dúvida, execute-o mais vezes, e não menos!

```sh
git status
```

```text
On branch main

No commits yet

Untracked files:
  (use "git add <file>..." to include in what will be committed)
	README.md
	index.html
	style.css

nothing added to commit but untracked files present (use "git add" to track)
```

*Untracked files* são arquivos que o git vê, mas ainda não acompanha. Em um
terminal de verdade eles aparecem em vermelho. Coloque-os no índice com
`git add`:

```sh
git add index.html style.css README.md
git status
```

```text
Changes to be committed:
  (use "git rm --cached <file>..." to unstage)
	new file:   README.md
	new file:   index.html
	new file:   style.css
```

Agora eles aparecem em *Changes to be committed* – em verde. Em vez de citar
cada arquivo, você pode digitar `git add .`, que adiciona tudo no diretório
atual (o ponto significa “aqui”). `git add -A` adiciona todas as alterações
do repositório inteiro.

## O primeiro commit

Salve o retrato com `git commit`. A opção `-m` define a mensagem:

```sh
git commit -m "{{commitFirst}}"
```

```text
[main (root-commit) 3f2a9c1] {{commitFirst}}
 3 files changed, 24 insertions(+)
 create mode 100644 README.md
 create mode 100644 index.html
 create mode 100644 style.css
```

`3f2a9c1` é o começo do **id** do commit – um *hash* de
40 caracteres calculado a partir do conteúdo. O seu id vai ser diferente, já
que a data e o seu nome fazem parte dele. Os sete primeiros caracteres
costumam bastar para identificar um commit.

Execute `git status` de novo:

```sh
git status
```

```text
On branch main
nothing to commit, working tree clean
```

*Working tree clean* significa que tudo está salvo. Muito bem!

## Veja o que mudou: `git diff`

Acrescente uma linha ao `README.md` e pergunte ao git o que aconteceu:

```sh
echo '{{builtWith}}' >> README.md
git status
git diff
```

```text
diff --git a/README.md b/README.md
index 1100cf4..e5bd3a0 100644
--- a/README.md
+++ b/README.md
@@ -1,3 +1,4 @@
 # {{siteTitle}}
 
 Um pequeno site que eu mantenho sob controle de versão com o git.
+{{builtWith}}
```

A linha que começa com `+` é nova (verde), as linhas que começam com `-`
foram removidas (vermelho) e o resto aparece como contexto. `@@ -1,3 +1,4 @@`
significa que as linhas 1–3 da versão antiga correspondem às linhas 1–4 da
nova.

O `git diff` compara o diretório de trabalho com o índice – ou seja, o que
você *ainda não* adicionou. Para ver o que está no índice esperando o commit,
digite `git diff --staged`.

Adicione a alteração e faça o commit. A opção `-a` executa `git add` em todos
os arquivos que o git já acompanha, então basta um passo:

```sh
git commit -a -m "{{commitDescribe}}"
```

Repare que o `-a` *não* inclui arquivos novos que o git ainda não acompanha.
Esses você sempre precisa adicionar primeiro com `git add`.

As perguntas com comandos neste capítulo começam em um terminal novo, então
primeiro instalam o git e fazem o primeiro commit. O `> /dev/null 2>&1` joga
fora a saída dessas linhas, como você aprendeu no capítulo sobre
redirecionamento e pipes. O que o último comando imprime?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Primeira versão" > /dev/null
$ echo 'Mais uma linha.' >> README.md
$ git commit -m "Mais uma linha" > /dev/null
$ git log --oneline | wc -l
1
---
O segundo commit nunca aconteceu: a alteração no `README.md` não estava no
índice, então não havia nada para o commit. `git add README.md` antes – ou
`git commit -a` – teria dado dois commits.
```

## Boas mensagens de commit

Daqui a seis meses, são as mensagens de commit que vão contar a história –
para você e para os outros. Algumas regras práticas:

- Escreva uma primeira linha curta, de preferência com menos de 50
  caracteres, que resuma a alteração.
- Descreva *o que* a alteração faz e, de preferência, *por quê*, não *como*
  você a escreveu.
- Um commit deve fazer uma coisa só. Três commits pequenos são melhores do que
  um grande.
- Precisa explicar mais? Deixe uma linha em branco e escreva um texto mais
  longo embaixo. Cada `-m` vira um parágrafo próprio:
  `git commit -m "Título" -m "Explicação."`

| Ruim | Melhor |
|---|---|
| `fix` | `Fix broken link to the contact page` |
| `changes` | `Make headings larger on mobile` |
| `asdf` | `Add contact form` |

Em inglês, as mensagens costumam ser escritas no imperativo: *Add contact
form*, *Fix broken link*. Lê-se como “este commit vai …”. Em português, muita
gente usa o imperativo também (*Adiciona formulário de contato*) – o
importante é ser consistente no projeto.

## Olhando o histórico

```sh
git log
```

```text
commit 8d41b7e0c2a3f1d5e9b6a7c8d9e0f1a2b3c4d5e6 (HEAD -> main)
Author: {{gitName}} <{{user}}@example.com>
Date:   Fri Oct 30 14:12:09 2026 +0100

    {{commitDescribe}}

commit 3f2a9c1...
```

O commit mais novo vem primeiro. `HEAD -> main` significa que você está no
branch `main` e que este é o último commit dele. Algumas variantes úteis:

```sh
git log --oneline
git log -n 1
git log --stat
git show
```

`--oneline` mostra uma linha por commit, `-n 1` mostra só o último, `--stat`
mostra quais arquivos mudaram e `git show` mostra um commit incluindo a
própria alteração. Você também pode ver um arquivo como ele era em um commit
específico: `git show HEAD~1:README.md` (`HEAD~1` significa “o commit antes do
último”).

## Desfazendo

O git facilita desfazer as coisas – metade da graça é essa:

| Se você quer … | Comando |
|---|---|
| descartar alterações em um arquivo (ainda não adicionadas) | `git restore ARQUIVO` |
| tirar um arquivo do índice (a alteração continua) | `git restore --staged ARQUIVO` |
| mudar a mensagem do último commit | `git commit --amend -m "Nova mensagem"` |
| voltar a ter tudo como estava no último commit | `git reset --hard` |

Tente estragar um arquivo e recuperá-lo:

```sh
echo 'oops' > index.html
git diff
git restore index.html
cat index.html
```

> **Atenção!** `git restore ARQUIVO` e `git reset --hard` descartam alterações
> que nunca entraram em um commit. Elas não podem ser recuperadas. Já o que
> passou por um commit em algum momento quase sempre pode ser resgatado –
> pergunte ao `git reflog` por onde você andou.

## Branches

Um **branch** (ramo) é uma linha de desenvolvimento separada. Você pode
testar uma ideia nova em um branch sem mexer na versão que funciona, em
`main`. Se der certo, você faz o merge (mescla) do branch em `main`; se não
der, você o joga fora.

Tecnicamente, um branch é só uma etiqueta que aponta para um commit e anda
junto quando você faz commits novos. É por isso que branches são baratos no
git – use-os bastante!

```sh
git branch
git switch -c {{newDesign}}
git branch
```

`git switch -c {{newDesign}}` cria o branch e muda para ele. A
estrela em `git branch` mostra onde você está. Faça uma alteração e um commit
no branch:

```sh
echo 'h1 { color: purple; }' >> style.css
git commit -am "{{commitPurple}}"
```

Volte para `main` e olhe o `style.css`:

```sh
git switch main
tail -3 style.css
```

A cor roxa sumiu! Quando você troca de branch, o git reescreve o diretório de
trabalho para que ele fique igual ao último commit do branch. A alteração
está segura em `{{newDesign}}`. `git log --oneline --all` mostra todos os
branches:

```sh
git log --oneline --all
```

> **Dica:** Guias mais antigos costumam usar `git checkout {{newDesign}}` e
> `git checkout -b new-branch`. O `checkout` faz o mesmo que o `switch`, mas
> também restaura arquivos. Os comandos mais novos `switch` e `restore`
> dividem as tarefas e são mais fáceis de lembrar.

Alterações sem commit vão junto quando você troca de branch – a não ser que
entrem em conflito com o outro branch. Aí o git se recusa e pede que você
faça o commit primeiro (ou que guarde as alterações temporariamente com
`git stash` e as traga de volta com `git stash pop`).

O `style.css` original não contém nenhum `purple` – os títulos dele são
azul-marinho (`navy`). Quantas linhas com `purple` o `style.css` tem no final?

```predict
$ sudo apt update > /dev/null 2>&1 && sudo apt install -y git > /dev/null 2>&1
$ git config --global user.name "{{gitName}}"
$ git config --global user.email "{{user}}@example.com"
$ cd ~/{{webProject}} && git init > /dev/null 2>&1
$ git add . && git commit -m "Primeira versão" > /dev/null
$ git switch -c {{newDesign}} > /dev/null 2>&1
$ echo 'h1 { color: purple; }' >> style.css
$ git commit -am "{{commitPurple}}" > /dev/null
$ git switch main > /dev/null 2>&1
$ grep purple style.css | wc -l
0
---
A linha roxa foi para o commit em `{{newDesign}}`. Quando você troca para `main`,
o git deixa o diretório de trabalho igual ao último commit de `main` – onde a
linha ainda não existe.
```

## Mesclando branches: `git merge`

Fique no branch que vai *receber* as alterações – aqui, `main` – e faça o
merge:

```sh
git merge {{newDesign}}
```

```text
Updating 8d41b7e..c19e2f4
Fast-forward
 style.css | 1 +
 1 file changed, 1 insertion(+)
```

*Fast-forward* significa que `main` não mudou desde que o branch foi criado.
Então o git só precisa mover `main` para a frente, até o mesmo commit de
`{{newDesign}}`.

Se os dois branches têm commits novos, o git faz um **merge de três vias**
(*three-way merge*): ele compara os dois branches com o ancestral comum e cria
um novo *commit de merge* com dois pais. `git log --oneline --graph --all`
mostra como o histórico se divide e se junta de novo:

```text
*   e4b1d0a (HEAD -> main) Merge branch 'titulo'
|\
| * 7c3f9e2 (titulo) Título mais amigável
* | 52d8a71 Texto mais curto
|/
* c19e2f4 {{commitPurple}}
```

Um branch que já foi mesclado não é mais necessário e pode ser apagado. O
`-d` se recusa se o branch tiver commits que não estão no branch em que você
está:

```sh
git branch -d {{newDesign}}
```

## Conflitos

Se os dois branches mudaram *as mesmas linhas*, o git não tem como saber qual
versão é a certa. Isso se chama **conflito**, e aí quem decide é você. Vamos
criar um de propósito:

```sh
git switch -c titulo
sed -i 's/Bem-vindo!/Olá e bem-vindo!/' index.html
git commit -am "Título mais amigável"
git switch main
sed -i 's/Bem-vindo!/Bem-vindo ao meu site!/' index.html
git commit -am "Título mais longo"
git merge titulo
```

```text
Auto-merging index.html
CONFLICT (content): Merge conflict in index.html
Automatic merge failed; fix conflicts and then commit the result.
```

Calma – nada quebrou. O `git status` lista o arquivo em *Unmerged paths* como
`both modified`. Olhe dentro dele:

```sh
git status
cat index.html
```

```text
<<<<<<< HEAD
  <h1>Bem-vindo ao meu site!</h1>
=======
  <h1>Olá e bem-vindo!</h1>
>>>>>>> titulo
```

Entre `<<<<<<< HEAD` e `=======` está a sua versão (do branch em que você
está); entre `=======` e `>>>>>>> titulo` está a do outro branch. É assim que
você resolve o conflito:

1. Abra o arquivo em um editor e deixe-o do jeito que você quer – escolha uma
   das linhas, ou combine as duas – e apague as linhas de marcação.
2. Diga ao git que o conflito foi resolvido com `git add ARQUIVO`.
3. Termine o merge com `git commit`.

O simulador não tem um editor de verdade, mas se você só quiser escolher a
versão de um dos lados, o git pode fazer isso por você: `--ours` pega a sua
versão e `--theirs` pega a do outro branch.

```sh
git checkout --theirs index.html
git add index.html
git status
git commit -m "Mescla o branch titulo"
```

Se você mudar de ideia no meio de um conflito, `git merge --abort` leva você
de volta para onde estava antes do merge.

Conflitos são completamente normais quando várias pessoas trabalham no mesmo
projeto. Um bom jeito de ter menos conflitos é fazer commits pequenos e
mesclar com frequência.

```quiz
Você está em `main` e executa `git merge titulo`. O arquivo tem um conflito:

    <<<<<<< HEAD
      <h1>Olá!</h1>
    =======
      <h1>Bem-vindo!</h1>
    >>>>>>> titulo

Qual linha vem de `main`?
- [x] `<h1>Olá!</h1>`
- [ ] `<h1>Bem-vindo!</h1>`
---
`HEAD` é o branch em que você está – aqui, `main`. A versão dele fica entre
`<<<<<<< HEAD` e `=======`; a versão do outro branch vem depois de `=======`.
```

## Arquivos que o git deve ignorar: `.gitignore`

Alguns arquivos nunca devem ir parar no histórico: senhas e chaves, logs,
arquivos temporários e coisas que são geradas automaticamente. Escreva os
nomes ou padrões deles no arquivo `.gitignore`, na raiz do repositório:

```sh
echo 'senha=secreta' > segredo.txt
echo 'erro' > erro.log
printf 'segredo.txt\n*.log\nbuild/\n' > .gitignore
git status
```

```text
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	.gitignore
```

`segredo.txt` e `erro.log` não aparecem mais –
nem o `git add .` os pega. Um `*` corresponde a qualquer coisa, e uma barra
no final (`build/`) indica um diretório inteiro. O próprio `.gitignore`, por
outro lado, deve entrar em um commit, para que todo mundo que trabalha no
projeto ignore as mesmas coisas:

```sh
git add .gitignore
git commit -m "Ignora segredos e logs"
```

Repare que o `.gitignore` só vale para arquivos que o git ainda não
acompanha. Se um arquivo já entrou em um commit, remova-o do repositório (mas
não do disco) com `git rm --cached ARQUIVO`.

## GitHub, GitLab e repositórios remotos

Até agora tudo ficou no seu próprio repositório. Para colaborar, ou só para
ter um backup, normalmente você mantém uma cópia do repositório em um
servidor – um **remoto** (*remote*). Os serviços mais conhecidos são
**GitHub**, **GitLab** e **Codeberg**.

| Comando | Faz |
|---|---|
| `git clone URL` | Baixa um repositório inteiro, com todo o histórico, para um diretório novo |
| `git push` | Envia os seus commits novos para o remoto |
| `git pull` | Busca commits novos do remoto e os mescla com os seus |
| `git fetch` | Busca commits novos sem mesclar nada |
| `git remote -v` | Lista os remotos |

O remoto normalmente se chama `origin`, e um fluxo de trabalho típico é
assim: `git pull` quando você começa, depois editar, `git add` e
`git commit` – e por fim `git push`. O GitHub e o GitLab usam uma chave SSH ou
um token de acesso para fazer o seu login, não uma senha.

Tudo isso precisa de rede, e o simulador não tem. Mas `clone`, `push` e
`pull` funcionam igualmente bem entre dois repositórios no mesmo computador,
então você pode experimentar mesmo assim. Clone o seu projeto em um diretório
novo:

```sh
cd ~
git clone ~/{{webProject}} ~/copia
cd ~/copia
git log --oneline
git remote -v
```

Um servidor como o GitHub só tem o histórico, sem diretório de trabalho. Esse
tipo de repositório *bare* (“nu”) é criado com `git init --bare`. Faça de
conta que ele é a sua conta do GitHub e envie o `main` para lá:

```sh
git init --bare ~/server.git
cd ~/{{webProject}}
git remote add origin ~/server.git
git push -u origin main
git status
```

O `-u` liga o seu `main` ao `origin/main`, para que o `git status` possa dizer
se você está à frente ou atrás do servidor, e para que daí em diante bastem
apenas `git push` e `git pull`.

## Resumo

| Comando | Faz |
|---|---|
| `git init` | Transforma o diretório em um repositório |
| `git status` | Mostra a situação – execute-o com frequência! |
| `git add ARQUIVO` / `git add .` | Coloca alterações no índice |
| `git commit -m "…"` | Salva o índice como um novo commit |
| `git diff` / `git diff --staged` | Mostra alterações que ainda não entraram em um commit |
| `git log --oneline --graph --all` | Mostra o histórico |
| `git restore ARQUIVO` | Descarta as alterações em um arquivo |
| `git switch -c BRANCH` | Cria um branch e muda para ele |
| `git merge BRANCH` | Mescla um branch no branch em que você está |
| `git clone`, `git pull`, `git push` | Colaboração por meio de um remoto |
