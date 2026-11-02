# Bem-vindo ao shell do Linux

Este guia ensina você a usar o Linux pela linha de comando – desde os seus
primeiros comandos até o gerenciamento de pacotes em diferentes distribuições.
Cada capítulo explica um assunto. Ao longo do texto há **perguntas** curtas;
responda a elas, e o terminal à direita e as **tarefas** do capítulo são
desbloqueados. Uma tarefa é marcada como concluída automaticamente assim que
você acerta. A melhor forma de aprender é *fazendo*: leia, experimente, erre e
tente de novo.

## O que é o Linux?

A rigor, o **Linux** é apenas o *kernel*: o programa que conversa com o
hardware e permite que os outros programas compartilhem o processador, a
memória e os discos. O kernel foi criado por Linus Torvalds em 1991 e é
software livre.

Para ter um sistema utilizável, você precisa de muito mais do que isso: um
shell, ferramentas para gerenciar arquivos, um gerenciador de pacotes, talvez
um ambiente gráfico. Uma **distribuição** (*distro*) junta tudo isso em um
conjunto pronto para usar. Debian, Ubuntu, Arch Linux e Fedora são alguns
exemplos conhecidos.

Quase tudo o que você aprende neste guia funciona igual em todas as
distribuições, então é por aí que o curso começa. O terminal aqui roda o
**Ubuntu 24.04 LTS**. As distribuições diferem principalmente na forma de
instalar programas – isso vem no capítulo sobre distribuições.

## O que é um shell?

Um **shell** é o programa que lê os comandos que você digita e os executa.
O shell mais comum é o **bash**, o padrão em quase todas as distribuições.
Outros shells populares são o **zsh** (o padrão no macOS) e o **fish**. O
básico é igual em todos eles.

Repare na diferença entre *terminal* e *shell*: o terminal é a janela que
mostra o texto, e o shell é o programa que roda dentro dela.

```quiz
Você digita `ls` e pressiona Enter. Qual programa lê o comando e o executa?
- [ ] O terminal
- [x] O shell
- [ ] O kernel
---
O terminal só mostra o texto. O shell (aqui, o bash) lê o que você digita e o
executa.
```

## O prompt

Quando o shell está esperando um comando, ele mostra um **prompt**. No
terminal aqui, ele é assim:

```text
{{user}}@ubuntu:~$
```

Ele informa quem você é (`{{user}}`), em qual computador você está (`ubuntu`) e
onde você está no sistema de arquivos (`~` significa o seu diretório
pessoal). O sinal `$` mostra que você é um usuário comum. Se você for o
administrador (*root*), verá um `#` no lugar.

```quiz
O prompt termina em `#` em vez de `$`. O que isso diz a você?
- [ ] Você está no seu diretório pessoal
- [ ] O comando anterior falhou
- [x] Você é o administrador, o root
```

## O seu primeiro comando

Clique no terminal, digite o comando abaixo e pressione **Enter**:

```sh
echo {{helloWorld}}
```

O `echo` simplesmente imprime o que você passar para ele – aqui, *{{helloWorld}}*.
A maioria dos comandos segue o mesmo
padrão:

```text
comando  -opções  argumentos
ls       -l       /etc
```

O *comando* é o programa a ser executado, as *opções* (ou *flags*) mudam o
comportamento dele, e os *argumentos* são aquilo sobre o que o comando deve
trabalhar.

```quiz
No comando `ls -l /etc`, qual parte é a **opção**?
- [ ] `ls`
- [x] `-l`
- [ ] `/etc`
---
`ls` é o comando, `-l` muda o comportamento dele, e `/etc` é o argumento –
aquilo sobre o que o `ls` deve trabalhar.
```

Experimente o `echo` com um texto seu:

```try
echo Linux is fun
---
O `echo` imprimiu exatamente as palavras que você passou para ele.
```

## Quem e onde estou?

Dois comandos pequenos contam sobre o sistema em que você está. O `whoami`
imprime o nome do usuário com o qual você fez login. O arquivo
`/etc/os-release` descreve a distribuição, e o `cat` imprime um arquivo (mais
sobre o `cat` em um capítulo posterior):

```sh
whoami
cat /etc/os-release
```

## Como o simulador funciona

O terminal aqui é um **simulador** que roda inteiramente dentro deste
aplicativo. Ele se comporta como um computador Linux de verdade, mas nada do
que você fizer pode prejudicar a sua máquina – e, se fizer alguma besteira,
sempre dá para recomeçar com *Redefinir terminal* nas configurações.

- **Clique em um exemplo de código** para colocar o comando no terminal.
- **Tab** completa comandos e nomes de arquivos.
- **Setas para cima/para baixo** percorrem os comandos anteriores.
- **Ctrl+L** limpa a tela e **Ctrl+C** cancela a linha que você está digitando.
- `help` lista todos os comandos, e `man comando` mostra uma página de manual.

```quiz
Você digitou `ech` e pressiona **Tab**. O que acontece?
- [ ] A linha é cancelada
- [x] O shell tenta completar o resto do nome
- [ ] A tela é limpa
---
O Tab completa comandos e nomes de arquivos. **Ctrl+C** cancela a linha e
**Ctrl+L** limpa a tela.
```
