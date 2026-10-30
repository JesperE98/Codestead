# Serviços e logs com systemd

Um computador Linux está o tempo todo fazendo coisas que ninguém inicia à
mão: ele aceita conexões SSH, mantém o relógio sincronizado, executa tarefas
agendadas e escreve logs. Os programas que fazem isso se chamam **serviços**,
e em quase todas as distribuições modernas quem os mantém em ordem é o
**systemd**. Neste capítulo você vai aprender a iniciar e parar serviços,
fazê-los iniciar no boot e – o mais importante de tudo – ler os logs quando
algo dá errado.

## init e systemd

Quando o kernel do Linux termina de iniciar, ele executa um único programa: o
**init**, o processo número 1. O init então inicia todo o resto. Hoje o init é
quase sempre o **systemd** – no Debian, no Ubuntu, no Arch e no Fedora.
Dê uma olhada:

```sh
ps -p 1
```

O processo se chama `/sbin/init`, mas isso é só um link para o programa
`systemd`.

O systemd faz mais do que iniciar serviços. Ele acompanha se eles estão
vivos, reinicia-os se travarem (se você quiser), junta tudo o que eles
imprimem em um log compartilhado – o **journal** – e tem ferramentas para a
maior parte do sistema:

| Ferramenta | Faz |
|---|---|
| `systemctl` | Controla os serviços: status, iniciar, parar, boot |
| `journalctl` | Lê o journal (o log) |
| `hostnamectl` | Mostra e altera o nome do computador |
| `systemd-analyze` | Mostra quanto tempo o boot levou |

## Units e serviços

Tudo o que o systemd acompanha se chama **unit**. Existem vários tipos, e o
tipo aparece no sufixo: `.service` (um serviço), `.timer` (uma tarefa
agendada), `.socket`, `.mount`, `.target` (um grupo de units, mais ou menos
como um "nível" do boot) e outros. Este capítulo trata de serviços.

Toda unit é descrita por um **arquivo de unit** (*unit file*), um pequeno
arquivo de texto. Eles ficam em dois lugares:

| Diretório | Conteúdo |
|---|---|
| `/usr/lib/systemd/system/` | Arquivos de unit que vêm com os pacotes. Não edite aqui! |
| `/etc/systemd/system/` | Os arquivos de unit do próprio administrador. Eles têm prioridade. |

```sh
ls /usr/lib/systemd/system
ls /etc/systemd/system
```

:::debian
Versões mais antigas do Debian e do Ubuntu muitas vezes dizem
`/lib/systemd/system`. É o mesmo diretório – `/lib` é um link para `/usr/lib`.
:::

O nome de um serviço é o nome do arquivo, por exemplo `minserver.service`.
Ao digitar comandos você pode omitir o `.service`: `systemctl status
minserver` funciona do mesmo jeito.

## Como vai o serviço? – `systemctl status`

O comando que você mais vai usar é o `systemctl status`:

:::debian
```sh
systemctl status ssh
```
:::

:::arch
```sh
systemctl status sshd
```
:::

:::redhat
```sh
systemctl status sshd
```
:::

A saída é mais ou menos assim:

```text
● sshd.service - OpenSSH server daemon
     Loaded: loaded (/usr/lib/systemd/system/sshd.service; enabled; preset: disabled)
     Active: active (running) since Fri 2026-10-30 07:54:07 CET; 2h 13min ago
       Docs: man:sshd(8)
   Main PID: 733 (sshd)
      Tasks: 1 (limit: 9387)
     Memory: 10.1M
     CGroup: /system.slice/sshd.service
             └─733 /usr/sbin/sshd -D

Oct 30 07:54:07 fedora systemd[1]: Starting sshd.service - OpenSSH server daemon...
Oct 30 07:54:07 fedora sshd[733]: Server listening on 0.0.0.0 port 22.
Oct 30 07:54:07 fedora systemd[1]: Started sshd.service - OpenSSH server daemon.
```

Linha por linha:

| Linha | Significa |
|---|---|
| `●` | Bolinha verde = rodando. `×` vermelho = falhou. `○` branco = parado. |
| `Loaded` | Onde está o arquivo de unit, se o serviço inicia no boot (`enabled`/`disabled`/`static`) e o padrão da distribuição (`preset`) |
| `Active` | A linha mais importante: `active (running)`, `inactive (dead)` ou `failed` – e desde quando |
| `Docs` | Onde ler mais (`man sshd`) |
| `Main PID` | O processo principal do serviço – o mesmo PID que no `ps aux` |
| `Memory`, `CGroup` | Quanta memória ele usa e quais processos pertencem a ele |
| Últimas linhas | As linhas mais recentes do log do serviço no journal |

`static` significa que o serviço não pode ser habilitado sozinho – ele é
iniciado quando outra unit precisa dele.

> **Dica:** Em um terminal de verdade, saídas longas são mostradas em um
> paginador (`less`). Aperte `q` para voltar. Acrescente `--no-pager` se
> preferir pular isso.

## Iniciar, parar e reiniciar

