# Prova: O básico

Responda às perguntas abaixo para mostrar o que você aprendeu nesta parte.

```quiz
Qual destes caminhos é **absoluto**?
- [ ] `var/log`
- [ ] `../etc`
- [x] `/usr/bin`
- [ ] `dokument`
---
Um caminho absoluto começa com `/`, na raiz. Os outros partem do diretório em
que você está.
```

```predict
$ cd /var/log
$ cd ../..
$ pwd
/
---
Cada `..` sobe um nível: de `/var/log` para `/var` e depois para `/`.
```

```quiz
O que o `cd -` faz?
- [ ] Sobe um nível
- [ ] Vai para o seu diretório pessoal
- [x] Volta para o último diretório em que você esteve
```

```quiz
Você quer copiar o diretório inteiro `bilder`, com tudo o que há dentro dele, para `bilder-kopia`. Qual comando funciona?
- [ ] `cp bilder bilder-kopia`
- [x] `cp -r bilder bilder-kopia`
- [ ] `mv bilder bilder-kopia`
---
Um diretório é copiado com `-r` (*recursive*). O `mv` o moveria em vez de
copiá-lo.
```

```predict
$ mkdir -p a/b/c
$ ls a/b
c
---
O `-p` cria `a`, `a/b` e `a/b/c` de uma vez, então `a/b` contém `c`.
```

```quiz
Você digita `touch min fil.txt` – sem aspas. O que acontece?
- [ ] É criado um arquivo chamado `min fil.txt`
- [x] São criados dois arquivos: `min` e `fil.txt`
- [ ] Nada, porque o nome contém um espaço
---
O shell divide a linha nos espaços, então o `touch` recebe dois argumentos.
Escreva `touch "min fil.txt"` para obter um arquivo só.
```

```quiz
Quais linhas o `grep -i error dokument/server.log` mostra?
- [ ] Só as linhas com `error` em minúsculas
- [ ] Só as linhas com `ERROR` em maiúsculas
- [x] As linhas com `error` em qualquer mistura de maiúsculas e minúsculas
```

```quiz
Você quer acompanhar um arquivo de log e ver as linhas novas à medida que são escritas. Qual comando serve?
- [ ] `head -n 10 dokument/server.log`
- [x] `tail -f dokument/server.log`
- [ ] `wc -l dokument/server.log`
---
O `tail -f` *acompanha* o arquivo. Interrompa-o com **Ctrl+C**.
```

```quiz
O que o `wc` imprime quando você passa um arquivo e nenhuma opção?
- [ ] Só o número de linhas
- [x] O número de linhas, palavras e bytes
- [ ] As 10 primeiras linhas do arquivo
```

```predict
$ echo a > x.txt
$ echo b >> x.txt
$ echo c > x.txt
$ cat x.txt
c
---
O `>>` acrescentou o `b`, mas o último `>` sobrescreveu o arquivo inteiro.
```

```quiz
Quando o `b` é executado em `a || b`?
- [ ] Sempre, depois do `a`
- [ ] Só se o `a` deu certo
- [x] Só se o `a` falhou
```

```try
grep ERROR ~/dokument/server.log | tee fel.txt | wc -l
---
O `tee` salvou as linhas de erro em `fel.txt` e as passou adiante para o
`wc -l`, que as contou.
```

```predict
$ echo "a,b,c" | cut -d, -f2
b
---
O `-d,` faz da vírgula o separador, e o `-f2` mantém o campo 2.
```

```predict
$ echo "x y z" | awk '{print NF}'
3
---
`NF` é o número de campos na linha. Os campos são separados por espaços.
```

```quiz
Por que um programa awk como `'{print $3}'` deve ser escrito entre aspas **simples**?
- [ ] O awk não consegue ler aspas duplas
- [x] Senão o shell acha que `$3` é uma variável do shell e a substitui antes de o awk iniciar
- [ ] Aspas simples fazem o awk rodar mais rápido
```
