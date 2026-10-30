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

## De um arquivo – `<`

O `<` faz um programa ler o stdin a partir de um arquivo:

```sh
wc -l < dokument/frukter.txt
```

## Mensagens de erro – `2>`

As mensagens de erro vão para o stderr e não são afetadas pelo `>`. Para
lidar com elas, escreva o número do fluxo na frente:

```sh
ls /finnsinte 2> fel.txt
```

(*Finns inte* é "não existe" em sueco, e *fel* significa "erro".)

O arquivo `/dev/null` é um "buraco negro" – tudo o que é escrito nele
desaparece. Isso é útil para silenciar erros. Com `2>&1`, o stderr vai para o
mesmo lugar que o stdout.

## Pipes – `|`

Um **pipe** manda o stdout de um comando diretamente para o stdin do próximo.
Esse é o coração da filosofia Unix: *faça uma coisa e faça bem feito, e deixe
os programas trabalharem juntos*.

```sh
grep INFO dokument/server.log | wc -l
```

O `grep` encontra as linhas e o `wc -l` as conta. Você pode encadear quantos
comandos quiser:

```sh
sort dokument/frukter.txt | uniq -c | sort -rn
```

Leia passo a passo: ordene as frutas, conte quantas há de cada uma
(`uniq -c`) e depois ordene numericamente, com a maior primeiro (`sort -rn`).

## Tela e arquivo ao mesmo tempo – `tee`

O `tee` repassa a sua entrada *e* salva uma cópia em um arquivo:

```sh
ls /etc | tee etc-lista.txt | wc -l
```

## Encadeamentos – `;`, `&&` e `||`

Vários comandos podem ficar na mesma linha:

| Sintaxe | Significa |
|---|---|
| `a ; b` | Executa a, depois b |
| `a && b` | Executa b só se a tiver dado certo |
| `a \|\| b` | Executa b só se a tiver falhado |

```sh
mkdir -p ny && cd ny
```
