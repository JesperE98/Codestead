# Variáveis, PATH e aliases

O shell tem uma memória própria na forma de **variáveis**. Neste capítulo
você vai aprender a ler e definir variáveis, como o shell encontra os
programas e como criar os seus próprios atalhos.

## Variáveis de ambiente

Você lê uma variável colocando um `$` na frente do nome dela:

```sh
echo $HOME
echo "Meu nome é $USER"
```

O `env` lista todas as *variáveis de ambiente* – variáveis que os programas
que você inicia também conseguem ler:

```sh
env
```

Você cria uma variável com `NOME=valor` (sem espaços em volta do `=`!). Com o
`export` ela se torna uma variável de ambiente:

```sh
export EDITOR=nano
```

```quiz
Qual linha cria a variável `COR` com o valor `azul`?
- [ ] `COR = azul`
- [x] `COR=azul`
- [ ] `$COR=azul`
---
Não pode haver espaços em volta do `=`. Com espaços, o shell acha que `COR`
é um comando. O `$` só é usado quando você *lê* uma variável.
```

## Aspas simples e duplas

Existe uma diferença importante:

```sh
echo "Pasta pessoal: $HOME"
echo 'Pasta pessoal: $HOME'
```

Dentro de aspas **duplas**, as variáveis são substituídas pelos seus valores.
Dentro de aspas **simples**, tudo é impresso exatamente como foi escrito.

```predict
$ x=linux
$ echo "I like $x"
$ echo 'I like $x'
I like linux
I like $x
```

## PATH – onde ficam os comandos?

Quando você digita `ls`, o shell procura um arquivo chamado `ls` nos
diretórios listados na variável `PATH`, um depois do outro:

```sh
echo $PATH
```

O `which` mostra onde um programa foi encontrado. Alguns comandos, como o
`cd`, nem são arquivos: eles são *embutidos* no shell (*builtins*) – o `type`
diz o que um nome é:

```sh
which ls
type cd
```

Se quiser executar um programa que não está no `PATH`, você precisa informar
o caminho dele, por exemplo `./meuprograma` para um arquivo no diretório em
que você está.

```quiz
Você tem um programa chamado `ola` no diretório em que está, e esse
diretório não está no `PATH`. Como você o executa?
- [ ] `ola`
- [x] `./ola`
- [ ] `type ola`
---
Sem um caminho, o shell só procura nos diretórios do `PATH`. `./ola`
diz exatamente onde o arquivo está: no diretório atual.
```

## Códigos de saída – `$?`

Todo comando deixa um **código de saída** (*exit code*) quando termina: `0`
significa que tudo deu certo, qualquer outro valor indica um erro. O código de
saída mais recente fica guardado em `$?`:

```sh
ls /{{missing}}
echo $?
```

É o código de saída que o `&&` e o `||` verificam.

## Aliases

Um **alias** é um atalho seu:

```sh
alias ll='ls -la'
ll
```

O `alias` sem argumentos lista todos os aliases, e `unalias ll` remove um.

```predict
$ alias ola='echo Hello'
$ ola
Hello
```

## Salvando configurações – `~/.bashrc`

As variáveis e os aliases que você cria desaparecem quando você fecha o
terminal. Para mantê-los, coloque-os no arquivo `~/.bashrc`, que o bash lê
toda vez que um novo terminal é aberto. Depois de alterar o arquivo, você pode
carregá-lo na hora com:

```sh
source ~/.bashrc
```

```quiz
Você cria um alias, fecha o terminal e abre um novo. O alias
sumiu. O que você deveria ter feito?
- [ ] Executado `alias` sem argumentos
- [x] Colocado o alias no `~/.bashrc`
- [ ] Criado o alias com `export`
---
Tudo o que você coloca no `~/.bashrc` é lido de novo toda vez que um novo
terminal é aberto.
```
