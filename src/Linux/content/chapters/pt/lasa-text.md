# Lendo e pesquisando texto

Quase tudo no Linux é texto: configurações, logs, listas. Por isso existem
muitas ferramentas pequenas para ler e pesquisar arquivos de texto. No seu
diretório pessoal há um diretório chamado `{{documents}}` com arquivos para
praticar, entre eles `{{fruits}}`, uma lista de frutas, e `server.log`, o log
de um servidor web inventado. As palavras que você vai procurar no log – `INFO`,
`WARN` e `ERROR` – são as mesmas dos logs de verdade.

## Mostrando um arquivo – `cat` e `less`

O `cat` imprime o arquivo inteiro:

```sh
cat {{documents}}/{{fruits}}
```

Para arquivos longos, o `less` é melhor. Nele você rola com as setas e a barra
de espaço, pesquisa com `/palavra` e sai com `q`.

Veja a lista de frutas – você vai precisar dela na próxima pergunta:

```try
cat {{documents}}/{{fruits}}
```

## O começo e o fim – `head` e `tail`

O `head` mostra as primeiras linhas e o `tail`, as últimas. O padrão é 10
linhas, mas você pode escolher com `-n`:

```sh
head -n 5 {{documents}}/server.log
tail -n 3 {{documents}}/server.log
```

O `tail -f` *acompanha* um arquivo e mostra as linhas novas à medida que são
escritas – perfeito para logs. Interrompa com **Ctrl+C**.

```predict
$ tail -n 1 {{documents}}/{{fruits}}
manga
---
O `tail -n 1` mostra só a última linha.
```

## Contando – `wc`

O `wc` (*word count*) conta linhas, palavras e bytes:

```sh
wc {{documents}}/{{fruits}}
```

Muitas vezes você só quer o número de linhas: `wc -l`.

## Pesquisando – `grep`

O `grep` é um dos comandos mais úteis que existem. Ele mostra todas as linhas
que contêm um padrão:

```sh
grep INFO {{documents}}/server.log
```

Algumas opções que você vai usar bastante:

| Opção | Significado |
|---|---|
| `-i` | Ignora a diferença entre maiúsculas e minúsculas |
| `-n` | Mostra os números das linhas |
| `-v` | Mostra as linhas que *não* correspondem |
| `-c` | Conta as linhas que correspondem |
| `-r` | Pesquisa recursivamente em todos os arquivos de um diretório |
| `-E` | Padrões estendidos, por exemplo `"ERROR|WARN"` |

```sh
grep -n WARN {{documents}}/server.log
```

O padrão é uma *expressão regular*. Alguns exemplos: `^` significa o início da
linha e `$`, o fim da linha, então `grep "^2026"` encontra as linhas que
começam com 2026.

```quiz
O `server.log` tem duas linhas com `WARN` e uma linha com `warn` em minúsculas.
O que `grep -c WARN {{documents}}/server.log` imprime?
- [ ] 1
- [x] 2
- [ ] 3
---
O `-c` conta as linhas que correspondem, e sem `-i` maiúsculas e minúsculas são
diferentes. O `grep -ic WARN` contaria as três.
```

```quiz
Qual comando mostra todas as linhas do `server.log` que **não** contêm `INFO`?
- [ ] `grep -i INFO {{documents}}/server.log`
- [ ] `grep -c INFO {{documents}}/server.log`
- [x] `grep -v INFO {{documents}}/server.log`
```

## Ordenando – `sort` e `uniq`

O `sort` ordena linhas em ordem alfabética (`-n` para números, `-r` para ordem
inversa). O `uniq` remove as linhas idênticas à linha *imediatamente acima* –
e é por isso que ele quase sempre é usado depois do `sort`:

```sh
sort {{documents}}/{{fruits}}
```

```quiz
Por que o `uniq` quase sempre é usado depois do `sort`?
- [ ] O `uniq` só funciona em arquivos ordenados e falha nos outros
- [x] O `uniq` só remove as linhas idênticas à linha imediatamente acima, então as linhas iguais precisam estar uma ao lado da outra
- [ ] O `sort` remove as duplicatas e o `uniq` as coloca de volta
```

## Recortando campos – `cut`

Em `{{documents}}` há um terceiro arquivo de exercício, um arquivo CSV com as
pontuações dos alunos em diferentes disciplinas:

```sh
cat ~/{{documents}}/{{grades}}
```

CSV significa *comma-separated values* (valores separados por vírgula) – as
colunas são separadas por vírgulas, e a primeira linha é um cabeçalho.

Quando um arquivo é formado por campos com um separador entre eles, o `cut`
consegue pegar um campo. O `-d` escolhe o separador (*delimiter*) e o `-f`,
qual campo manter. Aqui estão as matérias – o campo 2 – do arquivo CSV:

```sh
cut -d, -f2 ~/{{documents}}/{{grades}}
```

No `/etc/passwd`, os campos são separados por dois-pontos e o campo 1 é o nome
de usuário, então `cut -d: -f1 /etc/passwd` lista todos os usuários.

## O manual – `man`

Esqueceu o que uma opção faz? Todo comando tem uma página de manual:

```sh
man grep
```
