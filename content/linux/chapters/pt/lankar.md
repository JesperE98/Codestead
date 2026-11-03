# Links e informações de arquivos

No Linux, o nome de um arquivo e o conteúdo dele são duas coisas diferentes.
Neste capítulo você usa isso para criar atalhos com **links**, aprende a
examinar arquivos com `stat` e `file` e decide quais permissões os arquivos
novos recebem com `umask`.

## Nomes e inodes

O conteúdo de um arquivo – junto com o dono, as permissões e os horários – fica
guardado em um **inode**. Um diretório é só uma lista de nomes, e cada nome
aponta para um inode. O `ls -i` mostra o número do inode na frente de cada
nome:

```sh
ls -i
```

## Links simbólicos – `ln -s`

Um **link simbólico** (*symlink*) é um arquivo pequeno que contém o caminho
para outra coisa – um atalho. O destino vem primeiro e o nome do link por
último, igual ao `cp`:

```sh
ln -s /var/log ~/log
ls -l ~/log
```

```text
lrwxrwxrwx 1 {{user}} {{user}} 8 Nov  3 10:15 /home/{{user}}/log -> /var/log
```

O `l` no começo da linha e a seta `->` mostram que é um link. As permissões
dele são sempre `rwxrwxrwx` – elas não importam; o que vale são as permissões
do destino.

Quase todos os comandos seguem o link: `ls ~/log/`, `cat`, `cd` e assim por
diante. O `cd` lembra o caminho por onde você veio, e o `pwd -P` mostra onde
você realmente está:

```sh
cd ~/log
pwd
pwd -P
```

### Links relativos

Um caminho relativo em um link é contado a partir do diretório **onde o link
está** – não de onde você está quando o cria:

```sh
cd ~
ln -s {{documents}}/{{fruits}} {{fruits}}
cat {{fruits}}
```

Isso funciona, porque o link está no seu diretório pessoal e
`{{documents}}/{{fruits}}` fica ali. Um link `/tmp/f` com o mesmo conteúdo
procuraria `/tmp/{{documents}}/{{fruits}}` – e estaria quebrado.

O `readlink` mostra o que está dentro de um link, e o `realpath` mostra o
caminho completo, com todos os links seguidos:

```sh
readlink {{fruits}}
realpath {{fruits}}
```

### Links quebrados

Um link pode apontar para algo que não existe:

```predict
$ ln -s nowhere.txt broken
$ cat broken
cat: broken: No such file or directory
---
O link existe, mas o arquivo para o qual ele aponta, não. O `ls -l` mostra um
link quebrado em vermelho, e o `find ~ -type l` encontra todos os links do seu
diretório pessoal.
```

O `rm` remove o próprio link, nunca aquilo para o qual ele aponta.

```quiz
Você tem o link `~/log -> /var/log` e executa `rm ~/log`. O que acontece?
- [ ] O `/var/log` e tudo o que há nele são apagados
- [x] Só o link é removido – o `/var/log` fica intacto
- [ ] O `rm` se recusa, porque `~/log` é um diretório
---
O `rm` age sobre o próprio link. Para apagar o destino, você teria que indicar
o destino.
```

### Onde você encontra links

Há links por todo lado em um sistema Linux. O `python3` muitas vezes é um link
para uma versão específica, como `python3.12`, e quando mais tarde você fizer
um serviço iniciar no boot com `systemctl enable`, o systemd cria um link para
o arquivo de unit dele. Veja os serviços que iniciam no boot:

```try
ls -l /etc/systemd/system/multi-user.target.wants
```

## Links físicos – `ln`

Sem `-s`, o `ln` cria um **link físico**: mais um nome para o mesmo inode.

```sh
ln {{notes}} {{todo}}
ls -li {{notes}} {{todo}}
```

```text
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{notes}}
1310722 -rw-r--r-- 2 {{user}} {{user}} 186 Nov  3 10:20 {{todo}}
```

Os dois nomes têm o mesmo número de inode, e o número depois das permissões –
o **contador de links** – agora é 2. É o mesmo arquivo: uma alteração feita
por um nome aparece pelo outro. Se você remover um dos nomes, o conteúdo
continua existindo enquanto o arquivo tiver pelo menos um nome.

