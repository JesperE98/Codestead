# Prova: O sistema

Responda às perguntas sobre variáveis, permissões, processos e arquivamento – você precisa de 80 % para ser aprovado.

```predict
$ echo "$HOME" '$USER'
/home/elev $USER
---
As aspas duplas substituem a variável pelo valor dela; as aspas simples a
imprimem exatamente como foi escrita.
```

```quiz
O que o `export` faz com uma variável?
- [ ] Salva-a no `~/.bashrc`
- [x] Transforma-a em uma variável de ambiente que os programas que você inicia também conseguem ler
- [ ] Apaga-a
```

```predict
$ ls ~ > /dev/null
$ echo $?
0
---
O `ls` deu certo, então o código de saída é `0`. A própria saída sumiu em
`/dev/null`.
```

```quiz
Qual número dá as permissões `rwxr-x---`?
- [ ] `755`
- [x] `750`
- [ ] `640`
---
Dono: 4 + 2 + 1 = 7. Grupo: 4 + 1 = 5. Outros: 0.
```

```predict
$ touch verktyg.sh
$ chmod 755 verktyg.sh
$ chmod go-x verktyg.sh
$ ls -l verktyg.sh | awk '{print $1}'
-rwxr--r--
```

```quiz
No Ubuntu, os membros de qual grupo podem usar o `sudo`?
- [x] `sudo`
- [ ] `root`
- [ ] `elev`
```

```quiz
O que o `sudo -i` faz?
- [ ] Mostra informações sobre o sudo
- [x] Inicia um shell de root, em que o prompt muda para `#`, até você digitar `exit`
- [ ] Executa de novo o comando anterior como root
```

```quiz
No `ps aux`, um processo tem `R` na coluna `STAT`. O que isso significa?
- [x] Ele está rodando
- [ ] Ele está dormindo
- [ ] Ele pertence ao root
```

```quiz
Qual variável guarda o PID do job em segundo plano mais recente?
- [ ] `$?`
- [x] `$!`
- [ ] `$#`
```

```quiz
Você tenta `kill 812` em um processo que pertence ao root e recebe
`Operation not permitted`. O que você faz?
- [ ] Usa `kill -9 812` em vez disso
- [x] Executa com `sudo`: `sudo kill 812`
- [ ] Nada – os processos do root nunca podem ser parados
```

```quiz
Qual é a diferença entre o `pkill` e o `killall`?
- [x] O `pkill` compara com um padrão, o `killall` precisa do nome exato
- [ ] O `pkill` envia `SIGKILL`, o `killall` envia `SIGTERM`
- [ ] Nenhuma – são o mesmo programa
```

```quiz
O que está errado em `tar -cvf dokument dokument.tar`?
- [ ] `-v` não pode ser combinado com `-c`
- [x] A ordem: o nome do arquivo tar tem que vir logo depois do `f`, antes dos arquivos
- [ ] Um arquivo tar tem que terminar em `.tgz`
```

```predict
$ cp dokument/frukter.txt .
$ gzip frukter.txt
$ gunzip frukter.txt.gz
$ ls frukter*
frukter.txt
```

```quiz
O que o `zcat server.log.gz` faz?
- [x] Imprime o conteúdo descompactado, e o `server.log.gz` continua como está
- [ ] Descompacta o arquivo em `server.log`
- [ ] Comprime o arquivo mais uma vez
---
O `zcat` é o mesmo que `gzip -dc`: descompacta para a saída padrão.
```

```try
du -sh dokument
---
O `-s` dá um único total para o diretório inteiro e o `-h` deixa o tamanho fácil de ler.
```
