# Usuários, permissões e sudo

O Linux foi feito para que vários usuários possam compartilhar o mesmo
computador. Por isso, todo arquivo tem um dono e regras sobre quem pode fazer
o quê.

## Usuários e grupos

Você está logado como o usuário `elev`. Todo usuário pertence a um ou mais
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
-rw-r--r-- 1 elev elev  174 Oct 29 13:55 anteckningar.txt
drwxr-xr-x 2 elev elev 4096 Oct 29 13:55 dokument
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

Em seguida vêm o dono (`elev`) e o grupo (`elev`).

## Alterando permissões – `chmod`

As permissões podem ser dadas como **números**. Cada conjunto recebe um dígito
que é a soma de r = 4, w = 2 e x = 1:

| Número | Permissões | Típico para |
|---|---|---|
| `755` | `rwxr-xr-x` | Programas e diretórios |
| `644` | `rw-r--r--` | Arquivos comuns |
| `600` | `rw-------` | Arquivos secretos |

```sh
chmod 644 anteckningar.txt
```

Ou com **símbolos**: `u` (o dono), `g` (o grupo), `o` (os outros), `a`
(todos), seguidos de `+`, `-` ou `=` e das permissões:

```sh
chmod u+x skript.sh
chmod go-w fil.txt
```

## Scripts

Um **script** é um arquivo de texto com comandos. A primeira linha,
`#!/bin/bash`, se chama *shebang* e diz ao sistema qual programa deve executar
o arquivo:

```sh
echo '#!/bin/bash' > datum.sh
echo 'echo "Hoje é:"; date' >> datum.sh
cat datum.sh
```

Para executar o script como um programa, ele precisa ser executável:

```sh
chmod +x datum.sh
./datum.sh
```

O `./` é necessário porque o diretório em que você está não faz parte do
`PATH`.

## root e sudo

Alguns arquivos, como o `/etc/shadow`, onde ficam guardadas as senhas, só
podem ser lidos pelo root. Com o `sudo` (*superuser do*) você executa um único
comando como root:

```sh
sudo whoami
```

Na primeira vez, o `sudo` pede a **sua própria** senha. Só os usuários do
grupo de administradores podem usar o sudo. No {{distro}}, esse grupo se chama
**{{adminGroup}}**:

:::debian
Na família Debian, o grupo se chama `sudo`.
:::

:::arch
Na família Arch, o grupo se chama `wheel` – um nome antigo do Unix para "quem
manda" (em inglês, um *big wheel* é um figurão).
:::

:::redhat
Na família Red Hat, o grupo se chama `wheel` – um nome antigo do Unix para
"quem manda" (em inglês, um *big wheel* é um figurão).
:::

Se você precisar executar muitos comandos como root, pode abrir um shell de
root com `sudo -i`. O prompt então muda para `#`. Volte com `exit`.

> **Lembre-se!** Com o sudo não existe rede de proteção. Só execute comandos
> que você entende.

### Uma armadilha comum

```text
sudo echo "text" > /etc/file     # NÃO funciona
```

É o *seu* shell – e não o sudo – que abre o arquivo para o `>`. Use o `tee`
em vez disso, que roda com sudo:

```sh
echo "127.0.0.1 test.local" | sudo tee -a /etc/hosts
```
