# Usuários, permissões e sudo

O Linux foi feito para que vários usuários possam compartilhar o mesmo
computador. Por isso, todo arquivo tem um dono e regras sobre quem pode fazer
o quê.

## Usuários e grupos

Você está logado como o usuário `{{user}}`. Todo usuário pertence a um ou mais
**grupos**:

```sh
id
```

O usuário mais importante é o **root** – o administrador, que tem permissão
para fazer qualquer coisa. Raramente se faz login como root. Em vez disso,
usa-se o `sudo` (veja abaixo).

## Lendo as permissões

Execute `ls -l` e olhe para a primeira coluna:

```text
-rw-r--r-- 1 {{user}} {{user}}  209 Oct 29 13:55 {{notes}}
drwxr-xr-x 2 {{user}} {{user}} 4096 Oct 29 13:55 {{documents}}
```

O primeiro caractere é o tipo: `-` para arquivo, `d` para diretório. Depois
vêm três conjuntos de três caracteres cada:

```text
-     rw-     r--     r--
tipo  dono    grupo   outros
```

| Caractere | Para um arquivo | Para um diretório |
|---|---|---|
| `r` (read) | Ler o conteúdo | Listar o conteúdo |
| `w` (write) | Alterar o conteúdo | Criar e apagar arquivos dentro dele |
| `x` (execute) | Executar o arquivo como programa | Entrar no diretório com `cd` |

Em seguida vêm o dono (`{{user}}`) e o grupo (`{{user}}`).

```quiz
Um diretório tem as permissões `drwxr-x---`. O que os membros do grupo dele podem fazer?
- [ ] Absolutamente nada
- [x] Listar o conteúdo e entrar nele com `cd`, mas não criar nem apagar arquivos nele
- [ ] Tudo o que o dono pode fazer
---
O conjunto do grupo é `r-x`: o `r` permite listar o conteúdo e o `x` permite
entrar no diretório. Sem o `w`, você não pode criar nem apagar arquivos nele.
```

## Alterando permissões – `chmod`

As permissões podem ser dadas como **números**. Cada conjunto recebe um dígito
que é a soma de r = 4, w = 2 e x = 1:

| Número | Permissões | Típico para |
|---|---|---|
| `755` | `rwxr-xr-x` | Programas e diretórios |
| `644` | `rw-r--r--` | Arquivos comuns |
| `600` | `rw-------` | Arquivos secretos |

```sh
chmod 644 {{notes}}
```

Ou com **símbolos**: `u` (o dono), `g` (o grupo), `o` (os outros), `a`
(todos), seguidos de `+`, `-` ou `=` e das permissões:

```sh
chmod u+x script.sh
chmod go-w arquivo.txt
```

```predict
$ touch plano.txt
$ chmod 600 plano.txt
$ chmod g+r plano.txt
$ ls -l plano.txt | awk '{print $1}'
-rw-r-----
```

## Scripts

Um **script** é um arquivo de texto com comandos. A primeira linha,
`#!/bin/bash`, se chama *shebang* e diz ao sistema qual programa deve executar
o arquivo:

```sh
echo '#!/bin/bash' > data.sh
echo 'echo "Hoje é:"; date' >> data.sh
cat data.sh
```

Para executar o script como um programa, ele precisa ser executável:

```sh
chmod +x data.sh
./data.sh
```

O `./` é necessário porque o diretório em que você está não faz parte do
`PATH`.

```quiz
Você escreveu o script `test.sh` e executou `./test.sh`, mas recebeu
`Permission denied`. O que está faltando?
- [ ] Um `sudo` na frente
- [x] A permissão de execução – execute `chmod +x test.sh` primeiro
- [ ] O `./` – deveria ser `test.sh`
---
Para executar um arquivo como programa, ele precisa da permissão `x`. O `./` está
certo: sem ele, o shell só procura nos diretórios do `PATH`.
```

## root e sudo

Alguns arquivos, como o `/etc/shadow`, onde ficam guardadas as senhas, só
podem ser lidos pelo root. Com o `sudo` (*superuser do*) você executa um único
comando como root:

```sh
sudo whoami
```

Na primeira vez, o `sudo` pede a **sua própria** senha. Só os usuários do
grupo de administradores podem usar o sudo. No Ubuntu, esse grupo se chama
**sudo** – você pode vê-lo entre os seus grupos quando executa `id`. Algumas
outras distribuições chamam o grupo de `wheel`; você vai ler mais sobre as
diferenças entre as distribuições na parte sobre distribuições.

Se você precisar executar muitos comandos como root, pode abrir um shell de
root com `sudo -i`. O prompt então muda para `#`. Volte com `exit`.

> **Lembre-se!** Com o sudo não existe rede de proteção. Só execute comandos
> que você entende.

```quiz
O `sudo` pede uma senha. A senha de quem você deve digitar?
- [ ] A senha do root
- [x] A sua própria senha
- [ ] Nenhuma senha – é só pressionar Enter
---
O `sudo` pede a **sua própria** senha e só deixa você passar se você estiver
no grupo de administradores.
```

### Uma armadilha comum

```text
sudo echo "text" > /etc/file     # NÃO funciona
```

É o *seu* shell – e não o sudo – que abre o arquivo para o `>`. Use o `tee`
em vez disso, que roda com sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```

```quiz
Por que `sudo echo "text" > /etc/file` não funciona?
- [ ] O `echo` não pode ser executado com sudo
- [x] O seu próprio shell abre o arquivo para o `>`, e ele não roda como root
- [ ] Os arquivos em `/etc` nunca podem ser alterados
---
O sudo só vale para o comando (`echo`). O redirecionamento é feito pelo seu
shell, que roda como você. O `tee` é o programa que grava o arquivo, então é o
`tee` que precisa do sudo.
```
