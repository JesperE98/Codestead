# Redirecionamento e pipes

Este capítulo trata do que torna a linha de comando tão poderosa: *conectar*
programas pequenos entre si.

## Três fluxos

Todo programa tem três fluxos padrão:

| Número | Nome | O quê |
|---|---|---|
| 0 | stdin | Entrada, normalmente do teclado |
| 1 | stdout | Saída normal, normalmente para a tela |
| 2 | stderr | Mensagens de erro, também para a tela |

Com *redirecionamento* e *pipes* você pode mandar esses fluxos para outro
lugar.

## Para um arquivo – `>` e `>>`

O `>` manda o stdout para um arquivo em vez da tela. O arquivo é criado se não
existir – e **sobrescrito** se já existir!

```sh
echo "primeira linha" > test.txt
```

O `>>`, por sua vez, acrescenta ao final do arquivo:

```sh
echo "segunda linha" >> test.txt
cat test.txt
```

```predict
$ echo one > t.txt
$ echo two > t.txt
$ cat t.txt
two
---
O segundo `>` sobrescreveu o arquivo. Com `>>`, ele conteria as duas linhas.
```

## De um arquivo – `<`

`{{fruits}}` tem dez linhas, uma fruta por linha. Quando você passa um nome de
arquivo para o `wc -l`, ele imprime o número de linhas seguido do nome – aqui
para `{{grades}}`, que tem nove linhas:

```sh
wc -l {{documents}}/{{grades}}
```

```text
9 {{documents}}/{{grades}}
```

O `<` faz um programa ler o stdin a partir de um arquivo:

```sh
wc -l < {{documents}}/{{fruits}}
```

Agora o `wc` nunca vê o nome do arquivo – ele só recebe o texto pela stdin –,
então imprime apenas o número.

```predict
$ wc -l {{documents}}/{{fruits}}
$ wc -l < {{documents}}/{{fruits}}
10 {{documents}}/{{fruits}}
10
---
Com um nome de arquivo como argumento, o `wc` imprime o nome também. Com `<`,
ele só recebe o texto.
```

## Mensagens de erro – `2>`

As mensagens de erro vão para o stderr e não são afetadas pelo `>`. Para
lidar com elas, escreva o número do fluxo na frente:

```sh
ls /{{missing}} 2> erros.txt
```

```quiz
Você executa `ls /{{missing}} > erros.txt`. Para onde vai a mensagem de erro?
- [ ] Para `erros.txt`
- [x] Para a tela – `erros.txt` fica vazio
- [ ] Para lugar nenhum, ela desaparece
---
O `>` só redireciona a stdout (fluxo 1). A mensagem de erro vai para a stderr
(fluxo 2), que continua indo para a tela. Você precisaria de `2>`.
```

O arquivo `/dev/null` é um "buraco negro" – tudo o que é escrito nele
desaparece. Isso é útil para silenciar erros. Com `2>&1`, o stderr vai para o
mesmo lugar que o stdout.

## Pipes – `|`

Um **pipe** manda o stdout de um comando diretamente para o stdin do próximo.
Esse é o coração da filosofia Unix: *faça uma coisa e faça bem feito, e deixe
os programas trabalharem juntos*.

```sh
grep INFO {{documents}}/server.log | wc -l
```

O `grep` encontra as linhas e o `wc -l` as conta. Você pode encadear quantos
comandos quiser:

```sh
sort {{documents}}/{{fruits}} | uniq -c | sort -rn
```

Leia passo a passo: ordene as frutas, conte quantas há de cada uma
(`uniq -c`) e depois ordene numericamente, com a maior primeiro (`sort -rn`).

Quantos arquivos e diretórios existem em `/etc`? Conte-os com um pipe:

```try
ls /etc | wc -l
```

## Da entrada para argumentos – `xargs`

Alguns comandos nem leem de um pipe – eles querem nomes como **argumentos**:
`rm`, `mkdir`, `touch` e o `wc` quando ele deve contar dentro de arquivos. O
`xargs` faz a ponte: ele lê as palavras da sua entrada e as coloca depois de
um comando.

```sh
find {{documents}} -type f | xargs wc -l
```

Isso é o mesmo que escrever você mesmo cada nome de arquivo depois de
`wc -l`. Com `-n 1`, o `xargs` executa o comando uma vez para cada palavra, e
com `-I {}` uma vez para cada linha, com `{}` substituído pela linha:

```sh
ls {{documents}} | xargs -I {} echo "File: {}"
```

```predict
$ printf 'a\nb\nc\n' | xargs echo
a b c
---
O `xargs` juntou as três linhas e executou `echo a b c` – uma vez só.
```

## Tela e arquivo ao mesmo tempo – `tee`

O `tee` repassa a sua entrada *e* salva uma cópia em um arquivo:

```sh
ls /etc | tee lista-etc.txt | wc -l
```

## Encadeamentos – `;`, `&&` e `||`

Vários comandos podem ficar na mesma linha:

| Sintaxe | Significa |
|---|---|
| `a ; b` | Executa a, depois b |
| `a && b` | Executa b só se a tiver dado certo |
| `a \|\| b` | Executa b só se a tiver falhado |

```sh
mkdir -p novo && cd novo
```

```predict
$ mkdir {{documents}} 2> /dev/null && echo created || echo failed
failed
---
`{{documents}}` já existe, então o `mkdir` falha (a mensagem de erro dele some em
`/dev/null`). O `echo created` é pulado e o `echo failed` é executado.
```
