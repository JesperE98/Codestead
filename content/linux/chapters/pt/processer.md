# Processos e jobs

Todo programa em execução é um **processo**. Neste momento o computador
simulado está rodando cerca de uma dúzia: os serviços do sistema, o seu shell – e mais
alguma coisa que você logo vai conhecer. Neste capítulo você vai aprender a
ver o que está rodando, parar programas que se comportam mal e executar
coisas em segundo plano.

## O que é um processo?

Um processo é um programa em execução junto com tudo de que ele precisa:
memória, arquivos abertos e o usuário com que ele roda. Todo processo tem um
**PID** (*process ID*) – um número que o identifica – e um processo pai, o
**PPID**, que o iniciou. Tudo começa com o processo número 1, o `init` (em
quase todas as distribuições, o `systemd`), que inicia todos os outros.

```quiz
O que é o PPID de um processo?
- [ ] O número do processador em que ele roda
- [x] O PID do processo que o iniciou – o pai dele
- [ ] A prioridade dele
---
Todo processo tem um pai. Siga os pais longe o bastante e você chega ao
processo número 1.
```

## Os meus processos – `ps`

O `ps` (*process status*) sem opções mostra os processos do seu próprio
terminal:

```sh
ps
```

Você vai ver o seu shell, o `bash`, e o próprio `ps` – que só existe enquanto
está rodando.

## Todos os processos – `ps aux`

Para ver tudo o que está rodando no computador, a escolha habitual é o
`ps aux`:

```sh
ps aux
```

| Coluna | Significa |
|---|---|
| `USER` | O usuário com que o processo roda |
| `PID` | O número de identificação do processo |
| `%CPU` / `%MEM` | Quanto de processador e memória ele usa |
| `STAT` | Estado: `R` rodando, `S` dormindo, `s` líder de sessão |
| `COMMAND` | O comando que iniciou o processo |

A lista fica longa, então ela costuma ser combinada com `grep` ou `sort`:

```sh
ps aux | grep sshd
ps aux --sort=-%cpu | head -5
```

A variante `ps -ef` mostra os mesmos processos, mas com o PID do processo pai
em uma coluna própria. Se você só quer o PID de um processo cujo nome você
conhece, existe o `pgrep`:

```sh
pgrep -l sshd
```

```try
pgrep -l sshd
---
O `-l` mostra o nome ao lado do PID.
```

## Uma visão ao vivo – `top` e `htop`

O `top` mostra os processos ordenados pelo tempo de processador que usam e se
atualiza a cada segundo – perfeito para descobrir o que está deixando o
computador lento. No topo você vê a carga (*load average*), o número de
processos e a memória.

```sh
top
```

Em um terminal de verdade, você sai do `top` com `q`. Muita gente prefere o
`htop`, que é colorido e pode ser controlado com o mouse, mas normalmente
precisa ser instalado antes.

## Parando processos – `kill`

O nome é dramático, mas na verdade o `kill` envia um **sinal** para um
processo. O sinal padrão, `SIGTERM` (15), pede ao processo que se encerre
educadamente. Se ele não obedecer, você pode enviar o `SIGKILL` (9), que o
força a parar na hora – mas aí ele não tem chance de salvar nada nem de fazer
a limpeza.

```text
kill 1234        # pede ao processo 1234 que termine (SIGTERM)
kill -9 1234     # força o encerramento (SIGKILL) – o último recurso
```

Se você sabe o nome mas não o PID, pode usar o `pkill` (corresponde a um
padrão) ou o `killall` (nome exato):

```text
pkill firefox
killall firefox
```

Você só pode enviar sinais para os seus **próprios** processos. Para
processos que pertencem ao root ou a outros usuários, você precisa do `sudo`.

```quiz
Um programa parou de responder. Qual comando você deve tentar **primeiro**?
- [x] `kill 1234` – ele envia `SIGTERM` e deixa o programa encerrar com calma
- [ ] `kill -9 1234` – ele sempre funciona melhor
- [ ] `sudo kill -9 1`
---
Comece com o sinal padrão, `SIGTERM`. O `SIGKILL` (`-9`) é o último
recurso, já que o programa não tem chance de salvar nem de fazer a limpeza.
```

> **Encontre e pare!** Algum processo neste computador está usando quase
> 100 % do processador. Use o `top` ou o `ps aux --sort=-%cpu` para descobrir
> como ele se chama e qual é o PID dele – e depois pare-o.

## Primeiro e segundo plano

Quando você executa um comando, o shell espera até que ele termine; ele roda
em **primeiro plano** (*foreground*). Se você colocar um `&` no final, ele
roda em **segundo plano** (*background*), e você recebe o prompt de volta na
hora:

```sh
sleep 300 &
```

O shell responde com o número do job entre colchetes e o PID do processo, por
exemplo `[1] 4200`. Os programas iniciados a partir do terminal se chamam
**jobs**:

```sh
jobs
```

| Comando | Faz |
|---|---|
| `jobs` | Lista os jobs deste terminal |
| `fg %1` | Traz o job 1 para o primeiro plano |
| `bg %1` | Deixa um job parado continuar em segundo plano |
| `kill %1` | Encerra o job 1 |
| `Ctrl+C` | Interrompe o programa em primeiro plano |
| `Ctrl+Z` | Pausa o programa em primeiro plano (retome com `fg` ou `bg`) |

A variável `$!` guarda o PID do job em segundo plano mais recente. Quando um
job termina, o shell avisa com uma linha como `[1]+  Done   sleep 300`.

```quiz
Você pressionou `Ctrl+Z` em um programa em primeiro plano. Como você o deixa
continuar rodando enquanto mantém o seu prompt?
- [ ] `fg %1`
- [x] `bg %1`
- [ ] `Ctrl+C`
---
O `Ctrl+Z` pausa o programa. O `bg` deixa um job parado continuar em
segundo plano, enquanto o `fg` o traria de volta para o primeiro plano.
```

## Como está o computador?

Dois comandos pequenos dão uma visão geral rápida:

```sh
uptime
free -h
```

O `uptime` mostra há quanto tempo o computador está ligado e a carga nos
últimos 1, 5 e 15 minutos. O `free -h` mostra quanta memória está em uso.
Repare na coluna *available*: o Linux usa a memória sobrando como cache de
arquivos, então a coluna *free* muitas vezes parece baixa, mesmo havendo
memória de sobra.

```quiz
O `free -h` mostra pouca memória *free*, mas muita memória *available*. O que
isso significa?
- [ ] O computador está prestes a ficar sem memória
- [x] O Linux usa a memória sobrando como cache de arquivos – olhe a *available*
- [ ] Parte da memória está com defeito
```

## Igual em todo lugar

Os processos funcionam do mesmo jeito em todas as distribuições. No Ubuntu,
as ferramentas vêm do pacote **procps**, e o `killall`, do **psmisc**. Algumas
distribuições dão nomes um pouco diferentes aos pacotes, e quais serviços
estão rodando desde o início também muda – você vai poder comparar
distribuições na parte sobre distribuições.