```text
sudo systemctl start minserver      # inicia agora
sudo systemctl stop minserver       # para agora
sudo systemctl restart minserver    # para e inicia de novo
sudo systemctl reload minserver     # pede que ele releia a configuração
```

Tudo o que **altera** alguma coisa exige root, então não esqueça o `sudo`.
Sem ele o systemctl responde:

```text
Failed to start minserver.service: Interactive authentication required.
```

O `reload` só funciona com serviços que dão suporte a ele. A vantagem é que o
serviço continua rodando enquanto isso – nenhuma conexão cai. Quando você
alterou o arquivo de configuração de um serviço, `reload` ou `restart` é o
último passo.

> **Experimente!** No capítulo sobre processos você parou o servidor de
> treino com `pkill`. Olhe o `systemctl status minserver` – o systemd
> percebeu que o processo sumiu. Inicie-o de novo com `systemctl` e compare o
> PID com `pgrep -l minserver`.

## Agora ou no boot? `start` e `enable`

Este é o mal-entendido mais comum sobre o systemd: **`start` e `enable` são
duas coisas diferentes.**

| Comando | Faz |
|---|---|
| `systemctl start X` | Inicia o serviço **agora**. Depois de reiniciar, ele não está mais lá. |
| `systemctl enable X` | Inicia o serviço automaticamente **no boot** – mas não agora. |
| `systemctl enable --now X` | As duas coisas de uma vez. |
| `systemctl disable X` | Não inicia no boot (`--now` também o para). |

O `enable` cria um link em um diretório com o nome do target da seção
`[Install]` do arquivo de unit, normalmente `multi-user.target.wants`:

```text
$ sudo systemctl enable --now minserver
Created symlink /etc/systemd/system/multi-user.target.wants/minserver.service → /etc/systemd/system/minserver.service.
```

Quando o computador dá boot, o systemd percorre esse diretório e inicia tudo
o que está nele. Você pode perguntar pelo estado:

```sh
systemctl is-active minserver
systemctl is-enabled minserver
```

`is-active` e `is-enabled` são ótimos em scripts – eles imprimem uma palavra
e terminam com status 0 se a resposta for "sim". Com `-q` ficam totalmente
em silêncio:

```text
if systemctl is-active -q minserver; then echo "the server is running"; fi
```

## Listando serviços

```sh
systemctl list-units --type=service
systemctl list-units --type=service --all
systemctl --failed
systemctl list-unit-files
```

- `list-units` mostra os serviços que estão rodando (ou que falharam). Com
  `--all` os parados também entram.
- `--failed` mostra só os que falharam. Um bom primeiro comando quando algo
  parece errado!
- `list-unit-files` mostra todos os arquivos de unit instalados e se eles
  estão `enabled`, `disabled` ou `static`.

## O journal – `journalctl`

Tudo o que os serviços, o kernel e o próprio systemd imprimem vai parar no
journal. Sem opções você recebe o journal inteiro, do mais antigo para o mais
novo:

```sh
journalctl
```

Isso rapidamente vira muita coisa, então quase sempre você filtra:

| Comando | Mostra |
|---|---|
| `journalctl -u ssh` | Só um serviço (`-u` de *unit*) |
| `journalctl -n 20` | As 20 linhas mais recentes |
| `journalctl -f` | As últimas linhas e depois as novas, à medida que chegam (saia com Ctrl+C) |
| `journalctl -b` | Só este boot (`-b -1` = o anterior) |
| `journalctl --since today` | Desde a meia-noite. Também `yesterday`, `"10:00"`, `"1 hour ago"` |
| `journalctl -p err` | Só erros e coisas piores |
| `journalctl -xe` | Pula para o final e acrescenta explicações |
| `journalctl -k` | Só mensagens do kernel (como o `dmesg`) |

As opções podem ser combinadas. Alguns clássicos:

```sh
journalctl -u minserver -n 5
journalctl -p err -b
journalctl --since today -u minserver
```

### Prioridades

Toda linha no journal tem uma **prioridade**. O `-p` mostra a que você
escolher *e tudo o que for mais grave*:

| Número | Nome | Significa |
|---|---|---|
| 0 | `emerg` | O sistema está inutilizável |
| 1 | `alert` | Precisa ser corrigido imediatamente |
| 2 | `crit` | Erro crítico |
| 3 | `err` | Erro – mostrado em vermelho |
| 4 | `warning` | Aviso – mostrado em amarelo |
| 5 | `notice` | Normal, mas digno de nota |
| 6 | `info` | Informação |
| 7 | `debug` | Informação de depuração |

Não se preocupe se o `journalctl -p err` mostrar alguns erros do kernel como
`ACPI BIOS Error`. Eles aparecem em quase todo computador e normalmente são
inofensivos – bugs no firmware do computador que o kernel contorna.

Normalmente você precisa ser root, ou membro de um grupo que tem permissão
para ler o journal (`adm` ou `systemd-journal` no Debian e no Ubuntu, `wheel`
no Arch e no Fedora), para ver tudo. O seu usuário no simulador pode ler o
journal inteiro.

## Investigando um serviço que não inicia

Alguém configurou o serviço **rapportd** neste computador, mas algo está
errado. Este é o caminho habitual:

