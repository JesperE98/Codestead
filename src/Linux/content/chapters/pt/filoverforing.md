# Copiando arquivos via SSH

No capítulo de redes você executou comandos no servidor `192.168.1.10` com o
`ssh`. Aqui você dá um nome curto ao servidor, copia arquivos de e para ele
com o `scp` e mantém diretórios inteiros sincronizados com o `rsync`.

## Nomes curtos – `~/.ssh/config`

Digitar `ssh {{user}}@192.168.1.10` toda vez cansa. No arquivo
`~/.ssh/config` você pode dar um nome curto a um servidor:

```text
Host srv
    HostName 192.168.1.10
    User {{user}}
```

`Host` é o nome curto, `HostName` o endereço (ou nome) real e `User` o nome de
usuário no servidor. Se o servidor escuta em outra porta que não a 22,
acrescente uma linha como `Port 2222`. Depois disso, isto basta:

```sh
ssh srv hostname
```

O simulador ainda não tem editor de texto, então escreva o arquivo com `echo`.
O recuo serve só para facilitar a leitura:

```sh
mkdir -p ~/.ssh
echo 'Host srv' > ~/.ssh/config
echo '    HostName 192.168.1.10' >> ~/.ssh/config
echo '    User {{user}}' >> ~/.ssh/config
chmod 600 ~/.ssh/config
```

O ssh é rigoroso com esse arquivo. Se outras pessoas puderem escrever nele, o
ssh se recusa com *Bad owner or permissions*, e uma palavra escrita errado o
faz parar na hora:

```predict
$ mkdir -p ~/.ssh
$ echo 'Hostnam 192.168.1.10' > ~/.ssh/config
$ ssh srv hostname
/home/{{user}}/.ssh/config: line 1: Bad configuration option: hostnam
/home/{{user}}/.ssh/config: terminating, 1 bad configuration options
---
O ssh lê o arquivo inteiro antes de se conectar, então uma única palavra
errada impede todas as conexões – e a mensagem de erro diz em qual linha ela
está.
```

Os nomes funcionam também com o `scp` e o `rsync`.

```quiz
No `~/.ssh/config`, qual linha diz aonde o ssh deve realmente se conectar?
- [ ] `Host`
- [x] `HostName`
- [ ] `User`
---
`Host` é o nome curto que você mesmo digita, `HostName` o endereço real e
`User` o usuário com que você faz login.
```

## Copiando – `scp`

O `scp` (*secure copy*) funciona como o `cp`, mas um dos lados pode estar em
outro computador. Você escreve `HOST:CAMINHO`:

```sh
scp {{notes}} srv:
scp srv:{{welcomeFile}} .
scp -r {{documents}} srv:backup
```

- A origem vem primeiro e o destino por último, igual ao `cp`.
- Um caminho depois dos dois-pontos é contado a partir do seu diretório
  pessoal no servidor, e `srv:` sozinho significa o diretório pessoal.
- Diretórios precisam de `-r`.
- A porta é dada com `-P` maiúsculo (no `ssh` é um `-p` minúsculo).

Para cada arquivo, o `scp` mostra uma linha com o nome, `100%`, o tamanho e a
velocidade.

```quiz
Você digita `scp report.txt srv` – sem os dois-pontos. O que acontece?
- [ ] O arquivo é copiado para o seu diretório pessoal no servidor
- [x] Você recebe uma cópia local chamada `srv`
- [ ] O scp pergunta qual computador você quer dizer
---
Sem os dois-pontos, `srv` é só um nome de arquivo, e o `scp` copia localmente,
como o `cp`. É fácil esquecer os dois-pontos!
```

## Mantendo sincronizado – `rsync`

Para muitos arquivos, ou para algo que você copia de novo e de novo (backups!),
o `rsync` é melhor. Ele só copia o que está faltando ou o que mudou:

```sh
rsync -av {{documents}}/ /tmp/{{documents}}
```

```text
sending incremental file list
created directory /tmp/{{documents}}
./
{{fruits}}
{{grades}}
server.log

sent 1,342 bytes  received 102 bytes  2,888.00 bytes/sec
total size is 1,104  speedup is 0.76
```

O `-a` (*archive*) copia diretórios recursivamente e mantém as permissões e os
horários, e o `-v` lista o que é copiado. Execute o mesmo comando de novo e a
lista vem vazia – nada mudou. O rsync compara o tamanho e o horário de
modificação de cada arquivo; sem `-a`, as cópias recebem horários novos, e
tudo é enviado toda vez.

### A barra no final

Uma barra no final da origem é importante:

| Comando | Resultado |
|---|---|
| `rsync -a {{documents}} /tmp/x` | `/tmp/x/{{documents}}/...` – o próprio diretório |
| `rsync -a {{documents}}/ /tmp/x` | `/tmp/x/...` – só o que há dentro dele |

```predict
$ rsync -a {{documents}} /tmp/x
$ ls /tmp/x
{{documents}}
---
Sem a barra, o próprio diretório foi copiado para dentro de `/tmp/x`.
```

### Via SSH e `--delete`

Com um servidor como destino, o rsync passa pelo ssh:

```sh
rsync -av {{documents}}/ srv:{{documents}}/
```

O `--delete` também remove do destino os arquivos que não existem mais na
origem, para que o destino vire uma cópia exata. Um caminho errado pode então
apagar muita coisa, por isso teste primeiro com `-n` (*dry run*). Nada
acontece, o rsync só mostra o que faria, e a última linha termina com
`(DRY RUN)`:

```sh
rsync -avn --delete {{documents}}/ /tmp/{{documents}}
```

```quiz
O que o `-n` faz em `rsync -avn --delete a/ b/`?
- [ ] Copia só os arquivos novos
- [x] Mostra o que aconteceria, sem fazer nada
- [ ] Pula os arquivos que seriam removidos
---
O `-n` é um teste a seco. Confira a lista primeiro – depois execute o mesmo
comando sem `-n`.
```

## scp ou rsync?

| | `scp` | `rsync` |
|---|---|---|
| Bom para | Poucos arquivos, uma vez | Backups e cópias repetidas |
| Envia | Tudo, toda vez | Só o que mudou |
| Localmente também | Funciona, mas o `cp` é mais simples | Sim |
| Espelho com `--delete` | Não | Sim |

O `scp` vem junto com o cliente ssh. O `rsync` precisa estar instalado nos dois
computadores: ele já vem instalado no Ubuntu, no Debian e no Fedora, enquanto
no Arch você instala o pacote `rsync`.

No simulador, o servidor esquece os arquivos dele quando você fecha o aplicativo.
