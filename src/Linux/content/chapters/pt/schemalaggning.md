# Tarefas agendadas com cron

Um backup toda noite, uma limpeza dos logs antigos toda semana, buscar dados a
cada cinco minutos – o computador pode executar comandos sozinho em horários
definidos. A ferramenta clássica para isso é o **cron**, e o systemd tem os
seus próprios **timers**.

## cron e crontab

O serviço cron acorda a cada minuto e executa as tarefas cuja hora chegou.
Cada usuário tem a sua própria lista de tarefas, uma **crontab**:

```sh
crontab -l
```

*no crontab for {{user}}* significa que você ainda não tem nenhuma tarefa.

## Os cinco campos de tempo

Cada linha de uma crontab tem cinco campos de tempo e depois o comando:

```text
┌───────────── minuto (0–59)
│ ┌─────────── hora (0–23)
│ │ ┌───────── dia do mês (1–31)
│ │ │ ┌─────── mês (1–12)
│ │ │ │ ┌───── dia da semana (0–7, domingo é 0 ou 7)
│ │ │ │ │
* * * * *  comando
```

| Você escreve | Significa |
|---|---|
| `*` | Todos |
| `5` | Exatamente 5 |
| `1-5` | De 1 a 5 |
| `1,15` | 1 e 15 |
| `*/10` | A cada dez: 0, 10, 20 … |

| Linha | Executa |
|---|---|
| `* * * * * command` | A cada minuto |
| `*/5 * * * * command` | A cada cinco minutos |
| `30 2 * * * command` | Às 02:30 toda noite |
| `0 7 * * 1-5 command` | Às 07:00 de segunda a sexta |
| `0 0 1 * * command` | À meia-noite do dia 1 de cada mês |
| `@reboot command` | Uma vez, quando o computador liga |

`@hourly`, `@daily`, `@weekly` e `@monthly` também são atalhos.

```quiz
Quando a tarefa `15 8 * * 6 ~/backup.sh` é executada?
- [ ] Às 15:08 todos os dias
- [x] Às 08:15 todo sábado
- [ ] No dia 15 de cada mês, às 08:00
---
A ordem é minuto, hora, dia do mês, mês e dia da semana: minuto 15, hora 8,
qualquer data, qualquer mês, dia 6 – sábado.
```

```quiz
Com que frequência `0 */2 * * * command` é executado?
- [ ] A cada dois minutos
- [x] De duas em duas horas, na hora cheia
- [ ] Duas vezes por dia
---
Minuto 0 e uma hora sim, outra não: 00:00, 02:00, 04:00 …
```

## Instalando tarefas

O `crontab -e` abre a sua crontab em um editor de texto e a instala quando
você salva. O simulador ainda não tem editor, então aqui você entrega as
tarefas ao `crontab` pela entrada – `-` significa "ler da entrada":

```sh
echo '* * * * * date >> ~/cron.log' | crontab -
crontab -l
```

Cuidado: `crontab -` e `crontab FILE` **substituem** a crontab inteira. Para
acrescentar uma tarefa, junte as tarefas antigas com a nova:

```sh
(crontab -l; echo '30 2 * * * ~/backup.sh') | crontab -
```

Para remover uma linha, filtre-a com `grep -v` e instale o resto – ou remova
tudo com `crontab -r`:

```sh
crontab -l | grep -v backup.sh | crontab -
```

O `crontab` verifica as linhas antes de instalar qualquer coisa:

```predict
$ echo '0 25 * * * date' | crontab -
"-":1: bad hour
errors in crontab file, can't install.
---
Não existe hora 25 – as horas vão de 0 a 23. Nada foi instalado.
```

## Vendo a tarefa rodar

Depois de instalar a tarefa que roda a cada minuto, espere um minuto e dê uma
olhada:

```sh
cat ~/cron.log
journalctl -u cron
```

Cada execução é registrada no journal, como
`CRON[4211]: ({{user}}) CMD (date >> ~/cron.log)`. No simulador, o cron só
roda enquanto o aplicativo está aberto – assim como um computador de verdade,
ele não recupera as tarefas que perdeu enquanto estava desligado.

## A armadilha do cron: outro ambiente

As tarefas não rodam no seu terminal, e isso surpreende quase todo mundo:

- Elas rodam com `/bin/sh`, sem os seus aliases e sem o seu `~/.bashrc`.
- O `PATH` é curto (`/usr/bin:/bin`), então programas em outros lugares
  precisam do caminho completo.
- Elas começam no seu diretório pessoal.
- Uma saída que não é enviada para um arquivo se perde. Sempre termine a linha
  com, por exemplo, `>> ~/job.log 2>&1`.

Execute o comando à mão primeiro. Quando ele funcionar ali, coloque-o na
crontab.

```quiz
A tarefa `* * * * * echo hi` roda a cada minuto, mas você nunca vê `hi` em
lugar nenhum. Por quê?
- [ ] O cron não permite `echo`
- [x] A saída não tem para onde ir – envie-a para um arquivo com `>>`
- [ ] As tarefas só rodam como root
---
A saída das tarefas do cron não aparece em nenhum terminal. O cron de verdade
tenta enviá-la por e-mail, e a maioria dos computadores não tem e-mail
configurado – então ela se perde.
```

## As tarefas do próprio sistema

Além das crontabs dos usuários, existe o `/etc/crontab` e diretórios como
`/etc/cron.daily` e `/etc/cron.weekly`. Os scripts que estão neles são
executados uma vez por dia ou uma vez por semana:

```sh
cat /etc/crontab
ls /etc/cron.daily
```

As linhas do `/etc/crontab` têm um campo a mais antes do comando: o usuário
com que a tarefa roda.

## Timers do systemd

Nas distribuições modernas, boa parte disso é feita pelos **timers** do
systemd: uma unit `.timer` que inicia uma unit `.service` em horários
definidos. Eles registram no journal e podem recuperar execuções perdidas,
mas cada tarefa precisa de dois arquivos de unit. Para as suas próprias
tarefas pequenas, o cron é o caminho mais rápido. Liste os timers do
computador, com a próxima e a última execução:

```try
systemctl list-timers
```

## Em outras distribuições

| | Ubuntu e Debian | Fedora | Arch |
|---|---|---|---|
| Pacote | `cron` | `cronie` | `cronie` |
| Serviço | `cron` | `crond` | `cronie` |
| Instalado desde o início | Sim | Sim | Não |

No Arch você começa com `sudo pacman -S cronie` e
`sudo systemctl enable --now cronie`.