1. **O que falhou?** Liste os serviços que falharam:

   ```sh
   systemctl --failed
   ```

2. **Olhe o status.** As últimas linhas muitas vezes bastam:

   ```sh
   systemctl status rapportd
   ```

3. **Leia o log inteiro** do serviço. Ele quase sempre diz o que está errado
   – leia com atenção, palavra por palavra:

   ```sh
   journalctl -xeu rapportd
   ```

   O próprio `systemctl` sugere exatamente esse comando quando uma
   inicialização falha: `See "systemctl status rapportd.service" and
   "journalctl -xeu rapportd.service" for details.`

4. **Corrija o problema**, por exemplo um arquivo de configuração que está
   faltando ou tem um erro de digitação.

5. **Reinicie e confira:**

   ```text
   sudo systemctl restart rapportd
   systemctl status rapportd
   ```

A linha `Main process exited, code=exited, status=1/FAILURE` significa que o
programa terminou sozinho com um erro. Se aparecer `status=203/EXEC`, o
systemd nem encontrou o programa – confira o caminho em `ExecStart=`.

## O arquivo de unit – `systemctl cat`

Para ver exatamente como um serviço é iniciado, leia o arquivo de unit dele:

```sh
systemctl cat minserver
```

```text
# /etc/systemd/system/minserver.service
[Unit]
Description=Minserver web server (practice server)
After=network.target

[Service]
ExecStart=/usr/local/bin/minserver --port 8080
ExecReload=/bin/kill -HUP $MAINPID

[Install]
WantedBy=multi-user.target
```

| Seção | Conteúdo |
|---|---|
| `[Unit]` | Descrição e ordem: `After=network.target` = iniciar depois da rede |
| `[Service]` | Como o programa roda: `ExecStart=` (o comando), `User=`, `Restart=on-failure` … |
| `[Install]` | O que o `enable` deve fazer: `WantedBy=multi-user.target` |

Se você alterar um arquivo de unit, o systemd precisa carregá-lo de novo
antes que a alteração tenha efeito – senão você recebe um aviso no
`systemctl status`:

```text
sudo systemctl daemon-reload
```

Nunca edite os arquivos em `/usr/lib/systemd/system` – eles são
sobrescritos na próxima vez que o pacote for atualizado. Coloque a sua
própria versão em `/etc/systemd/system`.

## Nomes diferentes em famílias diferentes

O systemd funciona igual em todo lugar, mas **os serviços nem sempre têm o
mesmo nome**. Isso depende de como os pacotes se chamam e de quais programas
a distribuição escolheu:

| Serviço | Debian/Ubuntu | Arch | Fedora |
|---|---|---|---|
| Servidor SSH | `ssh` (alias `sshd`) | `sshd` | `sshd` |
| Tarefas agendadas (cron) | `cron` | `cronie` (não instalado por padrão) | `crond` |
| Rede | `NetworkManager` (Ubuntu), `networking` (Debian) | `systemd-networkd` | `NetworkManager` |
| Firewall | `ufw` (se instalado) | – | `firewalld` |
| Relógio | `systemd-timesyncd` | `systemd-timesyncd` | `chronyd` |

:::debian
No {{distro}} o serviço SSH se chama `ssh.service`. Ele tem o alias
`sshd.service`, então `systemctl status sshd` também funciona – mas a saída
mostra o nome verdadeiro.
:::

:::arch
O Arch não instala quase nenhum serviço por padrão – você mesmo escolhe.
Nenhum serviço de cron está rodando, por exemplo; o Arch usa **timers** do
systemd no lugar. Se quiser cron, instale o pacote `cronie` e rode `sudo
systemctl enable --now cronie`. Lembre-se também de que o Arch tem
`preset: disabled`: serviços novos nunca são habilitados automaticamente
quando você os instala.
:::

:::redhat
O Fedora tem o `firewalld` rodando desde o início, e a sincronização do
relógio fica por conta do `chronyd`. O Fedora também usa `preset: disabled`
para a maioria dos serviços: quando você instala um serviço novo (um servidor
web, por exemplo), precisa rodar `sudo systemctl enable --now …` você mesmo.
:::

Não sabe como algo se chama? Procure na lista:

```sh
systemctl list-unit-files | grep ssh
```

## Reiniciando o computador

O `enable` só mostra o seu efeito quando o computador reinicia. Você pode
experimentar isso no simulador – ele reinicia num piscar de olhos:

```text
sudo systemctl reboot
```

Depois de reiniciar, só os serviços habilitados estão rodando. Com
`journalctl -b -1` você vê o log do boot anterior (e como tudo foi
desligado), e `journalctl --list-boots` mostra todos os boots no journal.

## Mais do systemd

```sh
hostnamectl
systemd-analyze
systemd-analyze blame
```

O `hostnamectl` mostra o nome do computador, o sistema operacional e o kernel
(e muda o nome com `sudo hostnamectl set-hostname NOVONOME`). O
`systemd-analyze` mostra quanto tempo o boot levou, e o `blame`, quais
serviços demoraram mais – perfeito quando o computador está lento para
iniciar.