```predict
$ echo hello > a.txt
$ ln a.txt b.txt
$ echo again >> b.txt
$ rm b.txt
$ cat a.txt
hello
again
---
`a.txt` e `b.txt` eram o mesmo arquivo. A linha escrita por meio de `b.txt`
continua lá depois que `b.txt` foi removido.
```

| | Link simbólico (`ln -s`) | Link físico (`ln`) |
|---|---|---|
| É | Um arquivo pequeno com um caminho | Mais um nome para o mesmo inode |
| Para um diretório | Sim | Não |
| Para outro sistema de arquivos | Sim | Não – os inodes pertencem a um só sistema de arquivos |
| Se o original for removido | O link quebra | O arquivo continua existindo |
| No `ls -l` | `l` e `->` | O contador de links aumenta |

```quiz
Que tipo de link pode apontar para um diretório?
- [x] Só um link simbólico
- [ ] Só um link físico
- [ ] Os dois
---
Links físicos para diretórios não são permitidos. Para um atalho para um
diretório, você usa `ln -s`.
```

## Tudo sobre um arquivo – `stat`

O `stat` mostra tudo o que o inode sabe:

```sh
stat /etc/hostname
```

```text
  File: /etc/hostname
  Size: 7         	Blocks: 8          IO Block: 4096   regular file
Device: 8,3	Inode: 1310755     Links: 1
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-11-03 10:15:22.000000000 +0100
Modify: 2026-11-03 10:15:22.000000000 +0100
Change: 2026-11-03 10:15:22.000000000 +0100
 Birth: 2026-11-03 10:15:22.000000000 +0100
```

Você vê o tamanho, o número do inode, o número de links, as permissões tanto
em dígitos (`0644`) quanto em letras, o dono e o grupo, e quando o arquivo foi
lido, modificado e alterado. Com `-c` você escolhe exatamente o que mostrar:
`%a` são as permissões em dígitos, `%U` o dono e `%n` o nome.

```predict
$ stat -c '%a %U' /etc/shadow
640 root
```

## O que tem dentro? – `file`

O Linux não se importa com extensões de nomes de arquivos: um arquivo chamado
`.jpg` pode conter qualquer coisa. O `file` olha o conteúdo em vez disso:

```sh
file /usr/bin/ls {{documents}}/{{grades}} /etc
```

```predict
$ echo hello > {{vacationPic}}
$ file {{vacationPic}}
{{vacationPic}}: ASCII text
---
O nome termina em `.jpg`, mas o conteúdo é texto – e é pelo conteúdo que o
`file` se guia.
```

## Permissões para arquivos novos – `umask`

Arquivos novos recebem as permissões `rw-rw-rw-` (666) e diretórios novos
`rwxrwxrwx` (777) – menos os bits da **umask**. O `umask` mostra qual é:

```sh
umask
```

A umask habitual `0022` tira a permissão de escrita do grupo e dos outros, e é
por isso que os seus arquivos recebem `644` e os seus diretórios `755`.

| umask | Arquivos novos | Diretórios novos | Significa |
|---|---|---|---|
| `022` | `644` `rw-r--r--` | `755` `rwxr-xr-x` | O habitual |
| `027` | `640` `rw-r-----` | `750` `rwxr-x---` | O grupo pode ler, os outros nada |
| `077` | `600` `rw-------` | `700` `rwx------` | Só você |

```predict
$ umask 027
$ touch plan.txt
$ stat -c %a plan.txt
640
---
666 menos 027: o grupo perde o `w`, e os outros perdem tudo.
```

O `umask` só afeta arquivos criados depois, e só no shell em que você o
executou. Para manter uma umask, coloque a linha no `~/.bashrc`.

```quiz
A sua umask é `077`. Quais permissões um diretório novo recebe?
- [ ] `755`
- [ ] `600`
- [x] `700`
---
Diretórios partem de 777. 777 menos 077 deixa 700: tudo para você, nada para
mais ninguém.
```
