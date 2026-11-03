# Resumo: Administração do sistema

Nesta parte você cuidou do computador como administrador: dos serviços que
rodam em segundo plano, dos discos onde os arquivos vão parar e dos usuários
que compartilham o computador. Quase tudo que **altera** alguma coisa aqui
exige root – por isso o `sudo` apareceu bastante.

## Serviços e logs com systemd

O **systemd** é o processo número 1 e inicia todo o resto. Tudo o que ele
acompanha é uma **unit**, descrita por um arquivo de unit – os que vêm com os
pacotes ficam em `/usr/lib/systemd/system`, os seus em `/etc/systemd/system`,
que têm prioridade. O `systemctl` controla os serviços, e **`start` (agora) e
`enable` (no boot) são duas coisas diferentes**. Tudo o que os serviços
imprimem vai parar no **journal**, que você lê e filtra com `journalctl`.
Quando um serviço não inicia: `systemctl --failed`, `systemctl status`,
depois `journalctl -xeu` – e leia o log palavra por palavra. No Ubuntu o
serviço de SSH se chama `ssh`; outras famílias às vezes dão nomes diferentes
aos serviços.

## Discos e sistemas de arquivos

Um **disco** é dividido em **partições**, e cada partição precisa de um
**sistema de arquivos** antes de poder guardar arquivos. Os discos são
arquivos em `/dev` (`/dev/sda`, `/dev/sda1`, …). O Linux não tem letras de
unidade: todo sistema de arquivos é **montado** em algum lugar da única
árvore de diretórios que começa em `/`. O `lsblk` mostra os discos, o `df`
quão cheios estão os sistemas de arquivos e o `du` quanto os arquivos
ocupam. Sempre **desmonte** um pendrive antes de tirá-lo, porque pode haver
alterações ainda esperando na RAM. O que é montado no boot fica listado em
`/etc/fstab`, de preferência pelo **UUID**, que nunca muda. O `fdisk` e o
`mkfs` estão entre os comandos mais perigosos que existem – confira duas
vezes.

## Usuários e grupos

Todo usuário tem um **UID** – o root tem 0, os usuários do sistema recebem
números baixos e as pessoas começam em 1000. Os usuários ficam listados em
`/etc/passwd`, os grupos em `/etc/group` e os hashes das senhas em
`/etc/shadow`, que só o root pode ler. Todo usuário tem um **grupo
primário** e qualquer número de **grupos suplementares**. O
`useradd -m -s /bin/bash` cria um usuário, o `passwd` define a senha e o
`usermod -aG` adiciona a um grupo – **não esqueça o `-a`**. No Ubuntu, o
direito de usar o sudo vem do grupo `sudo` (outras famílias usam `wheel`). O
`su -` troca de usuário com a senha desse usuário, e o `sudo -u` executa um
comando como outra pessoa com a sua própria senha.

## Comandos

| Comando | O que faz |
|---|---|
| `systemctl status NAME` | Como está o serviço? |
| `sudo systemctl start` / `stop` / `restart` / `reload NAME` | Inicia, para, reinicia, relê a configuração |
| `sudo systemctl enable --now NAME` | Inicia no boot – e agora |
| `systemctl is-active` / `is-enabled NAME` | Uma palavra, status de saída 0 para "sim" |
| `systemctl --failed` | Serviços que falharam |
| `systemctl cat NAME` | Mostra o arquivo de unit |
| `sudo systemctl daemon-reload` | Carrega de novo os arquivos de unit alterados |
| `journalctl -u NAME` | O log de um serviço |
| `journalctl -p err -b` | Erros e coisas piores desde este boot |
| `journalctl -n 20`, `-f`, `--since today` | As últimas linhas, acompanhar, desde a meia-noite |
| `lsblk -f` | Discos, partições e sistemas de arquivos |
| `blkid`, `findmnt -n -o UUID /` | Tipo, rótulo e UUID |
| `df -h`, `du -sh DIR` | Quão cheio está o disco, quanto os arquivos ocupam |
| `sudo mount /dev/sdb1 /mnt/usb` | Monta um sistema de arquivos |
| `sudo umount /mnt/usb` | Desmonta |
| `cat /etc/fstab`, `sudo mount -a` | O que é montado no boot – e testar alterações |
| `swapon --show`, `free -h` | Swap e memória |
| `id`, `groups` | UID, GID e grupos |
| `sudo useradd -m -s /bin/bash NAME` | Cria um usuário |
| `sudo passwd NAME` | Define uma senha |
| `sudo groupadd GROUP` | Cria um grupo |
| `sudo usermod -aG GROUP NAME` | Adiciona a um grupo |
| `sudo usermod -L` / `-U NAME` | Bloqueia / desbloqueia uma conta |
| `sudo userdel -r NAME` | Exclui um usuário e o diretório pessoal |
| `su - NAME`, `sudo -u NAME COMMAND` | Troca de usuário, executa como outro usuário |
