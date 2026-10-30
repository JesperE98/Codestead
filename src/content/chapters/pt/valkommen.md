# Bem-vindo ao shell do Linux

Este guia ensina você a usar o Linux pela linha de comando – desde os seus
primeiros comandos até o gerenciamento de pacotes em diferentes distribuições.
Cada capítulo explica um assunto e termina com uma série de **tarefas** que
você resolve no terminal à direita. Uma tarefa é marcada como concluída
automaticamente assim que você acerta. A melhor forma de aprender é *fazendo*:
leia, experimente, erre e tente de novo.

## O que é o Linux?

A rigor, o **Linux** é apenas o *kernel*: o programa que conversa com o
hardware e permite que os outros programas compartilhem o processador, a
memória e os discos. O kernel foi criado por Linus Torvalds em 1991 e é
software livre.

Para ter um sistema utilizável, você precisa de muito mais do que isso: um
shell, ferramentas para gerenciar arquivos, um gerenciador de pacotes, talvez
um ambiente gráfico. Uma **distribuição** (*distro*) junta tudo isso em um
conjunto pronto para usar. Neste momento você está usando **{{distro}}**.

As distribuições se agrupam em *famílias*, que derivam umas das outras e
compartilham o mesmo gerenciador de pacotes:

| Família | Gerenciador de pacotes | Exemplos |
|---|---|---|
| Debian | `apt` | Debian, Ubuntu, Linux Mint, Pop!_OS |
| Arch | `pacman` | Arch Linux, Manjaro, EndeavourOS |
| Red Hat | `dnf` | Fedora, RHEL, Rocky Linux, AlmaLinux |

Quase tudo o que você aprende neste guia funciona igual em todo lugar. O que
muda – principalmente o gerenciamento de pacotes – ganha capítulos próprios.
Você pode trocar de distribuição a qualquer momento no menu lá em cima.

## O que é um shell?

Um **shell** é o programa que lê os comandos que você digita e os executa.
O shell mais comum é o **bash**, o padrão em quase todas as distribuições.
Outros shells populares são o **zsh** (o padrão no macOS) e o **fish**. O
básico é igual em todos eles.

Repare na diferença entre *terminal* e *shell*: o terminal é a janela que
mostra o texto, e o shell é o programa que roda dentro dela.

## O prompt

Quando o shell está esperando um comando, ele mostra um **prompt**. No
{{distro}} ele é mais ou menos assim:

:::debian
```text
elev@{{hostname}}:~$
```
:::

:::arch
```text
[elev@{{hostname}} ~]$
```
:::

:::redhat
```text
[elev@{{hostname}} ~]$
```
:::

Ele informa quem você é (`elev`), em qual computador você está
(`{{hostname}}`) e onde você está no sistema de arquivos (`~` significa o seu
diretório pessoal). O sinal `$` mostra que você é um usuário comum. Se você
for o administrador (*root*), verá um `#` no lugar.

## O seu primeiro comando

Clique no terminal, digite o comando abaixo e pressione **Enter**:

```sh
echo Hej världen
```

O `echo` simplesmente imprime o que você passar para ele – aqui, *Hej
världen*, que é "Olá, mundo" em sueco. A maioria dos comandos segue o mesmo
padrão:

```text
comando  -opções  argumentos
ls       -l       /etc
```

O *comando* é o programa a ser executado, as *opções* (ou *flags*) mudam o
comportamento dele, e os *argumentos* são aquilo sobre o que o comando deve
trabalhar.

## Como o simulador funciona

O terminal aqui é um **simulador** que roda inteiramente no seu navegador. Ele
se comporta como um computador Linux de verdade, mas nada do que você fizer
pode prejudicar a sua máquina – e, se fizer alguma besteira, sempre dá para
recomeçar com o botão *Reset*.

- **Clique em um exemplo de código** para colocar o comando no terminal.
- **Tab** completa comandos e nomes de arquivos.
- **Setas para cima/para baixo** percorrem os comandos anteriores.
- **Ctrl+L** limpa a tela e **Ctrl+C** cancela a linha que você está digitando.
- `help` lista todos os comandos, e `man comando` mostra uma página de manual.

### Algumas palavras em sueco

Este guia foi escrito originalmente em sueco, por isso o usuário e os arquivos
de exercício do simulador têm nomes em sueco. Você não precisa saber sueco –
os comandos são exatamente os mesmos –, mas este pequeno glossário pode
ajudar:

| Nome | Significado |
|---|---|
| `elev` | aluno (o seu nome de usuário) |
| `dokument` | documentos |
| `anteckningar.txt` | anotações |
| `frukter.txt` | frutas |
| `betyg.csv` | notas |
| `bilder` | imagens |
| `gammalt` | coisas velhas |
