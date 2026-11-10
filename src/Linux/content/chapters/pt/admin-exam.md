# Prova: Administração do sistema

Mostre o que você aprendeu sobre serviços, discos e usuários. As perguntas
cobrem a parte inteira, e você precisa de 80 % de acertos para ser aprovado.

```quiz
O `myserver` deve iniciar automaticamente toda vez que o computador der
boot, mas **não** pode ser iniciado agora. Qual comando faz exatamente isso?
- [ ] `sudo systemctl start myserver`
- [x] `sudo systemctl enable myserver`
- [ ] `sudo systemctl enable --now myserver`
- [ ] `sudo systemctl restart myserver`
---
O `enable` vale para o boot, o `start` vale para agora, e o `--now` faz as
duas coisas.
```

O serviço `reportd` deste computador não conseguiu iniciar. O que este
comando imprime?

```predict
$ systemctl is-active reportd
failed
---
O `is-active` imprime só uma palavra – aqui, o mesmo estado que o
`systemctl --failed` lista. O status de saída só é 0 quando a resposta é
`active`.
```

```quiz
Você quer acompanhar o log do `myserver` enquanto o testa, com as linhas
novas aparecendo assim que chegam. Qual comando você usa?
- [ ] `journalctl -n 20`
- [x] `journalctl -u myserver -f`
- [ ] `journalctl -p err -b`
- [ ] `systemctl status myserver --all`
---
O `-u` escolhe uma unit e o `-f` continua mostrando linhas novas até você
pressionar Ctrl+C.
```

```try
systemctl cat myserver
---
`ExecStart=` é o comando que inicia o serviço, e `WantedBy=` é o que o
`enable` usa.
```

```quiz
Você executa `systemctl stop myserver` sem `sudo` e recebe
*Interactive authentication required*. Por quê?
- [ ] O myserver não está rodando
- [x] Tudo o que altera um serviço exige root
- [ ] Você precisa executar `daemon-reload` primeiro
- [ ] O `stop` só funciona com serviços habilitados
```

```quiz
Por que o `/etc/fstab` normalmente diz `UUID=…` em vez de `/dev/sda2`?
- [ ] UUIDs são mais curtos de digitar
- [x] Os nomes de dispositivo podem mudar quando discos são adicionados, mas um UUID nunca muda
- [ ] O `mount` não entende nomes de dispositivo
- [ ] O UUID mostra quão cheio está o sistema de arquivos
---
O UUID é criado junto com o sistema de arquivos. Você o encontra com
`lsblk -f`, `blkid` ou `findmnt`.
```

```quiz
O `df -h` mostra que `/` está 98 % cheio. Qual comando ajuda você a
descobrir **quais diretórios** ocupam o espaço?
- [ ] `df -hT`
- [ ] `lsblk -f`
- [x] `du -h -d 1`
- [ ] `swapon --show`
---
O `df` pergunta ao sistema de arquivos quão cheio ele está; o `du` percorre
os arquivos e soma os tamanhos.
```

O seu diretório pessoal não fica em um sistema de arquivos próprio neste
computador. O que isto imprime?

```predict
$ df -h ~ | tail -n 1 | tr -s ' ' | cut -d' ' -f6
/
---
Quando recebe um caminho, o `df` mostra só o sistema de arquivos em que ele
está. A sexta coluna é `Mounted on` – o sistema de arquivos raiz.
```

```quiz
Você acrescentou uma linha ao `/etc/fstab`. O que você deve fazer **antes**
de reiniciar?
- [ ] Nada – o arquivo só é lido no boot
- [x] Testar com `sudo mount -a`
- [ ] Executar `sudo systemctl daemon-reload`
- [ ] Formatar a partição com `mkfs`
---
Um erro no `/etc/fstab` pode impedir que o computador dê boot direito. O
`mount -a` monta tudo o que está no arquivo e ainda não foi montado, então
você vê os erros agora.
```

```quiz
Você está prestes a formatar uma partição com `mkfs` em um computador de
verdade. O que você deve conferir primeiro? (Escolha todas as que se
aplicam.)
- [x] Com o `lsblk -f`, que o tamanho, a coluna `RM` e o rótulo batem
- [x] Que a partição não está montada
- [x] Que você tem um backup de tudo o que é importante
- [ ] Que a partição está listada no `/etc/fstab`
```

```quiz
Por que os hashes das senhas ficam em `/etc/shadow` e não em `/etc/passwd`?
- [ ] O `/etc/passwd` é pequeno demais
- [x] O `/etc/passwd` precisa poder ser lido por todos, mas o `/etc/shadow` só pelo root
- [ ] Os hashes são reversíveis, então precisam ficar escondidos
- [ ] O `/etc/passwd` só é lido no boot
---
Caso contrário, qualquer um poderia copiar os hashes e tentar quebrá-los com
calma. O `ls -l` precisa do `/etc/passwd` para mostrar os nomes dos donos.
```

Os campos do `/etc/group` são o nome do grupo, `x`, o GID e os membros.
Quem está no grupo `sudo`?

```predict
$ grep ^sudo /etc/group | cut -d: -f4
{{user}}
```

```quiz
O que acontece com `sudo userdel kim` – sem `-r`?
- [x] O usuário é excluído, mas o diretório pessoal `/home/kim` fica para trás
- [ ] Nada – o `userdel` sempre precisa de `-r`
- [ ] O usuário e o diretório pessoal são excluídos
- [ ] A conta só é bloqueada
```

```quiz
Um usuário tem UID 33 e o shell `/usr/sbin/nologin`. O que ele provavelmente
é?
- [ ] O root
- [ ] Um usuário comum – uma pessoa
- [x] Um usuário do sistema com o qual um serviço roda
- [ ] Um usuário excluído
---
Os UIDs de 1 a 999 são para usuários do sistema, e o `nologin` significa que
ninguém pode fazer login como eles.
```

```try
getent group sudo
---
O `getent` consulta o grupo do mesmo jeito que o sistema faz.
```
