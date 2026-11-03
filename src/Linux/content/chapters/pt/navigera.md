# Navegando pelo sistema de arquivos

O Linux não tem letras de unidade como `C:`. Tudo – discos rígidos, pendrives,
até o hardware – fica em **uma única árvore** de diretórios que começa na
**raiz**, escrita `/`.

## Os diretórios mais importantes

| Diretório | Conteúdo |
|---|---|
| `/` | A raiz – o topo da árvore |
| `/home` | Os diretórios pessoais dos usuários, por exemplo `/home/{{user}}` |
| `/root` | O diretório pessoal do administrador, o root |
| `/etc` | Configurações do sistema (arquivos de configuração) |
| `/usr/bin` | Programas (comandos) como `ls` e `cat` |
| `/var/log` | Arquivos de log |
| `/tmp` | Arquivos temporários, onde qualquer um pode escrever |
| `/dev` | Dispositivos, por exemplo discos |
| `/proc` | Informações sobre processos e sobre o kernel |
| `/boot` | Arquivos necessários para iniciar o computador |

Essa organização se chama *Filesystem Hierarchy Standard* e é quase idêntica
em todas as distribuições.

```quiz
Um programa grava um arquivo de log. Em qual diretório você esperaria encontrá-lo?
- [ ] `/etc`
- [ ] `/usr/bin`
- [x] `/var/log`
- [ ] `/home`
---
Os arquivos de log ficam em `/var/log`. As configurações ficam em `/etc` e os programas em `/usr/bin`.
```

## Onde estou? – `pwd`

O `pwd` (*print working directory*) mostra o diretório em que você está:

```sh
pwd
```

## O que tem aqui? – `ls`

O `ls` lista o conteúdo de um diretório. Sem argumentos, ele mostra o
diretório em que você está, mas você também pode indicar outro:

```sh
ls /etc
```

A opção `-l` dá um formato longo, com mais informações:

```sh
ls -l
```

Arquivos cujo nome começa com um ponto são **ocultos** e não aparecem por
padrão. Muitas vezes são arquivos de configuração, como o `.bashrc`. A opção
`-a` (*all*) mostra esses arquivos:

```sh
ls -a
```

As opções podem ser combinadas: `ls -la` é o mesmo que `ls -l -a`.

```quiz
Por que um simples `ls` no seu diretório pessoal não mostra o arquivo `.bashrc`?
- [ ] É um arquivo de sistema que só o root pode ver
- [x] O nome dele começa com um ponto, então ele é oculto
- [ ] O `ls` só mostra diretórios
---
Arquivos cujo nome começa com um ponto são ocultos. O `ls -a` mostra esses também.
```

Experimente o formato longo junto com os arquivos ocultos:

```try
ls -la
```

## Mudando de diretório – `cd`

O `cd` (*change directory*) leva você para outro diretório:

```sh
cd /var/log
```

Existem dois tipos de caminho:

- Um caminho **absoluto** começa com `/` e parte da raiz, por exemplo
  `/var/log`. Ele funciona não importa onde você esteja.
- Um caminho **relativo** parte do diretório em que você está. Se você estiver
  em `/`, pode chegar a `/var/log` com apenas `cd var/log`.

```quiz
Você está em `/home`. Quais comandos levam você para `/home/{{user}}/{{documents}}`? (Escolha todos os que funcionam.)
- [x] `cd {{user}}/{{documents}}`
- [x] `cd /home/{{user}}/{{documents}}`
- [ ] `cd /{{user}}/{{documents}}`
- [ ] `cd {{documents}}`
---
`{{user}}/{{documents}}` é relativo a `/home`, e `/home/{{user}}/{{documents}}` é absoluto,
então funciona de qualquer lugar. `/{{user}}/{{documents}}` começa na raiz, onde não
existe nenhum `{{user}}`.
```

Vale a pena conhecer alguns nomes especiais:

| Nome | Significa |
|---|---|
| `.` | O diretório em que você está |
| `..` | O diretório acima (o diretório pai) |
| `~` | O seu diretório pessoal |
| `-` | (só com `cd`) o último diretório em que você esteve |

O `cd` sem argumentos sempre leva você de volta para casa.

```sh
cd ..
```

```predict
$ cd /usr/bin
$ cd ..
$ pwd
/usr
---
`..` é o diretório acima, então a partir de `/usr/bin` você vai parar em `/usr`.
```

## Completar com Tab

Você raramente precisa digitar os nomes inteiros. Digite o começo, por exemplo
`cd /va`, e pressione **Tab** – o shell completa o resto. Se houver várias
possibilidades, elas aparecem quando você pressiona Tab. Usuários experientes
de Linux apertam Tab o tempo todo!
