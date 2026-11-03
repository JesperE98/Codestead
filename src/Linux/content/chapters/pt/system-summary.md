# Resumo: O sistema

Nesta parte você viu o que acontece em volta dos seus comandos: a memória do
shell, quem pode fazer o quê, quais programas estão rodando e como os
arquivos são empacotados.

## Variáveis, PATH e aliases

Você lê uma variável com `$NOME` e cria uma com `NOME=valor` – sem espaços em
volta do `=`. O `export` a transforma em uma variável de ambiente, que os
programas que você inicia também conseguem ler. Dentro de aspas duplas, as
variáveis são substituídas pelos seus valores; dentro de aspas simples, tudo
é impresso exatamente como foi escrito. O shell procura os comandos nos
diretórios do `PATH`, e o `$?` guarda o código de saída do comando mais
recente: `0` significa que deu certo. Aliases e variáveis desaparecem quando
você fecha o terminal, a menos que você os coloque no `~/.bashrc`.

## Usuários, permissões e sudo

Todo arquivo tem um dono, um grupo e três conjuntos de permissões – para o
dono, para o grupo e para os outros. `r` = 4, `w` = 2 e `x` = 1, então `755`
é `rwxr-xr-x` e `600` é `rw-------`. Um script precisa da permissão `x` e é
executado com `./`, porque o diretório em que você está não faz parte do
`PATH`. O `sudo` executa um único comando como root e pede a sua própria
senha. No Ubuntu, os usuários do grupo `sudo` podem usá-lo.

## Links e informações de arquivos

O conteúdo e as permissões de um arquivo ficam em um **inode**, e os nomes em
um diretório apontam para inodes. O `ln -s` cria um **link simbólico**, um
arquivo pequeno com um caminho, que quebra se o destino sumir; um caminho
relativo nele é contado a partir do diretório do próprio link. O `ln` sem
`-s` cria um **link físico**, mais um nome para o mesmo inode. O `stat` mostra
tudo sobre um arquivo, o `file` diz o que ele contém, seja qual for o nome, e
a **umask** decide as permissões dos arquivos novos: com `022` eles recebem
`644`, com `077` só `600`.

## Processos e jobs

Todo programa em execução é um processo com um PID e um pai (PPID). O
`ps aux` mostra todos eles, e o `top` os mostra ao vivo, ordenados pelo uso
do processador. O `kill` envia um sinal: `SIGTERM` (15) por padrão e
`SIGKILL` (9) como último recurso. Com `&` um comando roda em segundo plano,
e o `jobs`, o `fg` e o `bg` permitem gerenciar os jobs do seu terminal. O
`nohup` mantém um comando rodando depois do logout, e o `watch` executa um
comando de novo e de novo.

## Arquivamento e compressão

O `tar` junta arquivos em um único arquivo e o `gzip` deixa um único arquivo
menor – juntos eles dão um `.tar.gz`. Exatamente uma das letras `c`, `x` e
`t` diz ao tar o que fazer, e o `f` é seguido pelo nome do arquivo. O `zcat`
lê um arquivo `.gz` sem descompactá-lo, e o `zip -r` / `unzip` cuidam de
arquivos zip, que são fáceis de compartilhar com Windows e macOS.

## Comandos e opções

| Comando | O que faz |
|---|---|
| `echo $NAME` | Mostra o valor de uma variável |
| `export NAME=value` | Cria uma variável de ambiente |
| `env` | Lista todas as variáveis de ambiente |
| `which ls` · `type cd` | Mostra onde está um programa · o que é um nome |
| `echo $?` | Mostra o código de saída do comando anterior |
| `alias ll='ls -la'` · `unalias ll` | Cria · remove um alias |
| `source ~/.bashrc` | Carrega o `~/.bashrc` na hora |
| `id` · `groups` | Mostra o seu usuário e os seus grupos |
| `ls -l` | Mostra permissões, dono e grupo |
| `chmod 644 file` · `chmod u+x file` | Altera permissões com números · símbolos |
| `sudo command` · `sudo -i` | Executa um comando como root · inicia um shell de root |
| `sudo tee -a file` | No fim de um pipe: acrescenta texto a um arquivo que só o root pode alterar |
| `ln -s target name` · `ln file name` | Cria um link simbólico · físico |
| `readlink link` · `realpath path` | Para onde um link aponta · o caminho completo sem links |
| `ls -li` | Mostra os números de inode e os contadores de links |
| `stat file` · `stat -c '%a %U' file` | Tudo sobre um arquivo · só o que você pedir |
| `file file` | O que um arquivo contém |
| `umask` · `umask 077` | Mostra · define as permissões que os arquivos novos perdem |
| `ps` · `ps aux` · `ps -ef` | Os seus processos · todos os processos · com o PID do pai |
| `ps aux --sort=-%cpu` | Todos os processos, os mais pesados primeiro |
| `pgrep -l name` | Encontra o PID de um processo pelo nome |
| `top` | Uma visão ao vivo dos processos |
| `kill PID` · `kill -9 PID` | Pede a um processo que termine · força o término |
| `pkill pattern` · `killall name` | Para processos pelo nome |
| `command &` | Executa um comando em segundo plano |
| `jobs` · `fg %1` · `bg %1` · `kill %1` | Lista · primeiro plano · segundo plano · encerra um job |
| `nohup command &` | Continua rodando depois do logout |
| `watch -n 5 command` | Executa um comando a cada cinco segundos |
| `uptime` · `free -h` | Carga · memória |
| `tar -czvf archive.tar.gz dir` | Empacota e comprime um diretório |
| `tar -tzvf archive.tar.gz` | Lista o conteúdo de um arquivo tar |
| `tar -xzvf archive.tar.gz -C dir` | Descompacta um arquivo tar em um diretório |
| `gzip file` · `gzip -k file` · `gunzip file.gz` | Comprime · mantém o original · descompacta |
| `zcat file.gz` | Lê um arquivo comprimido diretamente |
| `zip -r archive.zip dir` · `unzip archive.zip -d dir` | Cria · descompacta um arquivo zip |
| `du -sh dir` | Mostra quanto espaço algo ocupa |
